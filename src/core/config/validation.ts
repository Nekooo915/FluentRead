/**
 * @file src/core/config/validation.ts
 *
 * 文件职责：表达各保留翻译服务对 API Key 的领域校验规则，为保存、连接测试和请求前检查提供一致判定。
 * 主要内容：定义 CredentialConfig，结合服务与模型计算凭据要求键，判断是否需要 API Key，并生成中文缺失凭据提示。
 * 模块边界：本文件属于 core 领域层，只定义纯校验函数；不读写存储、不发起网络请求。
 */

import {customModelString, options, servicesType} from './catalog';
import {
    getCustomOpenAIProviderLabel,
    isCustomOpenAIProviderId,
    LEGACY_CUSTOM_OPENAI_PROVIDER_ID,
    type CustomOpenAIProvider,
} from './customOpenAI';

export const API_KEY_REQUIREMENT_KEY_PREFIX = 'v2:' as const;

export interface CredentialConfig {
    token?: Record<string, string | undefined>;
    secret?: Record<string, string | undefined>;
    model?: Record<string, string | undefined>;
    customModel?: Record<string, string | undefined>;
    requireApiKey?: Record<string, boolean | undefined>;
    customOpenAIProviders?: readonly CustomOpenAIProvider[];
}

function getServiceLabel(service: string, config: CredentialConfig): string {
    if (isCustomOpenAIProviderId(service)) {
        return getCustomOpenAIProviderLabel(config.customOpenAIProviders, service);
    }
    return options.services.find((item) => item.value === service)?.label || service;
}

export function createApiKeyRequirementKey(service: string, model: string): string {
    return `${API_KEY_REQUIREMENT_KEY_PREFIX}${JSON.stringify([service, model])}`;
}

export function getLegacyApiKeyRequirementKey(service: string, model: string): string {
    return `${service}:${model}`;
}

export function parseApiKeyRequirementKey(key: string): [service: string, model: string] | null {
    if (!key.startsWith(API_KEY_REQUIREMENT_KEY_PREFIX)) return null;
    try {
        const value: unknown = JSON.parse(key.slice(API_KEY_REQUIREMENT_KEY_PREFIX.length));
        return Array.isArray(value)
            && value.length === 2
            && typeof value[0] === 'string'
            && typeof value[1] === 'string'
            ? [value[0], value[1]]
            : null;
    } catch {
        return null;
    }
}

function getActualModel(service: string, config: CredentialConfig): string {
    const selectedModel = config.model?.[service] || '';
    return selectedModel === customModelString
        ? config.customModel?.[service] || selectedModel
        : selectedModel;
}

export function getApiKeyRequirementKey(service: string, config: CredentialConfig): string {
    return createApiKeyRequirementKey(service, getActualModel(service, config));
}

export function isApiKeyRequired(service: string, config: CredentialConfig): boolean {
    if (!servicesType.isAI(service)) return true;
    const requirement = config.requireApiKey?.[getApiKeyRequirementKey(service, config)];
    if (typeof requirement === 'boolean') return requirement;
    if (isCustomOpenAIProviderId(service) && service !== LEGACY_CUSTOM_OPENAI_PROVIDER_ID) return true;
    return config.requireApiKey?.[getLegacyApiKeyRequirementKey(service, getActualModel(service, config))] !== false;
}

export function getMissingCredentialMessage(
    service: string,
    config: CredentialConfig,
    selectedModel?: string,
): string | null {
    const requirementConfig: CredentialConfig = selectedModel === undefined ? config : {
        model: {[service]: selectedModel}, customModel: config.customModel, requireApiKey: config.requireApiKey,
    };
    const serviceLabel = getServiceLabel(service, config);

    if (servicesType.isUseToken(service) && isApiKeyRequired(service, requirementConfig)) {
        if (!config.token?.[service]?.trim()) {
            return `${serviceLabel} 需要 API Key（访问令牌），当前尚未配置；请先在设置中填写，再开始翻译。`;
        }
    }

    return null;
}
