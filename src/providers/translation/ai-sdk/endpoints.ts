/**
 * @file src/providers/translation/ai-sdk/endpoints.ts
 *
 * 文件职责：解析使用 Vercel AI SDK 的 OpenAI 兼容服务端点，统一 OpenRouter 与自定义 OpenAI 兼容服务的路由解析。
 * 主要内容：声明 transport profile、保留的 AI SDK 服务 ID 与端点解析函数；补全自定义服务根地址和版本 Base URL，保留完整或非标准接口路径。
 * 模块边界：本文件位于 provider 适配层，只负责 URL 校验与拆分，不管理页面 DOM、UI 或配置持久化。
 */

import {urls} from '@/src/core/config/constants';
import {services} from '@/src/core/config/catalog';
import {
    getCustomOpenAIProvider,
    isCustomOpenAIProviderId,
    LEGACY_CUSTOM_OPENAI_PROVIDER_ID,
    type CustomOpenAIProvider,
} from '@/src/core/config/customOpenAI';

export type AiSdkEndpointRoute = 'common' | 'custom';

export const AI_SDK_TRANSPORT_PROFILE = 'vercel-ai-sdk-openai-compatible-v1' as const;

export interface AiSdkEndpointConfig {
    proxy?: Record<string, string | undefined>;
    custom?: string;
    customOpenAIProviders?: readonly CustomOpenAIProvider[];
}

export interface OpenAICompatibleEndpointResolution {
    endpoint: string;
    baseURL: string;
    queryParams?: Record<string, string>;
    exactEndpoint?: string;
}

export type ResolvedOpenAICompatibleEndpoint = OpenAICompatibleEndpointResolution;

export const AI_SDK_COMMON_SERVICE_IDS = Object.freeze([
    services.openrouter,
]);

export const AI_SDK_SERVICE_IDS = Object.freeze([
    ...AI_SDK_COMMON_SERVICE_IDS,
    services.custom,
]);

const commonServices = new Set<string>(AI_SDK_COMMON_SERVICE_IDS);

function parseAbsoluteEndpoint(rawEndpoint: string | undefined, label: string): URL {
    const endpoint = rawEndpoint?.trim();
    if (!endpoint) throw new Error(`${label}未配置`);

    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        throw new Error(`${label}格式不正确`);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`${label}仅支持 HTTP 或 HTTPS 协议`);
    }

    url.hash = '';
    return url;
}

function withoutTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeCustomEndpoint(rawEndpoint: string, label: string): string {
    const url = parseAbsoluteEndpoint(rawEndpoint, label);
    const path = url.pathname.replace(/\/+$/, '');
    if (!path) url.pathname = '/v1/chat/completions';
    else if (/\/v\d+$/.test(path)) url.pathname = `${path}/chat/completions`;
    return url.toString();
}

export function parseChatCompletionsEndpoint(
    rawEndpoint: string,
    label = '翻译服务接口地址',
): OpenAICompatibleEndpointResolution {
    const url = parseAbsoluteEndpoint(rawEndpoint, label);
    const queryEntries = [...url.searchParams.entries()];
    const hasDuplicateQueryKeys = new Set(queryEntries.map(([key]) => key)).size !== queryEntries.length;
    const parsedQueryParams = Object.fromEntries(queryEntries);
    const queryParams = Object.keys(parsedQueryParams).length > 0 ? parsedQueryParams : undefined;
    url.search = '';

    const standardPath = url.pathname.match(/^(.*)\/chat\/completions\/?$/);
    if (standardPath) {
        const endpointUrl = new URL(rawEndpoint.trim());
        endpointUrl.hash = '';
        endpointUrl.pathname = endpointUrl.pathname.replace(/\/$/, '');

        url.pathname = standardPath[1] || '/';
        const resolution: OpenAICompatibleEndpointResolution = {
            endpoint: endpointUrl.toString(),
            baseURL: withoutTrailingSlash(url.toString()),
        };
        if (hasDuplicateQueryKeys) resolution.exactEndpoint = endpointUrl.toString();
        else resolution.queryParams = queryParams;
        return resolution;
    }

    const exactUrl = new URL(rawEndpoint.trim());
    exactUrl.hash = '';
    return {
        endpoint: exactUrl.toString(),
        baseURL: withoutTrailingSlash(url.toString()),
        queryParams,
        exactEndpoint: exactUrl.toString(),
    };
}

export function getAiSdkEndpointRoute(service: string): AiSdkEndpointRoute | null {
    if (commonServices.has(service)) return 'common';
    if (isCustomOpenAIProviderId(service)) return 'custom';
    return null;
}

function resolveCommonEndpoint(service: string, config: AiSdkEndpointConfig): string {
    const proxy = config.proxy?.[service]?.trim();
    if (proxy) return proxy;
    const endpoint = urls[service];
    if (typeof endpoint !== 'string' || !endpoint.trim()) {
        throw new Error(`未找到翻译服务接口: ${service}`);
    }
    return endpoint;
}

export function resolveOpenAICompatibleEndpoint(
    service: string,
    config: AiSdkEndpointConfig,
): ResolvedOpenAICompatibleEndpoint {
    const route = getAiSdkEndpointRoute(service);
    if (!route) throw new Error(`翻译服务尚未纳入 AI SDK 端点解析: ${service}`);

    const endpoint = route === 'common'
        ? resolveCommonEndpoint(service, config)
        : config.proxy?.[service]?.trim()
            || normalizeCustomEndpoint(
                getCustomOpenAIProvider(config.customOpenAIProviders, service)?.endpoint
                || (service === LEGACY_CUSTOM_OPENAI_PROVIDER_ID ? config.custom : '')
                || '',
                `${service} 接口地址`,
            );

    return parseChatCompletionsEndpoint(endpoint, `${service} 接口地址`);
}
