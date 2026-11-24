/**
 * @file src/services/translation/capabilities.ts
 *
 * 文件职责：汇总保留翻译服务的批量能力、术语表支持与可用性判定。
 * 主要内容：判断原生批量协议（Google/Microsoft）、AI SDK 数组协议与术语表支持；已保留的 5 类服务在 Chrome/Edge 中均直接可用。
 * 模块边界：本文件位于翻译 application service 层，负责能力判定，不发起网络请求或挂载页面 UI。
 */

import {servicesType} from '@/src/core/config/catalog';
import {isNativeBatchTranslationService} from '@/src/core/config/nativeBatch';
import {browserCapabilities, type BrowserCapabilities} from '@/src/platform/browser/capabilities';

export function supportsNativeTranslationBatch(service: string): boolean {
    return isNativeBatchTranslationService(service);
}

export function supportsTranslationBatch(service: string): boolean {
    return supportsNativeTranslationBatch(service) || servicesType.isAiSdk(service);
}

export function supportsTranslationGlossary(
    service: string,
    model = '',
    serviceTypes: Pick<typeof servicesType, 'isUseAIContext'> = servicesType,
): boolean {
    return serviceTypes.isUseAIContext(service, model)
        || servicesType.isAI(service) || servicesType.isMachine(service);
}

export function isTranslationServiceAvailable(
    _service: string,
    _capabilities: BrowserCapabilities = browserCapabilities,
): boolean {
    return true;
}

export function getTranslationServiceUnavailableMessage(
    _service: string,
    _capabilities: BrowserCapabilities = browserCapabilities,
): string | null {
    return null;
}

export function filterAvailableTranslationServices<TOption extends {readonly value: string}>(
    options: readonly TOption[],
    capabilities: BrowserCapabilities = browserCapabilities,
): TOption[] {
    return options.filter((option) => isTranslationServiceAvailable(option.value, capabilities));
}
