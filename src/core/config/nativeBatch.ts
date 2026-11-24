/**
 * @file src/core/config/nativeBatch.ts
 *
 * 文件职责：统一原生多文本翻译协议的服务名单与按服务保存的合批偏好，让设置可见性和运行时请求决策使用同一领域规则。
 * 主要内容：声明 Google 与微软两个保留的原生批量服务，默认开启；缺项或非法值回退为开启，仅显式 false 停用。
 * 模块边界：只处理服务标识和普通配置数据，不读写存储、不发送翻译请求。
 */

import {services} from './catalog';

export const NATIVE_BATCH_TRANSLATION_SERVICES = Object.freeze([
    services.google,
    services.microsoft,
]);

const nativeBatchServices = new Set<string>(NATIVE_BATCH_TRANSLATION_SERVICES);

export const DEFAULT_NATIVE_BATCH_TRANSLATION_ENABLED: Readonly<Record<string, boolean>> = Object.freeze(
    Object.fromEntries(NATIVE_BATCH_TRANSLATION_SERVICES.map((service) => [service, true])),
);

export function isNativeBatchTranslationService(service: string): boolean {
    return nativeBatchServices.has(service);
}

export function isNativeTranslationBatchEnabled(service: string, preferences: unknown): boolean {
    return isNativeBatchTranslationService(service)
        && !(preferences !== null && typeof preferences === 'object' && !Array.isArray(preferences)
            && Object.hasOwn(preferences, service)
            && (preferences as Record<string, unknown>)[service] === false);
}

export function normalizeNativeBatchTranslationEnabled(value: unknown): Record<string, boolean> {
    return Object.fromEntries(NATIVE_BATCH_TRANSLATION_SERVICES.map((service) => [
        service, isNativeTranslationBatchEnabled(service, value),
    ]));
}
