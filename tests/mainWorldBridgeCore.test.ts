import {describe, expect, it, vi} from 'vitest';
import {installShadowAndRouteBridge} from '@/src/platform/shadow-ui/pageBridge';
import {
    ROUTE_CHANGE_EVENT,
    SHADOW_BRIDGE_DISPOSE_EVENT,
    SHADOW_BRIDGE_ENABLE_EVENT,
    SHADOW_BRIDGE_LIFECYCLE_STATE_KEY,
    SHADOW_BRIDGE_STATE_KEY,
    SHADOW_ROOT_EVENT,
    installShadowRouteBridgeCore,
    installShadowRouteBridgeLifecycleCore,
    type AttachShadowPort,
    type BridgeEventTarget,
    type BridgeMethodSlot,
    type HistoryMutationPort,
} from '@/src/platform/shadow-ui/pageBridgeCore';

class FakeEvents implements BridgeEventTarget {
    readonly listeners = new Map<string, Set<(event?: {persisted?: boolean}) => void>>();
    readonly dispatched: unknown[] = [];

    addEventListener(type: string, listener: (event?: {persisted?: boolean}) => void): void {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: (event?: {persisted?: boolean}) => void): void {
        this.listeners.get(type)?.delete(listener);
    }

    dispatchEvent(event: unknown): boolean {
        this.dispatched.push(event);
        const type = (event as {type?: string})?.type;
        if (type) for (const listener of this.listeners.get(type) ?? []) listener();
        return true;
    }

    emit(type: string, event?: {persisted?: boolean}): void {
        for (const listener of [...this.listeners.get(type) ?? []]) listener(event);
    }
}

function slot<T extends (...args: never[]) => unknown>(initial: T) {
    let value = initial;
    let locked = false;
    const port: BridgeMethodSlot<T> = {
        get: () => value,
        set: (next) => {
            if (locked) throw new Error('locked');
            value = next;
        },
    };
    return {
        port,
        get value() { return value; },
        set value(next: T) { value = next; },
        lock: () => { locked = true; },
    };
}

function shadowFixture(withNavigation = true) {
    let href = 'https://example.test/start';
    const stateHost: Record<string, unknown> = {};
    const windowEvents = new FakeEvents();
    const documentEvents = new FakeEvents();
    const navigationEvents = new FakeEvents();
    const originalAttach = vi.fn(function originalAttach(this: unknown, init: unknown) {
        return {host: this, init, mode: (init as {mode: string}).mode};
    }) as unknown as AttachShadowPort;
    const originalPush = vi.fn(function originalPush(this: unknown, _data: unknown, _unused: string, url?: string | URL | null) {
        if (withNavigation) navigationEvents.emit('navigate');
        if (url) href = new URL(String(url), href).href;
        if (withNavigation) navigationEvents.emit('currententrychange');
        return this;
    }) as unknown as HistoryMutationPort;
    const originalReplace = vi.fn(function originalReplace(this: unknown, _data: unknown, _unused: string, url?: string | URL | null) {
        if (withNavigation) navigationEvents.emit('navigate');
        if (url) href = new URL(String(url), href).href;
        if (withNavigation) navigationEvents.emit('currententrychange');
        return this;
    }) as unknown as HistoryMutationPort;
    const attach = slot(originalAttach);
    const push = slot(originalPush);
    const replace = slot(originalReplace);
    const environment = {
        stateHost,
        attachShadow: attach.port,
        pushState: push.port,
        replaceState: replace.port,
        windowEvents,
        documentEvents,
        navigationEvents: withNavigation ? navigationEvents : undefined,
        getHref: () => href,
        createEvent: (type: string, init?: Record<string, unknown>) => ({type, ...init}),
    };
    return {attach, documentEvents, environment, navigationEvents, originalAttach, originalPush, originalReplace,
        push, replace, stateHost, windowEvents, setHref: (value: string) => { href = value; }};
}

