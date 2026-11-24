/**
 * @file src/core/config/credentialBinding.ts
 * 文件职责：把服务凭据绑定到请求实际抵达的配置地址，防止配置替换后把旧密钥带到另一端点。
 * 主要内容：针对精简版保留的 5 个服务与自定义 OpenAI 兼容服务计算端点身份，端点变化且未显式重绑时清理旧凭据与自定义请求头。
 * 模块边界：本文件只做 Config、凭据映射与 URL 的纯比较，不读取存储、不执行请求。
 */
import {services, servicesType} from './catalog';
import {urls} from './constants';
import {isCustomOpenAIProviderId} from './customOpenAI';
import type {ConfigCredentialField, ConfigCredentials} from './credentials';
import type {Config} from './model';

function canonicalFetchEndpoint(value: string): string {
    const endpoint = value.trim();
    if (!endpoint) return '';
    try {
        const url = new URL(endpoint);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return endpoint;
        url.hash = '';
        return url.toString();
    } catch {
        return endpoint;
    }
}

function canonicalOpenAICompatibleEndpoint(value: string, normalizeCustomBase = false): string {
    const endpoint = canonicalFetchEndpoint(value);
    try {
        const url = new URL(endpoint);
        if (normalizeCustomBase && (url.protocol === 'http:' || url.protocol === 'https:')) {
            const path = url.pathname.replace(/\/+$/u, '');
            if (!path) url.pathname = '/v1/chat/completions';
            else if (/\/v\d+$/u.test(path)) url.pathname = `${path}/chat/completions`;
        }
        url.searchParams.sort();
        if (/\/chat\/completions\/$/u.test(url.pathname)) {
            url.pathname = url.pathname.slice(0, -1);
        }
        return url.toString();
    } catch {
        return endpoint;
    }
}

function urlDestination(service: string, value: string): string {
    const endpoint = servicesType.isAiSdk(service)
        ? canonicalOpenAICompatibleEndpoint(value)
        : canonicalFetchEndpoint(value);
    return `urls:${endpoint}`;
}

function tokenCredentialDestination(config: Config, service: string, customEndpoint: (service: string) => string): string {
    if (isCustomOpenAIProviderId(service)) {
        const proxy = config.proxy[service]?.trim();
        if (proxy) return urlDestination(service, proxy);
        const endpoint = customEndpoint(service) || (service === services.custom ? config.custom : '');
        return `urls:${canonicalOpenAICompatibleEndpoint(endpoint, true)}`;
    }
    const proxy = config.proxy[service]?.trim();
    if (proxy) return urlDestination(service, proxy);
    const officialEndpoint = urls[service];
    return typeof officialEndpoint === 'string' && officialEndpoint.trim()
        ? urlDestination(service, officialEndpoint)
        : `service:${service}`;
}

function createCustomEndpointLookup(config: Config): (service: string) => string {
    const providers = config.customOpenAIProviders ?? [];
    const indexed = new Map<string, (typeof providers)[number]>();
    let index = 0;
    return (service) => {
        if (indexed.has(service)) return indexed.get(service)!.endpoint || '';
        while (index < providers.length) {
            const provider = providers[index++]!;
            const id = provider.id;
            if (!indexed.has(id)) indexed.set(id, provider);
            if (id === service) return indexed.get(id)!.endpoint || '';
        }
        return '';
    };
}

export function dropCredentialsForChangedDestinations(
    credentials: ConfigCredentials,
    current: Config,
    next: Config,
    explicitlyBoundTokens: ReadonlySet<string> = new Set(),
    _explicitlyBoundCredentialFields: ReadonlySet<ConfigCredentialField> = new Set(),
    explicitlyBoundHeaders: ReadonlySet<string> = new Set(),
    explicitlyBoundApiKeys: ReadonlySet<string> = new Set(),
): ConfigCredentials {
    const changedDestinations = new Map<string, boolean>();
    const currentCustomEndpoint = createCustomEndpointLookup(current);
    const nextCustomEndpoint = createCustomEndpointLookup(next);
    const destinationChanged = (service: string): boolean => {
        const cached = changedDestinations.get(service);
        if (cached !== undefined) return cached;
        const changed = tokenCredentialDestination(current, service, currentCustomEndpoint)
            !== tokenCredentialDestination(next, service, nextCustomEndpoint);
        changedDestinations.set(service, changed);
        return changed;
    };
    const token = {...credentials.token};
    let tokenChanged = false;
    for (const service of Object.keys(token)) {
        if (!destinationChanged(service) || explicitlyBoundTokens.has(service)) continue;
        tokenChanged = true;
        delete token[service];
    }

    const apiKeys: Record<string, string[]> = Object.fromEntries(Object.entries(credentials.apiKeys)
        .map(([service, keys]) => [service, [...keys]]));
    let apiKeysChanged = false;
    for (const service of Object.keys(apiKeys)) {
        if (!destinationChanged(service) || explicitlyBoundApiKeys.has(service)) continue;
        delete apiKeys[service];
        apiKeysChanged = true;
    }
    let nextCredentials = tokenChanged || apiKeysChanged ? {...credentials, token, apiKeys} : credentials;
    const secret = {...credentials.secret};
    let secretChanged = false;
    for (const service of Object.keys(secret)) {
        if (!destinationChanged(service) || explicitlyBoundTokens.has(service)) continue;
        secretChanged = true;
        delete secret[service];
    }
    if (secretChanged) nextCredentials = {...nextCredentials, secret};
    const customHeaders = {...credentials.customHeaders};
    for (const service of Object.keys(customHeaders)) {
        if (!destinationChanged(service) || explicitlyBoundHeaders.has(service)) continue;
        delete customHeaders[service];
        nextCredentials = {...nextCredentials, customHeaders};
    }
    return nextCredentials;
}
