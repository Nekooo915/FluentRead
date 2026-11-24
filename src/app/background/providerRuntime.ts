/**
 * @file src/app/background/providerRuntime.ts
 * 文件职责：为后台组合根集中提供翻译供应商连接检查运行时能力，隔离 app/messageRuntime 对 providers 内部文件结构的直接依赖。
 * 主要内容：装配设置页连接检查消息与错误格式化，并为连接测试注入共享请求 scheduler 与冻结配置快照。
 * 模块边界：这是窄化的 app 层出口，不注册消息、不实现 HTTP 协议。
 */
import {
    formatConnectionTestError,
    runTranslationServiceConnectionTest,
} from '@/src/providers/translation/connectionTest';
import {config, configReady} from '@/src/services/config/store';
import {createConnectionTestHandler} from './handlers/connectionTest';
import {resolveConfiguredModel, servicesType} from '@/src/core/config/catalog';
import {translationRequestScheduler} from '@/src/app/translation/runtime';
import {createTranslationProviderConfigSnapshot} from '@/src/services/translation/requestSnapshot';
import {resolveTranslationRequestModel} from '@/src/services/translation/broker';

export {formatConnectionTestError};

export function createProviderTestRuntimeHandlers() {
    return [createConnectionTestHandler({
        ready: configReady,
        runConnectionTest: runTranslationServiceConnectionTestWithScheduler,
        formatError: formatConnectionTestError,
    })];
}

export function runTranslationServiceConnectionTestWithScheduler(
    service: string,
    keyIndex?: number,
    keyRevision?: string,
) {
    const snapshot = createTranslationProviderConfigSnapshot(config);
    return runTranslationServiceConnectionTest(service, {
        configuredModel: resolveConfiguredModel(snapshot.model[service], snapshot.customModel[service]),
        effectiveModel: resolveTranslationRequestModel(snapshot, service, undefined, servicesType.isAiSdk, servicesType.isAI),
        keyIndex,
        keyRevision,
        warn: (message, error) => console.warn(message, error),
        requestScheduler: translationRequestScheduler,
        config: snapshot,
        countRate: !servicesType.isAiSdk(service),
    });
}
