import {afterEach, beforeEach, expect, it, vi} from 'vitest';

const routes = vi.hoisted(() => ({mail: vi.fn(), netease: vi.fn(), embedded: vi.fn()}));
vi.mock('@/src/app/content/qqMailFrameRuntime', () => ({startQqMailFrameApp: routes.mail, startNeteaseMailFrameApp: routes.netease}));
vi.mock('@/src/app/content/embeddedFrameRuntime', () => ({startEmbeddedFrameApp: routes.embedded}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('defineContentScript', (entry: unknown) => entry);
});

afterEach(() => vi.unstubAllGlobals());

it('共用入口只覆盖受支持的四类 frame，并按主机委托到对应运行时', async () => {
    const entry = (await import('../entrypoints/supportedFrame.content')).default;
    expect(entry.matches).toEqual([
        'https://*.hf.space/*',
        'https://disqus.com/embed/comments/*',
        'https://www.kaggleusercontent.com/kf/*/__results__.html*',
        'https://mail.qq.com/cgi-bin/readmail*',
    ]);
    expect(entry.allFrames).toBe(true);
    expect(entry.matchAboutBlank).toBeUndefined();
    expect(entry.runAt).toBe('document_end');
    expect(entry.cssInjectionMode).toBe('ui');

    const context = {id: 'frame-context'} as never;
    vi.stubGlobal('window', {location: {hostname: 'mail.qq.com'}});
    await entry.main(context);
    expect(routes.mail).toHaveBeenCalledOnce();
    expect(routes.mail).toHaveBeenCalledWith(context);
    expect(routes.embedded).not.toHaveBeenCalled();

    routes.mail.mockClear();
    for (const hostname of ['disqus.com', 'www.kaggleusercontent.com', 'fineenvs-rl-explorer.hf.space']) {
        vi.stubGlobal('window', {location: {hostname}});
        await entry.main(context);
    }
    expect(routes.embedded).toHaveBeenCalledTimes(3);
    expect(routes.mail).not.toHaveBeenCalled();
    expect(routes.netease).not.toHaveBeenCalled();
});

it('网易入口保留独立主机、about:blank 和 UI 样式策略', async () => {
    const entry = (await import('../entrypoints/neteaseMailFrame.content')).default;
    expect(entry.matches).toEqual(['https://*.mail.163.com/*', 'https://*.mail.126.com/*', 'https://*.mail.yeah.net/*']);
    expect(entry.allFrames).toBe(true);
    expect(entry.matchAboutBlank).toBe(true);
    expect(entry.runAt).toBe('document_end');
    expect(entry.cssInjectionMode).toBe('ui');
    const context = {id: 'netease-frame-context'} as never;
    const pending = Promise.resolve();
    routes.netease.mockReturnValueOnce(pending);
    expect(entry.main(context)).toBe(pending);
    await pending;
    expect(routes.netease).toHaveBeenCalledOnce();
    expect(routes.mail).not.toHaveBeenCalled();
    expect(routes.embedded).not.toHaveBeenCalled();
});
