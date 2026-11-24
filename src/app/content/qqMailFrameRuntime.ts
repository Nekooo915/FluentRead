/**
 * @file src/app/content/qqMailFrameRuntime.ts
 * 文件职责：为受支持邮箱的正文 frame 组装翻译，并把全文手势交给顶层会话。
 * 主要内容：通过既有配置订阅即时重排网页双语与仅译文工件，不重发翻译请求；按已水合的全局字体偏好同步已授权 frame，顶层会话快照不覆盖全局选择；QQ 旧版与网易免费邮箱各自使用受限消息协议，共享无凭据会话及字体诊断快照、样式和键盘生命周期；网易入口显式传入划词 UI 端口，避免 QQ 共用入口静态引入未使用的 Vue 样式；真实阅读路由变化同步失效上下文与请求提交代次，同地址通知不重复清理。
 * 模块边界：只在经过后台认证的阅读 frame 激活，不挂载悬浮球等顶层 UI；翻译请求与异步状态由共享 feature 承担。
 */
import {installContentPageLifecycle} from './pageLifecycle';
import type {ContentScriptContext} from 'wxt/utils/content-script-context';
import {config, configReady, subscribeConfig} from '@/src/services/config/store';
import {ensureUiLanguageBundle} from '@/src/platform/i18n/uiLanguageBundles';
import {addRuntimeMessageListener} from '@/src/platform/browser/runtimeMessages';
import {isExtensionDisabledOnSite} from '@/src/features/site-rules/domain';
import {createFrameSessionController} from '@/src/features/full-page-translation/content/frameSession';
import {isQqMailLegacyTopUrl, isQqMailReadmailUrl} from '@/src/features/full-page-translation/qqMailFrames';
import {
    isNeteaseMailChildUrl, isNeteaseMailReadUrl, isNeteaseMailTopUrl,
    NETEASE_MAIL_FRAME_CHANGED_MESSAGE_TYPE, NETEASE_MAIL_FRAME_COMMAND_MESSAGE_TYPE,
    NETEASE_MAIL_FRAME_REFRESH_MESSAGE_TYPE, NETEASE_MAIL_FRAME_REQUEST_MESSAGE_TYPE,
} from '@/src/features/full-page-translation/neteaseMailFrames';
import {
    autoTranslateEnglishPage, getFullPageTranslationFrameState,
    invalidateFullPageTranslationSessionCache, restoreOriginalContent, resetFullPageTranslationRouteState, createPageTranslationDisplayModeSync,
    type PageTranslationInvocation,
} from '@/src/features/full-page-translation/public';
import {cancelAllTranslations} from '@/src/services/translation/client';
import {resetPageTranslationContextCache} from '@/src/services/translation/context';
import {createContentHotkeyRuntime} from './hotkeyRuntime';
import {installPageStyles} from './pageStyles';
import {syncBilingualSentenceHighlight} from './bilingualSentenceHighlight';
import {applyCoreTranslationPreferences, createContentSiteAdaptationRuntime} from './siteAdaptationRuntime';
import {officialSiteRuleUpdatesEnabled, readOfficialSiteRuleRelease} from '@/src/services/site-adaptation/officialClient';
import {createPageTranslationFontRuntime} from './pageTranslationFont';

type MailFrameKind = 'qq' | 'netease';
const messageTypes = {
    qq: {changed: 'qqMailFrameChanged', command: 'qqMailFrameCommand', refresh: 'qqMailFrameRefresh', request: 'qqMailFrameRequest'},
    netease: {changed: NETEASE_MAIL_FRAME_CHANGED_MESSAGE_TYPE, command: NETEASE_MAIL_FRAME_COMMAND_MESSAGE_TYPE,
        refresh: NETEASE_MAIL_FRAME_REFRESH_MESSAGE_TYPE, request: NETEASE_MAIL_FRAME_REQUEST_MESSAGE_TYPE},
} as const;

