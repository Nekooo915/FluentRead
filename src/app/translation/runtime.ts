/**
 * @file src/app/translation/runtime.ts
 * 文件职责：在 app 层创建扩展共用的翻译 broker 单例，把配置、provider registry、缓存、端点和提示词依赖完整注入。
 * 主要内容：连接全局启停与在途取消、配置水合与缓存阈值订阅、服务类型和模型解析、OpenAI 兼容端点、页面摘要 prompt、语言推导、凭据错误与缓存 key。
 * 模块边界：本文件只做 broker composition，不解析 browser 消息、不实现 provider HTTP，也不管理页面队列。
 */
import {translationProviderRegistry} from '@/src/providers/translation/registry';
import {AI_SDK_TRANSPORT_PROFILE, resolveOpenAICompatibleEndpoint} from '@/src/providers/translation/ai-sdk/endpoints';
import {config, configReady, subscribeConfig} from '@/src/services/config/store';
import {getMissingCredentialMessage} from '@/src/core/config/validation';
import {resolveConfiguredModel, servicesType} from '@/src/core/config/catalog';
import {buildPageSummaryPrompt, buildPageSummarySystemPrompt} from '@/src/core/translation/prompts';
import {getTranslationLanguages} from '@/src/services/translation/languages';
import {createTranslationBroker} from '@/src/services/translation/broker';
import {buildTranslationCacheKey, translationCache} from '@/src/services/translation/cache';
import {createTranslationCachePolicyBinding} from '@/src/services/translation/cachePolicyBinding';
import {createTranslationRequestScheduler} from '@/src/services/translation/requestScheduler';
import {createTranslationAvailability} from '@/src/services/translation/availability';

const cachePolicy = createTranslationCachePolicyBinding({
    ready: configReady,
    getConfig: () => config,
    subscribe: subscribeConfig,
    setLimits: (limits) => translationCache.setLimits(limits),
    warn: (error) => console.warn('[FluentRead] translation cache policy failed:', error),
});

/** 后台所有翻译入口共用的 scheduler；provider attempt 与 broker 请求使用同一 bucket 历史。 */
export const translationRequestScheduler = createTranslationRequestScheduler(
    () => config,
);

const broker = createTranslationBroker({
    ready: cachePolicy.ready,
    getConfig: () => config,
    providers: translationProviderRegistry,
    cache: translationCache,
    serviceTypes: servicesType,
    endpointResolver: {
        resolveOpenAICompatibleEndpoint,
        aiSdkTransportProfile: AI_SDK_TRANSPORT_PROFILE,
    },
    promptBuilder: {
        buildPageSummaryPrompt,
        buildPageSummarySystemPrompt,
    },
    getMissingCredentialMessage,
    getTranslationLanguages,
    resolveConfiguredModel,
    buildTranslationCacheKey,
    requestScheduler: translationRequestScheduler,
});

/** 翻译 broker singleton。 */
export const {translateWithCache} = createTranslationAvailability({
    ready: configReady,
    getConfig: () => config,
    subscribe: subscribeConfig,
    translate: broker.translateWithCache,
});
export const clearTranslationCache = broker.clearTranslationCache;
export async function cleanupTranslationCache(): Promise<void> {
    await cachePolicy.ready;
    await broker.cleanupTranslationCache();
}

/** 管理请求等待当前阈值落地，再返回仅包含数量和容量的统计。 */
export async function getTranslationCacheStats() {
    await cachePolicy.applyLatest();
    return translationCache.getStats();
}
