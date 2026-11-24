import {describe, expect, it, vi} from 'vitest';
import {withProviderSnapshot} from './helpers/providerSnapshot';

vi.mock('webextension-polyfill', () => ({default: {storage: {
    session: {get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined)},
    onChanged: {addListener: vi.fn(), removeListener: vi.fn()},
}}}));

// 注册表测试只需核对适配器身份，避免在 Node 环境启动 WXT 存储监听。
vi.mock('@/src/services/config/store', () => ({config: {}}));
import {services} from '@/src/core/config/catalog';
import {translationProviderRegistry} from '@/src/providers/translation/registry';
import {AI_SDK_SERVICE_IDS} from '@/src/providers/translation/ai-sdk/endpoints';
import {translateWithOpenAICompatibleAiSdk} from '@/src/providers/translation/ai-sdk/openai-compatible';

describe('translation provider registry', () => {
    it('精简版仅注册保留的 5 个公开翻译服务适配器', () => {
        expect(Object.keys(translationProviderRegistry).sort()).toEqual(
            ['custom', 'deepseek', 'google', 'microsoft', 'openrouter'],
        );
        expect(Object.keys(translationProviderRegistry).sort()).toEqual(Object.values(services).sort());
    });

    it('AI SDK 服务共享统一 transport', () => {
        expect([...AI_SDK_SERVICE_IDS].sort()).toEqual(['custom', 'openrouter']);
        for (const service of AI_SDK_SERVICE_IDS) {
            expect(translationProviderRegistry[service]).toBe(translateWithOpenAICompatibleAiSdk);
        }
    });

    it('单条适配器在网络之前拒绝数组，原生数组适配器要求可信配置快照', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        try {
            await expect(translationProviderRegistry[services.deepseek]({origin: ['first', 'second']}))
                .rejects.toThrow('仅支持单条文本请求');
            await expect(translationProviderRegistry[services.microsoft]({origin: 'Hello'}))
                .rejects.toMatchObject({code: 'TRANSLATION_PROVIDER_CONFIG_REQUIRED'});
            expect(fetch).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('DeepSeek 注册包装保留快照及取消 signal', async () => {
        const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({
            choices: [{message: {content: '你好'}}],
        }));
        const controller = new AbortController();
        vi.stubGlobal('fetch', fetch);
        try {
            const request = withProviderSnapshot({origin: 'Hello', abortSignal: controller.signal}, {
                service: services.deepseek,
                from: 'en',
                to: 'zh-Hans',
                deepseekApiType: 'chat',
                token: {[services.deepseek]: 'fixture-key'},
                model: {[services.deepseek]: 'deepseek-flash'},
            });
            await expect(translationProviderRegistry[services.deepseek](request)).resolves.toBe('你好');
            expect(fetch).toHaveBeenCalledOnce();
            expect(fetch.mock.calls[0][1]?.signal).toBe(controller.signal);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
