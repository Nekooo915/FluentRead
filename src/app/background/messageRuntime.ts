/**
 * @file src/app/background/messageRuntime.ts
 * 文件职责：构建并安装精简版后台消息总运行时，把配置、翻译、缓存、Popup 导航、全文状态、邮件/嵌入帧桥接与连接测试 handler 连接到 browser.runtime。
 * 主要内容：装配精简后的类型化消息 router 与浏览器生命周期监听，仅服务保留的 5 类翻译服务与全文/悬浮球/视频字幕核心能力。
 * 模块边界：本文件是 composition root，只决定依赖装配和监听生命周期，不实现业务算法、provider 协议或存储事务。
 */
import {createProviderTestRuntimeHandlers} from './providerRuntime';
import {clearTranslationCache, getTranslationCacheStats, translateWithCache} from '@/src/app/translation/runtime';
import {serializeTranslationError} from '@/src/services/translation/errors';
import {createBackgroundMessageRouter, createBackgroundRuntimeMessageListener, type BackgroundMessageHandler} from '@/src/services/messaging/backgroundRouter';
import {createTranslationCacheHandlers, createTranslationCacheInvalidationBroadcaster} from './handlers/translationCache';
import {
    createFullPageTranslationStateHandlers, createQqMailFrameBackgroundHandlers,
} from './handlers/fullPageTranslationState';
import {createNeteaseMailFrameBackgroundHandlers} from '@/src/features/full-page-translation/background/neteaseMailFrameHandlers';
import {createPopupNavigationHandlers} from './popupNavigation';
import {createTranslationCancelHandler, createTranslationRequestFallback, createTranslationRequestRegistry} from './handlers/translation';
import {isBrowserTabId} from './tabTranslationState';
import {browserCapabilities} from '@/src/platform/browser/capabilities';
import {createConfigBackgroundHandlers} from './configMessageHandlers';
import {installBrowserConfigStorageBroadcast, installBrowserTabBroadcastRuntime} from './configStorageRuntime';
import {createEmbeddedFrameBackgroundHandlers} from '@/src/features/full-page-translation/background/embeddedFrameHandlers';
import type {BackgroundRuntimeContext, BackgroundMessageRuntimeOptions} from './messageRuntimeTypes';
export type {BackgroundMessageRuntimeOptions} from './messageRuntimeTypes';

export function installBackgroundMessageRuntime(options: BackgroundMessageRuntimeOptions): void {
    const capabilities = options.capabilities ?? browserCapabilities;
    const tabBroadcast = installBrowserTabBroadcastRuntime(capabilities.browser);
    const translationRequestRegistry = createTranslationRequestRegistry();
    const handlers: Array<BackgroundMessageHandler<BackgroundRuntimeContext>> = [
        createTranslationCancelHandler(translationRequestRegistry),
        ...createQqMailFrameBackgroundHandlers({sendTabMessage: (tabId, message, opts) => browser.tabs.sendMessage(tabId, message, opts)}),
        ...createEmbeddedFrameBackgroundHandlers({sendTabMessage: (tabId, message, opts) => browser.tabs.sendMessage(tabId, message, opts)}),
        ...createNeteaseMailFrameBackgroundHandlers({sendTabMessage: (tabId, message, opts) => browser.tabs.sendMessage(tabId, message, opts)}),
        ...createTranslationCacheHandlers(clearTranslationCache, getTranslationCacheStats, createTranslationCacheInvalidationBroadcaster({
            ...tabBroadcast,
            warn: (message, error) => console.warn(message, error),
        })),
        ...createConfigBackgroundHandlers<BackgroundRuntimeContext>(tabBroadcast.registerContentReceiver),
        ...createProviderTestRuntimeHandlers(),
        ...createPopupNavigationHandlers(),
        ...createFullPageTranslationStateHandlers({
            stateStore: options.tabTranslationStates,
            isTabId: isBrowserTabId,
            onStateChanged: options.onFullPageStateChanged,
        }),
    ];
    const router = createBackgroundMessageRouter(handlers,
        createTranslationRequestFallback({
            translate: translateWithCache,
            serializeError: serializeTranslationError,
            requestRegistry: translationRequestRegistry,
        }),
    );
    const listener = createBackgroundRuntimeMessageListener(router, (sender) => ({sender}) as BackgroundRuntimeContext);
    browser.runtime.onMessage.addListener(listener);
    installBrowserConfigStorageBroadcast(tabBroadcast);
}