async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe('ShadowRoot 与路由 MAIN world bridge core', () => {
    it('原始 XML 文档不安装 MAIN world 宿主方法补丁', () => {
        vi.stubGlobal('document', {contentType: 'text/xml'});
        try {
            const dispose = installShadowAndRouteBridge();
            expect(dispose).toBeTypeOf('function');
            expect(() => dispose()).not.toThrow();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('实际页面适配器发送可传播 CustomEvent 并在卸载时恢复宿主 API', async () => {
        const events = new FakeEvents(), documentEvents = new FakeEvents();
        const location = {href: 'https://example.test/start'};
        class ElementPort extends EventTarget {attachShadow(init: ShadowRootInit) {return {mode: init.mode};}}
        class CustomEventPort extends Event {readonly detail: unknown; constructor(type: string, init?: CustomEventInit) {super(type, init);this.detail = init?.detail;}}
        const originalAttach = ElementPort.prototype.attachShadow;
        const historyPort = {pushState(_data: unknown, _title: string, url: string) {location.href = new URL(url, location.href).href;}, replaceState() {}};
        const originalPush = historyPort.pushState;
        vi.stubGlobal('document', Object.assign(documentEvents, {contentType: 'text/html'}));
        vi.stubGlobal('window', events);vi.stubGlobal('history', historyPort);vi.stubGlobal('location', location);
        vi.stubGlobal('Element', ElementPort);vi.stubGlobal('CustomEvent', CustomEventPort);
        let dispose: (() => void) | undefined;
        try {
            dispose = installShadowAndRouteBridge();
            const host = new ElementPort();const seen: Event[] = [];
            host.addEventListener(SHADOW_ROOT_EVENT, event => seen.push(event));
            host.attachShadow({mode: 'open'});host.attachShadow({mode: 'closed'});
            expect(seen).toHaveLength(1);expect(seen[0]).toBeInstanceOf(CustomEventPort);
            expect(seen[0].bubbles).toBe(true);expect(seen[0].composed).toBe(true);
            historyPort.pushState(null, '', '/article');await flush();
            expect(documentEvents.dispatched.map(event => (event as Event).type)).toContain(ROUTE_CHANGE_EVENT);
        } finally {dispose?.();vi.unstubAllGlobals();}
        expect(ElementPort.prototype.attachShadow).toBe(originalAttach);expect(historyPort.pushState).toBe(originalPush);
    });

    it('透明转发宿主方法的真实参数数量，保留缺参异常及既有包装器语义', () => {
        const fixture = shadowFixture();
        const expectedError = new TypeError('2 arguments required');
        const originalHistory = vi.fn(function (this: unknown, ...args: unknown[]) {
            if (args.length < 2) throw expectedError;
            return {receiver: this, args};
        });
        const originalAttach = vi.fn(function (this: unknown, ...args: unknown[]) {
            return {receiver: this, args, mode: 'closed'};
        });
        fixture.push.value = originalHistory as HistoryMutationPort;
        fixture.replace.value = originalHistory as HistoryMutationPort;
        fixture.attach.value = originalAttach as AttachShadowPort;
        installShadowRouteBridgeCore(fixture.environment);
        const receiver = {dispatchEvent: vi.fn()};

        for (const method of [fixture.push.value, fixture.replace.value]) {
            for (const args of [[], [{}]]) {
                expect(() => Reflect.apply(method, receiver, args)).toThrow(expectedError);
            }
            for (const args of [[{}, ''], [{}, '', undefined], [{}, '', '/next', 'host metadata']]) {
                expect(Reflect.apply(method, receiver, args)).toEqual({receiver, args});
            }
        }
        const shadowArgs = [{mode: 'closed'}, 'host metadata'];
        expect(Reflect.apply(fixture.attach.value, receiver, shadowArgs)).toEqual({
            receiver, args: shadowArgs, mode: 'closed',
        });
    });

    it('发布 open ShadowRoot 与真实路由变化，并在卸载时恢复宿主 API', () => {
        const fixture = shadowFixture();
        const dispose = installShadowRouteBridgeCore(fixture.environment);
        expect(fixture.stateHost[SHADOW_BRIDGE_STATE_KEY]).toBeTruthy();

        const hostEvents: unknown[] = [];
        const host = {dispatchEvent: (event: unknown) => hostEvents.push(event)};
        const openRoot = fixture.attach.value.call(host, {mode: 'open'});
        fixture.attach.value.call(host, {mode: 'closed'});
        expect(openRoot).toMatchObject({host});
        expect(hostEvents).toEqual([{type: SHADOW_ROOT_EVENT, bubbles: true, composed: true}]);

        const historyHost = {};
        fixture.push.value.call(historyHost, {}, '', null);
        expect(fixture.documentEvents.dispatched).toHaveLength(0);
        expect(fixture.push.value.call(historyHost, {}, '', '/next')).toBe(historyHost);
        fixture.replace.value.call(historyHost, {}, '', '/final');
        fixture.setHref('https://example.test/next');
        fixture.windowEvents.emit('popstate');
        fixture.setHref('https://example.test/next#section');
        fixture.windowEvents.emit('hashchange');
        fixture.setHref('https://example.test/navigation-api');
        fixture.navigationEvents.emit('navigate');
        fixture.navigationEvents.emit('currententrychange');
        expect(fixture.documentEvents.dispatched.filter((event) => (event as {type: string}).type === ROUTE_CHANGE_EVENT))
            .toHaveLength(5);

        dispose();
        expect(fixture.attach.value).toBe(fixture.originalAttach);
        expect(fixture.push.value).toBe(fixture.originalPush);
        expect(fixture.replace.value).toBe(fixture.originalReplace);
        expect(fixture.stateHost[SHADOW_BRIDGE_STATE_KEY]).toBeUndefined();
        expect(fixture.windowEvents.listeners.get('popstate')?.size).toBe(0);
        expect(fixture.navigationEvents.listeners.get('currententrychange')?.size).toBe(0);
    });

    it('同页滚动状态和被取消的 navigate 不发布路由变化，真实提交只发布一次最新 URL', () => {
        const fixture = shadowFixture();
        installShadowRouteBridgeCore(fixture.environment);
        const urls: string[] = [];
        fixture.documentEvents.addEventListener(ROUTE_CHANGE_EVENT, () => urls.push(fixture.environment.getHref()));
        const historyHost = {};
        const scrollState = {scroll: 250};
        expect(fixture.replace.value.call(historyHost, scrollState, '')).toBe(historyHost);
        fixture.replace.value.call(historyHost, scrollState, '', 'https://example.test/start');
        fixture.push.value.call(historyHost, scrollState, '', '/start');
        fixture.navigationEvents.emit('navigate');
        fixture.navigationEvents.emit('currententrychange');
        fixture.windowEvents.emit('popstate');
        fixture.windowEvents.emit('hashchange');
        expect(urls).toEqual([]);
        expect(fixture.originalReplace).toHaveBeenCalledWith(scrollState, '');

        fixture.push.value.call(historyHost, {}, '', '/article?lang=en#intro');
        fixture.navigationEvents.emit('currententrychange');
        fixture.windowEvents.emit('popstate');
        fixture.windowEvents.emit('hashchange');
        expect(urls).toEqual(['https://example.test/article?lang=en#intro']);
        fixture.replace.value.call(historyHost, {}, '', '#details');
        expect(urls).toEqual(['https://example.test/article?lang=en#intro', 'https://example.test/article?lang=en#details']);
    });

    it('缺少 Navigation API 时 history 与遍历继续生效，卸载后不再发布', () => {
        const fixture = shadowFixture(false);
        const dispose = installShadowRouteBridgeCore(fixture.environment);
        fixture.push.value.call({}, {}, '', '/next');
        fixture.replace.value.call({}, {}, '', '/final');
        fixture.setHref('https://example.test/start');
        fixture.windowEvents.emit('popstate');
        expect(fixture.documentEvents.dispatched).toHaveLength(3);
        dispose();
        fixture.push.value.call({}, {}, '', '/disposed');
        fixture.windowEvents.emit('popstate');
        fixture.navigationEvents.emit('currententrychange');
        expect(fixture.documentEvents.dispatched).toHaveLength(3);
    });

    it('重复安装先卸载旧 owner，旧 disposer 不会破坏新桥', () => {
        const fixture = shadowFixture(false);
        const firstDispose = installShadowRouteBridgeCore(fixture.environment);
        const firstWrapper = fixture.attach.value;
        const secondDispose = installShadowRouteBridgeCore(fixture.environment);
        expect(fixture.attach.value).not.toBe(firstWrapper);
        firstDispose();
        expect(fixture.attach.value).not.toBe(fixture.originalAttach);
        fixture.documentEvents.emit(SHADOW_BRIDGE_DISPOSE_EVENT);
        expect(fixture.attach.value).toBe(fixture.originalAttach);
        secondDispose();
    });

    it('只读或后来锁定/替换的方法不阻断安装与安全卸载', () => {
        const fixture = shadowFixture();
        fixture.attach.lock();
        const dispose = installShadowRouteBridgeCore(fixture.environment);
        expect(fixture.attach.value).toBe(fixture.originalAttach);
        fixture.push.lock();
        fixture.replace.value = fixture.originalReplace;
        expect(() => dispose()).not.toThrow();
        expect(fixture.windowEvents.listeners.get('hashchange')?.size).toBe(0);
    });

    it('站点禁用恢复宿主 API，重新启用只安装一层 wrapper', () => {
        const fixture = shadowFixture();
        const firstLifecycleDispose = installShadowRouteBridgeLifecycleCore(fixture.environment);
        const firstWrapper = fixture.attach.value;
        const disposeLifecycle = installShadowRouteBridgeLifecycleCore(fixture.environment);
        firstLifecycleDispose();
        expect(fixture.attach.value).not.toBe(fixture.originalAttach);
        expect(fixture.stateHost[SHADOW_BRIDGE_LIFECYCLE_STATE_KEY]).toBeTruthy();

        fixture.documentEvents.emit(SHADOW_BRIDGE_DISPOSE_EVENT);
        expect(fixture.attach.value).toBe(fixture.originalAttach);
        fixture.documentEvents.emit(SHADOW_BRIDGE_ENABLE_EVENT);
        const restoredWrapper = fixture.attach.value;
        expect(restoredWrapper).not.toBe(firstWrapper);
        fixture.documentEvents.emit(SHADOW_BRIDGE_ENABLE_EVENT);
        expect(fixture.attach.value).toBe(restoredWrapper);

        disposeLifecycle();
        expect(fixture.attach.value).toBe(fixture.originalAttach);
        expect(fixture.stateHost[SHADOW_BRIDGE_LIFECYCLE_STATE_KEY]).toBeUndefined();
        fixture.documentEvents.emit(SHADOW_BRIDGE_ENABLE_EVENT);
        expect(fixture.attach.value).toBe(fixture.originalAttach);
    });

    it('脚本管理器代理拒绝删除桥状态时仍能停用和重新启用', () => {
        const fixture = shadowFixture();
        const host = new Proxy(fixture.stateHost, {
            deleteProperty: () => false,
        });
        fixture.environment.stateHost = host;
        const dispose = installShadowRouteBridgeLifecycleCore(fixture.environment);
        expect(host[SHADOW_BRIDGE_STATE_KEY]).toBeTruthy();
        fixture.documentEvents.emit(SHADOW_BRIDGE_DISPOSE_EVENT);
        expect(host[SHADOW_BRIDGE_STATE_KEY]).toBeUndefined();
        fixture.documentEvents.emit(SHADOW_BRIDGE_ENABLE_EVENT);
        expect(host[SHADOW_BRIDGE_STATE_KEY]).toBeTruthy();
        expect(() => dispose()).not.toThrow();
        expect(host[SHADOW_BRIDGE_STATE_KEY]).toBeUndefined();
        expect(host[SHADOW_BRIDGE_LIFECYCLE_STATE_KEY]).toBeUndefined();
        expect(fixture.attach.value).toBe(fixture.originalAttach);
    });

    it('宿主代理同时拒绝删除和清空状态时仍恢复原始 API', () => {
        const fixture = shadowFixture(false);
        const stateHost = new Proxy(fixture.stateHost, {
            deleteProperty: () => { throw new Error('delete denied'); },
            set(target, key, value) {
                if (value === undefined) throw new Error('write denied');
                return Reflect.set(target, key, value);
            },
        });
        fixture.environment.stateHost = stateHost;
        const dispose = installShadowRouteBridgeCore(fixture.environment);

        expect(() => dispose()).not.toThrow();
        expect(fixture.attach.value).toBe(fixture.originalAttach);
        expect(fixture.push.value).toBe(fixture.originalPush);
        expect(fixture.replace.value).toBe(fixture.originalReplace);
        expect(fixture.windowEvents.listeners.get('popstate')?.size).toBe(0);
    });

    it('宿主后来包装我们的 API 时保留宿主包装，但禁用旧桥通知且恢复后只通知一次', () => {
        const fixture = shadowFixture(false);
        const dispose = installShadowRouteBridgeLifecycleCore(fixture.environment);
        const retainedAttach = fixture.attach.value;
        const retainedPush = fixture.push.value;
        const retainedReplace = fixture.replace.value;
        const pageAttach: AttachShadowPort = function (init) {
            return retainedAttach.call(this, init);
        };
        const pagePush: HistoryMutationPort = function (data, unused, url) {
            return retainedPush.call(this, data, unused, url);
        };
        const pageReplace: HistoryMutationPort = function (data, unused, url) {
            return retainedReplace.call(this, data, unused, url);
        };
        fixture.attach.value = pageAttach;
        fixture.push.value = pagePush;
        fixture.replace.value = pageReplace;
        const host = {dispatchEvent: vi.fn()};

        fixture.documentEvents.emit(SHADOW_BRIDGE_DISPOSE_EVENT);
        expect(fixture.attach.value).toBe(pageAttach);
        expect(fixture.push.value).toBe(pagePush);
        expect(fixture.replace.value).toBe(pageReplace);
        expect(fixture.attach.value.call(host, {mode: 'open'})).toMatchObject({host, mode: 'open'});
        fixture.push.value.call({}, {}, '', '/while-disabled');
        fixture.replace.value.call({}, {}, '', '/also-disabled');
        expect(host.dispatchEvent).not.toHaveBeenCalled();
        expect(fixture.documentEvents.dispatched).toHaveLength(0);

        fixture.documentEvents.emit(SHADOW_BRIDGE_ENABLE_EVENT);
        fixture.attach.value.call(host, {mode: 'open'});
        fixture.push.value.call({}, {}, '', '/enabled');
        fixture.replace.value.call({}, {}, '', '/enabled-replace');
        expect(host.dispatchEvent).toHaveBeenCalledOnce();
        expect(fixture.documentEvents.dispatched).toHaveLength(2);

        dispose();
        fixture.attach.value.call(host, {mode: 'open'});
        fixture.push.value.call({}, {}, '', '/finally-disposed');
        expect(host.dispatchEvent).toHaveBeenCalledOnce();
        expect(fixture.documentEvents.dispatched).toHaveLength(2);
    });
});

describe('宿主 API 调用语义', () => {
    it('只让原生 attachShadow 读取一次 mode getter，桥通知失败仍返回原生 root', () => {
        const fixture = shadowFixture();
        installShadowRouteBridgeCore(fixture.environment);
        let reads = 0;
        const init = {get mode() {
            if (++reads > 1) throw new Error('重复读取 mode');
            return 'open';
        }};
        const host = {dispatchEvent: vi.fn(() => { throw new Error('宿主事件 API 故障'); })};
        expect(fixture.attach.value.call(host, init)).toMatchObject({mode: 'open', host});
        expect(reads).toBe(1);
        expect(host.dispatchEvent).toHaveBeenCalledOnce();
    });

    it('原生 attachShadow 错误仍原样抛出，导航附加通知错误不影响成功返回', () => {
        const fixture = shadowFixture(false);
        installShadowRouteBridgeCore(fixture.environment);
        const error = new Error('原生失败');
        expect(() => fixture.attach.value.call({dispatchEvent() {}}, {
            get mode(): string { throw error; },
        })).toThrow(error);
        fixture.documentEvents.dispatchEvent = () => { throw new Error('通知失败'); };
        const receiver = {};
        expect(fixture.push.value.call(receiver, {}, '', '/next')).toBe(receiver);
        expect(fixture.replace.value.call(receiver, {}, '', '/other')).toBe(receiver);
        expect(fixture.environment.getHref()).toBe('https://example.test/other');
    });
});
