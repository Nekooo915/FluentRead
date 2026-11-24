import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const ports = vi.hoisted(() => ({cleanup: vi.fn()}));
vi.mock('@/src/app/translation/runtime', () => ({cleanupTranslationCache: ports.cleanup}));
import {installBackgroundMaintenance} from '@/src/app/background/maintenanceRuntime';
import {TRANSLATION_CACHE_CLEANUP_ALARM} from '@/src/app/background/cacheCleanup';
import {RETIRED_DYNAMIC_CONTENT_SCRIPT_IDS} from '@/src/app/background/retiredContentScripts';

type Listener = (alarm: {name: string}) => void;
function browserFixture(scripting?: {getRegisteredContentScripts: ReturnType<typeof vi.fn>; unregisterContentScripts: ReturnType<typeof vi.fn>}) {
    const listeners: Listener[] = [];
    const alarms = {onAlarm: {addListener: (listener: Listener) => listeners.push(listener)}, get: vi.fn(async () => undefined), create: vi.fn(async () => undefined)};
    vi.stubGlobal('browser', {alarms, ...(scripting ? {scripting} : {})});
    return {alarms, listeners, fire: (name: string) => listeners.forEach(listener => listener({name}))};
}
beforeEach(() => {
    ports.cleanup.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('background maintenance composition', () => {
    it('installs cache cleanup maintenance without scripting and triggers on named alarm only', async () => {
        const f = browserFixture();
        installBackgroundMaintenance();
        await vi.waitFor(() => expect(ports.cleanup).toHaveBeenCalledOnce());
        expect(f.listeners).toHaveLength(1);
        await vi.waitFor(() => expect(f.alarms.create).toHaveBeenCalledWith(TRANSLATION_CACHE_CLEANUP_ALARM, {delayInMinutes: 1, periodInMinutes: 1440}));
        f.fire('unrelated');
        await Promise.resolve();
        expect(ports.cleanup).toHaveBeenCalledOnce();
        f.fire(TRANSLATION_CACHE_CLEANUP_ALARM);
        await vi.waitFor(() => expect(ports.cleanup).toHaveBeenCalledTimes(2));
    });
    it('removes only the registered retired script and leaves cache cleanup alarm active', async () => {
        const retired = RETIRED_DYNAMIC_CONTENT_SCRIPT_IDS[0];
        const scripting = {getRegisteredContentScripts: vi.fn(async () => [{id: 'other'}, {id: retired}, {id: retired}]), unregisterContentScripts: vi.fn(async () => undefined)};
        const f = browserFixture(scripting);
        installBackgroundMaintenance();
        await vi.waitFor(() => expect(scripting.unregisterContentScripts).toHaveBeenCalledWith({ids: [retired]}));
        expect(scripting.getRegisteredContentScripts).toHaveBeenCalledWith({ids: [retired]});
        await vi.waitFor(() => expect(f.alarms.create).toHaveBeenCalledOnce());
        expect(ports.cleanup).toHaveBeenCalledOnce();
    });
    it.each(['lookup', 'unregister'] as const)('reports retired-script %s failure without blocking alarms or future cleanup', async where => {
        const error = new Error(`${where} unavailable`), warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const scripting = {getRegisteredContentScripts: vi.fn(async () => [{id: RETIRED_DYNAMIC_CONTENT_SCRIPT_IDS[0]}]), unregisterContentScripts: vi.fn(async () => undefined)};
        if (where === 'lookup') scripting.getRegisteredContentScripts.mockRejectedValueOnce(error); else scripting.unregisterContentScripts.mockRejectedValueOnce(error);
        const f = browserFixture(scripting);
        installBackgroundMaintenance();
        await vi.waitFor(() => expect(warn).toHaveBeenCalledWith('[FluentRead] 清理退役动态内容脚本失败', error));
        await vi.waitFor(() => expect(f.alarms.create).toHaveBeenCalledOnce());
        f.fire(TRANSLATION_CACHE_CLEANUP_ALARM);
        await vi.waitFor(() => expect(ports.cleanup).toHaveBeenCalledTimes(2));
    });
    it('reports cache failure and retries on next alarm', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = browserFixture();
        ports.cleanup.mockRejectedValueOnce(new Error('cache failure'));
        installBackgroundMaintenance();
        await vi.waitFor(() => expect(warn).toHaveBeenCalledWith('[FluentRead] 翻译缓存清理失败，将在下次维护时重试'));
        await vi.waitFor(() => expect(f.alarms.create).toHaveBeenCalledOnce());
        f.fire(TRANSLATION_CACHE_CLEANUP_ALARM);
        await vi.waitFor(() => expect(ports.cleanup).toHaveBeenCalledTimes(2));
    });
});
