/**
 * @file src/app/background/handlers/connectionTest.ts
 * 文件职责：为设置页的翻译服务连通性检查提供后台消息适配器，在调用 provider 前形成明确、可序列化的输入输出契约。
 * 主要内容：定义 testTranslationService 消息与成功/失败响应，验证服务与 Key 行参数，调用注入的测试能力，将原始异常转换为安全诊断。
 * 模块边界：本文件不发起网络请求、不读取凭据，也不识别具体供应商协议；连接测试实现由 providers 层注入。
 */
import {diagnoseFailure, getDiagnosticText, type Diagnostic} from '@/src/services/diagnostics';
import type {BackgroundMessageHandler} from '@/src/services/messaging/backgroundRouter';

export const CONNECTION_TEST_MESSAGE_TYPE = 'testTranslationService' as const;

export interface ConnectionTestMessage {
    type: typeof CONNECTION_TEST_MESSAGE_TYPE;
    service?: unknown;
    keyIndex?: unknown;
    keyRevision?: unknown;
}

export type ConnectionTestResponse =
    | {success: true; durationMs: number}
    | {success: false; error: string; diagnostic: Diagnostic};

export interface ConnectionTestDependencies {
    readonly ready: Promise<void>;
    readonly runConnectionTest: (service: string, keyIndex?: number, keyRevision?: string) => Promise<{durationMs: number}>;
    readonly formatError: (service: string, error: unknown) => string;
}

function parseService(value: unknown): string {
    if (typeof value === 'string' && value.trim()) return value;
    throw new TypeError('连接测试 service 必须是非空字符串');
}

export function createConnectionTestHandler(
    dependencies: ConnectionTestDependencies,
): BackgroundMessageHandler<unknown, ConnectionTestMessage, ConnectionTestResponse> {
    return {
        type: CONNECTION_TEST_MESSAGE_TYPE,
        async handle(message) {
            let service = '';
            let stage: 'input' | 'configuration' | 'provider' = 'input';
            try {
                service = parseService(message.service);
                if (message.keyIndex !== undefined && (
                    typeof message.keyIndex !== 'number' || !Number.isSafeInteger(message.keyIndex) || message.keyIndex < 0
                )) throw new TypeError('连接测试 Key 序号无效');
                if (message.keyRevision !== undefined && (
                    typeof message.keyRevision !== 'string' || !/^[a-f0-9]{64}$/u.test(message.keyRevision)
                )) throw new TypeError('连接测试配置版本无效');
                stage = 'configuration';
                await dependencies.ready;
                stage = 'provider';

                const result = message.keyRevision === undefined
                    ? message.keyIndex === undefined
                        ? await dependencies.runConnectionTest(service)
                        : await dependencies.runConnectionTest(service, message.keyIndex as number)
                    : await dependencies.runConnectionTest(
                        service,
                        message.keyIndex as number | undefined,
                        message.keyRevision as string,
                    );
                return {success: true, ...result};
            } catch (error) {
                let diagnostic = diagnoseFailure(error, stage === 'input' ? {reason: 'configuration'}
                    : stage === 'configuration' ? {reason: 'configuration-save'} : {});
                if (stage === 'provider' && diagnostic.code === 'unknown') {
                    try { diagnostic = diagnoseFailure(dependencies.formatError(service, error)); } catch { /* 分类失败仍返回固定 unknown 文案。 */ }
                }
                return {success: false, error: getDiagnosticText(diagnostic).title, diagnostic};
            }
        },
    };
}
