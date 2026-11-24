/**
 * @file src/providers/translation/registry.ts
 *
 * 文件职责：集中登记精简版保留的 5 个翻译服务标识到 provider 函数的映射，作为后台路由与连接测试查找适配器的唯一目录。
 * 主要内容：仅注册微软翻译、谷歌翻译、DeepSeek、OpenRouter 与自定义 OpenAI 兼容接口（多自定义服务共享 custom 适配器）。
 * 模块边界：本文件位于 provider 适配层，只把统一翻译请求交给对应协议适配器；不管理页面 DOM、UI 或配置持久化。
 */

import {services} from '@/src/core/config/catalog';
import {AI_SDK_SERVICE_IDS} from './ai-sdk/endpoints';
import {translateWithOpenAICompatibleAiSdk} from './ai-sdk/openai-compatible';
import microsoft from './microsoft';
import google from './google';
import deepseek from './deepseek';
import type {
    TranslationProvider,
    TranslationProviderRegistry,
    TranslationProviderRequest,
    TranslationProviderResult,
} from '@/src/services/translation/types';

function singleTextProvider(
    provider: TranslationProvider<TranslationProviderResult, string>,
): TranslationProvider<TranslationProviderResult> {
    return (message: TranslationProviderRequest) => {
        if (typeof message.origin !== 'string') {
            return Promise.reject(new TypeError('当前翻译服务仅支持单条文本请求'));
        }
        return provider({...message, origin: message.origin});
    };
}

const directServices: TranslationProviderRegistry<TranslationProviderResult> = {
    [services.microsoft]: microsoft,
    [services.google]: google,
    [services.deepseek]: singleTextProvider(deepseek),
};

const aiSdkServices: TranslationProviderRegistry<TranslationProviderResult> = Object.fromEntries(
    AI_SDK_SERVICE_IDS.map((service) => [service, translateWithOpenAICompatibleAiSdk]),
);

export const translationProviderRegistry: TranslationProviderRegistry<TranslationProviderResult> = {
    ...directServices,
    ...aiSdkServices,
};