/** 顶层消息仅通过扩展后台到达；页面事件只提示读取真实会话，不能设置快照。 */
function installMailTopFrameBridge(kind: MailFrameKind, isEnabled: () => boolean, signal: AbortSignal,
    readBrowserDefaultFont?: () => boolean): ((invocation?: PageTranslationInvocation) => void) | undefined {
    if (!(kind === 'qq' ? isQqMailLegacyTopUrl(window.location.href) : isNeteaseMailTopUrl(window.location.href))) return;
    const messages = messageTypes[kind];
    const available = () => isEnabled() && (kind === 'qq' || isNeteaseMailReadUrl(window.location.href));
    const notify = () => {
        try { void browser.runtime.sendMessage({type: messages.changed}).catch(() => undefined); }
        catch { /* 扩展更新使 runtime 同步失效时，文档恢复仍须完成。 */ }
    };
    const toggle = (invocation?: PageTranslationInvocation) => {
        if (!available()) return;
        const current = getFullPageTranslationFrameState();
        const snapshot = current.translationConfig;
        const sameProfile = invocation && snapshot && Object.entries(invocation).every(([key, value]) =>
            value === (key === 'fullPageMode' ? current.fullPageMode : key === 'scope' ? current.scope : snapshot[key as keyof typeof snapshot]));
        const stop = current.sessionId !== null && (!invocation || sameProfile);
        restoreOriginalContent();
        if (!stop) autoTranslateEnglishPage(invocation);
    };
    const listener = (message: any, sender: any, respond: (value: unknown) => void): boolean => {
        if (message?.type !== messages.command || sender?.id !== browser.runtime.id) return false;
        if (message.action !== 'state' && message.action !== 'toggle') return false;
        if (message.action === 'toggle') toggle(message.invocation);
        respond({...getFullPageTranslationFrameState(), enabled: available(),
            ...(readBrowserDefaultFont ? {browserDefaultFont: readBrowserDefaultFont()} : {})});
        return true;
    };
    const removeMessageListener = addRuntimeMessageListener(browser.runtime, listener);
    signal.addEventListener('abort', removeMessageListener, {once: true});
    document.addEventListener('fluentread-translation-started', notify, {signal});
    document.addEventListener('fluentread-translation-ended', notify, {signal});
    document.addEventListener('fluentread-page-translation-font-changed', notify, {signal});
    if (kind === 'netease') {
        const routeChanged = () => {
            if (!isNeteaseMailReadUrl(window.location.href)) restoreOriginalContent();
            notify();
        };
        window.addEventListener('hashchange', routeChanged, {signal});
        document.addEventListener('fluentread-route-change', routeChanged, {signal});
    }
    notify();
    return toggle;
}

export function installQqMailTopFrameBridge(isEnabled: () => boolean, signal: AbortSignal,
    readBrowserDefaultFont?: () => boolean): ((invocation?: PageTranslationInvocation) => void) | undefined {
    return installMailTopFrameBridge('qq', isEnabled, signal, readBrowserDefaultFont);
}

export function installNeteaseMailTopFrameBridge(isEnabled: () => boolean, signal: AbortSignal,
    readBrowserDefaultFont?: () => boolean): ((invocation?: PageTranslationInvocation) => void) | undefined {
    return installMailTopFrameBridge('netease', isEnabled, signal, readBrowserDefaultFont);
}

