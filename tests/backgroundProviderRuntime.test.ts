import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ConnectionTestUsageOptions} from '@/src/providers/translation/connectionTest';
import {createBackgroundMessageRouter} from '@/src/services/messaging/backgroundRouter';
import {CONNECTION_TEST_MESSAGE_TYPE} from '@/src/app/background/handlers/connectionTest';

const mocks = vi.hoisted(() => ({
    resolveConfiguredModel: vi.fn((_selected?: string, _custom?: string) => 'resolved-model'),
    runConnectionTest: vi.fn(async (_service: string, _options: ConnectionTestUsageOptions) => ({durationMs: 25})),
    formatError: vi.fn((service: string, error: unknown) => `${service}:${error instanceof Error ? error.message : String(error)}`),
    ready: Promise.resolve() as Promise<void>,
    config: {model: {deepseek: 'deepseek-flash'}, customModel: {deepseek: ''}, token: {deepseek: 'fixture-key'}},
}));

vi.mock('@/src/providers/translation/connectionTest', () => ({
    formatConnectionTestError: mocks.formatError,
    runTranslationServiceConnectionTest: mocks.runConnectionTest,
}));
vi.mock('@/src/app/translation/runtime', () => ({
    translateWithCache: vi.fn(async () => 'UNKNOWN'),
    translationRequestScheduler: {
        schedule: vi.fn(async (task: (lease: any) => Promise<unknown>) => task({holdUntil: vi.fn()})),
    },
}));
vi.mock('@/src/services/translation/broker', () => ({
    resolveTranslationRequestModel: vi.fn(() => 'resolved-model'),
}));
vi.mock('@/src/services/config/store', async () => {
    const {Config} = await import('@/src/core/config/model');
    Object.assign(mocks.config, new Config(), {model: {deepseek: 'deepseek-flash'}, customModel: {deepseek: ''}, token: {deepseek: 'fixture-key'}});
    return {
        configReady: {then: (yes: (value: void) => unknown, no: (error: unknown) => unknown) => mocks.ready.then(yes, no)},
        config: mocks.config,
    };
});
vi.mock('@/src/core/config/catalog', async importOriginal => {
    const original = await importOriginal<typeof import('@/src/core/config/catalog')>();
    return {...original, resolveConfiguredModel: mocks.resolveConfiguredModel,
        servicesType: {...original.servicesType, isAiSdk: vi.fn(() => false)}};
});

import {createProviderTestRuntimeHandlers, runTranslationServiceConnectionTestWithScheduler} from '@/src/app/background/providerRuntime';

describe('background provider runtime', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.ready = Promise.resolve();
        mocks.config.token.deepseek = 'fixture-key';
        mocks.runConnectionTest.mockReset().mockResolvedValue({durationMs: 25});
        vi.stubGlobal('browser', {runtime: {getURL: (path: string) => `chrome-extension://provider-fixture${path}`}});
    });
    afterEach(() => vi.unstubAllGlobals());

    it('runs connection test with scheduler and configured model', async () => {
        await expect(runTranslationServiceConnectionTestWithScheduler('deepseek'))
            .resolves.toEqual({durationMs: 25});

        const options = mocks.runConnectionTest.mock.calls[0][1];
        expect(options.configuredModel).toBe('resolved-model');
    });

    it('dispatches connection test messages through the public assembly only after shared config readiness', async () => {
        let ready!: () => void;
        mocks.ready = new Promise<void>(resolve => {ready = resolve;});
        const handlers = createProviderTestRuntimeHandlers();
        expect(handlers.map(handler => handler.type)).toEqual([CONNECTION_TEST_MESSAGE_TYPE]);
        const router = createBackgroundMessageRouter(handlers);
        const connection = router.dispatch({type: CONNECTION_TEST_MESSAGE_TYPE, service: 'deepseek', keyIndex: 2, keyRevision: 'a'.repeat(64)}, {});
        for (let i = 0; i < 5; i += 1) await Promise.resolve();
        expect(mocks.runConnectionTest).not.toHaveBeenCalled();
        ready();
        await expect(connection).resolves.toEqual({handled: true, response: {success: true, durationMs: 25}});
        expect(mocks.runConnectionTest).toHaveBeenCalledWith('deepseek', expect.objectContaining({keyIndex: 2, keyRevision: 'a'.repeat(64),
            configuredModel: 'resolved-model', effectiveModel: 'resolved-model', config: expect.objectContaining({token: {deepseek: 'fixture-key'}})}));
    });

    it('classifies legacy provider failures through the assembled route without exposing raw formatter output', async () => {
        const failure = new Error('provider unavailable: fixture-private-endpoint');
        mocks.runConnectionTest.mockRejectedValueOnce(failure);
        const router = createBackgroundMessageRouter(createProviderTestRuntimeHandlers());
        await expect(router.dispatch({type: CONNECTION_TEST_MESSAGE_TYPE, service: 'deepseek'}, {}))
            .resolves.toEqual({handled: true, response: {success: false, error: '翻译未完成', diagnostic: {
                code: 'unknown', titleKey: 'diagnostics.unknown.title', detailKey: 'diagnostics.unknown.detail',
                actions: ['retry', 'services', 'dismiss'],
            }}});
    });
});