/** 子 frame 先读取顶层授权状态，再挂载全文手势；未匹配的顶层或子页面没有 UI 和输入监听器。 */
async function startMailFrameApp(ctx: ContentScriptContext, kind: MailFrameKind): Promise<void> {
    if (window.top === window) return;
    const readTopHref = () => {
        if (kind === 'qq') return '';
        try { return window.top?.location.href ?? ''; } catch { return ''; }
    };
    const topHref = readTopHref();
    if (kind === 'qq' ? !isQqMailReadmailUrl(window.location.href)
        : !isNeteaseMailChildUrl(window.location.href, topHref)) return;
    const messages = messageTypes[kind];
    const siteHref = () => kind === 'qq' ? window.location.href : readTopHref() || topHref;
    const isReadableFrame = () => kind === 'qq' || (isNeteaseMailReadUrl(readTopHref())
        && document.designMode !== 'on' && document.body?.isContentEditable !== true
        && !/editor|compose|write|login|urs/iu.test(`${window.frameElement?.id ?? ''} ${window.frameElement?.className ?? ''}`));
    let disposed = false;
    const lifetime = new AbortController();
    let lifecycleController: ReturnType<typeof createFrameSessionController> | undefined;
    let cleanup = () => { disposed = true; lifetime.abort(); };
    const pageLifecycle = installContentPageLifecycle(window, lifetime.signal, {
        suspend: () => lifecycleController?.suspend(),
        resume: () => { void lifecycleController?.refresh(); },
        dispose: () => cleanup(),
    }, ctx, document);
    await configReady;
    if (ctx.isInvalid || disposed) { cleanup(); return; }
    await ensureUiLanguageBundle(config.uiLanguage);
    const officialSiteRules = officialSiteRuleUpdatesEnabled ? await readOfficialSiteRuleRelease() : null;
    if (ctx.isInvalid || disposed) { cleanup(); return; }
    let activation: AbortController | null = null;
    let toggleGeneration = 0;
    let observedRevision: number | undefined;
    let observedSessionId: number | null = null;
    let removeStyles: (() => void) | null = null;
    let authorized = false;
    const pageTranslationFont = createPageTranslationFontRuntime({document});
    const enabled = () => !disposed && !pageLifecycle.isSuspended() && config.on !== false
        && isReadableFrame()
        && !isExtensionDisabledOnSite(siteHref(), config.disabledExtensionDomains);
    const refreshAfterToggle = () => {
        const currentActivation = activation;
        const currentGeneration = toggleGeneration;
        return controller.refresh().catch(() => {
            if (activation === currentActivation && toggleGeneration === currentGeneration && enabled() && authorized) controller.suspend();
        });
    };
    const toggle = (invocation?: PageTranslationInvocation) => {
        if (!enabled() || !authorized) return;
        const requestActivation = activation;
        const requestGeneration = ++toggleGeneration;
        const requestRevision = observedRevision;
        const requestSessionId = observedSessionId;
        const onFailure = () => {
            if (!enabled() || !authorized) return;
            if (requestActivation === activation && requestGeneration === toggleGeneration &&
                requestRevision === observedRevision && requestSessionId === observedSessionId) controller.suspend();
            void refreshAfterToggle();
        };
        try {
            void browser.runtime.sendMessage({type: messages.request, action: 'toggle', ...(invocation ? {invocation} : {})})
                .then(refreshAfterToggle, onFailure);
        } catch { onFailure(); }
    };
    const hotkeys = createContentHotkeyRuntime(() => !enabled() || !authorized, {toggleFullPage: toggle});
    const restore = () => { restoreOriginalContent(); cancelAllTranslations(); };
    const setAvailable = (available: boolean) => {
        authorized = available;
        if (!available) {
            pageTranslationFont.reset();
            activation?.abort(); activation = null;
            removeStyles?.(); removeStyles = null;
            syncBilingualSentenceHighlight(document, false);
            return;
        }
        pageTranslationFont.set(config.browserDefaultTranslationFont === true);
        if (activation) return;
        activation = new AbortController();
        removeStyles = installPageStyles(ctx);
        syncBilingualSentenceHighlight(document, config.bilingualSentenceHighlightEnabled === true, config.bilingualSentenceHighlightStyle, config.bilingualSentenceHighlightAppearance);
        hotkeys.installFloatingBallHotkey(activation.signal);
    };
    const controller = createFrameSessionController({
        readState: () => browser.runtime.sendMessage({type: messages.request, action: 'state'}),
        isEnabled: enabled, setAvailable, restore,
        syncState: state => {
            observedRevision = state.revision;
            observedSessionId = state.sessionId;
        },
        start: (state) => autoTranslateEnglishPage({
            service: state.translationConfig!.service, model: state.translationConfig!.model,
            targetLanguage: state.translationConfig!.targetLanguage, displayMode: state.translationConfig!.displayMode,
            profileId: state.translationConfig!.profileId, fullPageMode: state.fullPageMode, scope: state.scope,
        }, state.translationConfig),
    });
    lifecycleController = controller;
    const listener = (message: any, sender: any): false => {
        if (sender?.id !== browser.runtime.id) return false;
        if (message?.type === messages.refresh && (kind === 'netease' || enabled())) void controller.refresh();
        if (message?.type === 'translationCacheCleared') invalidateFullPageTranslationSessionCache();
        return false;
    };
    const siteAdaptation = createContentSiteAdaptationRuntime(
        config.siteAdaptation, new URL(siteHref()), () => controller.suspend(), officialSiteRules);
    let currentRouteHref = window.location.href;
    let currentSiteHref = siteHref();
    document.addEventListener('fluentread-route-change', () => {
        const nextRouteHref = window.location.href;
        const nextSiteHref = siteHref();
        if (nextRouteHref === currentRouteHref && nextSiteHref === currentSiteHref) return;
        currentRouteHref = nextRouteHref;
        currentSiteHref = nextSiteHref;
        resetPageTranslationContextCache();
        resetFullPageTranslationRouteState();
        if (siteAdaptation.routeChanged(new URL(nextSiteHref)) && enabled()) void controller.refresh();
    }, {signal: lifetime.signal});
    const removeMessageListener = addRuntimeMessageListener(browser.runtime, listener);
    applyCoreTranslationPreferences(config);
    const unsubscribe = subscribeConfig(createPageTranslationDisplayModeSync(config, () => {
        applyCoreTranslationPreferences(config);
        siteAdaptation.update(config.siteAdaptation, new URL(siteHref()));
        syncBilingualSentenceHighlight(document, enabled() && authorized && config.bilingualSentenceHighlightEnabled === true, config.bilingualSentenceHighlightStyle, config.bilingualSentenceHighlightAppearance);
        if (enabled() && authorized) pageTranslationFont.set(config.browserDefaultTranslationFont === true);
        if (!enabled()) controller.suspend();
        else void controller.refresh();
    }));
    cleanup = () => {
        if (lifetime.signal.aborted) return;
        disposed = true; lifetime.abort(); controller.dispose(); unsubscribe();
        pageTranslationFont.dispose();
        removeMessageListener();
    };
    if (enabled()) await controller.refresh();
}

export function startQqMailFrameApp(ctx: ContentScriptContext): Promise<void> {
    return startMailFrameApp(ctx, 'qq');
}

export function startNeteaseMailFrameApp(ctx: ContentScriptContext): Promise<void> {
    return startMailFrameApp(ctx, 'netease');
}
