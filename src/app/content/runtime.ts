/**
 * @file src/app/content/runtime.ts
 * 文件职责：作为内容脚本应用的顶层 composition root，协调配置就绪、站点规则、公共样式、主世界桥、全文翻译与悬浮球生命周期及快捷键。
 * 主要内容：同步译文字体与双语显示模式，挂载悬浮球、翻译进度条与全文快捷键，并处理站点规则变化、路由切换及页面挂起销毁清理。
 * 模块边界：只负责依赖装配和页面激活所有权，不实现翻译算法、组件内部状态、provider 请求或配置存储。
 */
import {createReaderContentFeatures} from './readerFeatures';
import type {ContentScriptContext} from 'wxt/utils/content-script-context';
import {createSiteRuleMatcher} from '@/src/features/site-rules/domain';
import {config, configReady, subscribeConfig} from '@/src/services/config/store';
import {ensureUiLanguageBundle} from '@/src/platform/i18n/uiLanguageBundles';
import {cancelAllTranslations} from '@/src/services/translation/client';
import {resetPageTranslationContextCache} from '@/src/services/translation/context';
import {clearLegacyPageTranslationCache} from '@/src/services/translation/legacyPageCache';
import {isRawXmlContentDocument} from '@/src/shared/dom/documentType';
import {createContentFeatureRegistry, type ContentFeatureRegistry} from './featureRegistry';
import {createContentHotkeyRuntime} from './hotkeyRuntime';
import {createContentRuntimeMessageHandler, type ContentRuntimeMessageHandler} from './messageRuntime';
import {
    autoTranslateEnglishPage,
    isFullPageTranslationActive,
    restoreOriginalContent,
    resetFullPageTranslationRouteState,
    createPageTranslationDisplayModeSync,
} from './features';
import {installPageStyles} from './pageStyles';
import {installNeteaseMailTopFrameBridge, installQqMailTopFrameBridge} from './qqMailFrameRuntime';
import {installEmbeddedTopFrameBridge} from './embeddedFrameRuntime';
import {browserCapabilities, type BrowserCapabilities} from '@/src/platform/browser/capabilities';
import {setMainWorldBridgesEnabled} from './mainWorldBridgeLifecycle';
import {
    createContentPageAvailabilityRuntime,
    createContentRouteChangeHandler,
    type ContentPageAvailabilityRuntime,
} from './pageAvailability';
import {installContentPageLifecycle, waitForContentDocument} from './pageLifecycle';
import {syncBilingualSentenceHighlight} from './bilingualSentenceHighlight';
import {applyCoreTranslationPreferences, createContentSiteAdaptationRuntime} from './siteAdaptationRuntime';
import {officialSiteRuleUpdatesEnabled, readOfficialSiteRuleRelease} from '@/src/services/site-adaptation/officialClient';
import {createPageTranslationFontRuntime} from './pageTranslationFont';

export async function startContentApp(ctx: ContentScriptContext,
    capabilities: BrowserCapabilities = browserCapabilities): Promise<void> {
    if (isRawXmlContentDocument(document) || ctx.isInvalid) return;
    const pageEventController = new AbortController();
    let cleanedUp = false;
    let pageAvailability: ContentPageAvailabilityRuntime | null = null;
    let cleanup = (): void => { cleanedUp = true; pageEventController.abort(); };
    const pageLifecycle = installContentPageLifecycle(window, pageEventController.signal, {
        suspend: () => { void pageAvailability?.reconcile(); },
        resume: () => { void pageAvailability?.reconcile(); },
        dispose: () => cleanup(),
    }, ctx, document, true);
    await configReady;
    if (ctx.isInvalid || cleanedUp) { cleanup(); return; }
    await ensureUiLanguageBundle(config.uiLanguage);
    if (ctx.isInvalid || cleanedUp || (document.readyState === 'loading' && !await waitForContentDocument(document, pageEventController.signal))) { cleanup(); return; }
    const officialSiteRules = officialSiteRuleUpdatesEnabled ? await readOfficialSiteRuleRelease() : null;
    if (ctx.isInvalid || cleanedUp) { cleanup(); return; }
    const siteAdaptation = createContentSiteAdaptationRuntime(config.siteAdaptation, new URL(window.location.href), undefined, officialSiteRules);
    applyCoreTranslationPreferences(config);
    clearLegacyPageTranslationCache();
    const siteRules = createSiteRuleMatcher(config);
    let currentPageSiteDisabled = siteRules.isExtensionDisabled(window.location.href);
    let unsubscribeContentConfig: (() => void) | null = null;
    const runtimeMessages = browser.runtime.onMessage;
    let featureController: AbortController | null = null;
    let activePageFeatureRegistry: ContentFeatureRegistry | null = null;
    let removePageStyles: (() => void) | null = null;
    const pageTranslationFont = createPageTranslationFontRuntime({
        document,
        onChange: () => document.dispatchEvent(new Event('fluentread-page-translation-font-changed')),
    });
    const hotkeys = createContentHotkeyRuntime(() => currentPageSiteDisabled);
    const reportSiteDisabledState = async (): Promise<void> => {
        try {
            await browser.runtime.sendMessage({
                type: 'siteExtensionDisabledState',
                isDisabled: currentPageSiteDisabled,
            });
        } catch { /* 站点状态广播不能阻断失效后的页面清理。 */ }
    };
    const isPageRuntimeEnabled = (): boolean => !cleanedUp && !ctx.isInvalid && !pageLifecycle.isSuspended() && !currentPageSiteDisabled && config.on !== false;
    installQqMailTopFrameBridge(isPageRuntimeEnabled, pageEventController.signal, () => pageTranslationFont.read() === true);
    installNeteaseMailTopFrameBridge(isPageRuntimeEnabled, pageEventController.signal, () => pageTranslationFont.read() === true);
    installEmbeddedTopFrameBridge(isPageRuntimeEnabled, pageEventController.signal, () => pageTranslationFont.read() === true);
    const disposePageFeatures = (): void => {
        pageTranslationFont.reset();
        featureController?.abort();
        featureController = null;
        restoreOriginalContent();
        cancelAllTranslations();
        activePageFeatureRegistry?.unmountAll();
        activePageFeatureRegistry = null;
        removePageStyles?.();
        removePageStyles = null;
        syncBilingualSentenceHighlight(document, false);
    };
    const activatePageFeatures = async (): Promise<void> => {
        if (!isPageRuntimeEnabled() || featureController) return;
        removePageStyles = installPageStyles(ctx);
        pageTranslationFont.set(config.browserDefaultTranslationFont === true);
        syncBilingualSentenceHighlight(document, config.bilingualSentenceHighlightEnabled === true, config.bilingualSentenceHighlightStyle, config.bilingualSentenceHighlightAppearance);
        const activationController = new AbortController();
        featureController = activationController;
        const isActivationCurrent = () => isPageRuntimeEnabled() && featureController === activationController
            && !activationController.signal.aborted;
        hotkeys.installFloatingBallHotkey(activationController.signal);
        activePageFeatureRegistry = createContentFeatureRegistry([
            ...createReaderContentFeatures(ctx, config),
        ], {
            capabilities,
            onError: (featureId, phase, error) => {
                console.error(`[FluentRead] 内容功能 ${featureId} ${phase} 失败:`, error);
            },
        });
        await activePageFeatureRegistry.mountEnabled({
            ctx,
            signal: activationController.signal,
            isCurrent: isActivationCurrent,
        });
    };
    pageAvailability = createContentPageAvailabilityRuntime({
        isEnabled: isPageRuntimeEnabled,
        isPageFeaturesActive: () => featureController !== null,
        shouldAutomaticallyTranslate: () => siteRules.shouldAutoTranslate(window.location.href),
        getPageIdentity: () => window.location.href,
        isFullPageTranslationActive,
        setMainWorldBridgesEnabled: (enabled) => setMainWorldBridgesEnabled(document, enabled),
        activatePageFeatures,
        disposePageFeatures,
        autoTranslate: autoTranslateEnglishPage,
    });
    const applySiteDisabledState = async (disabled: boolean): Promise<void> => {
        if (cleanedUp) return;
        currentPageSiteDisabled = disabled;
        void reportSiteDisabledState();
        await pageAvailability!.reconcile();
    };
    document.addEventListener('fluentread-route-change', createContentRouteChangeHandler({
        getHref: () => window.location.href,
        routeChanged: href => { siteAdaptation.routeChanged(new URL(href)); },
        resetTranslationRoute: () => { resetPageTranslationContextCache(); resetFullPageTranslationRouteState(); },
        siteDisabled: href => siteRules.isExtensionDisabled(href),
        currentSiteDisabled: () => currentPageSiteDisabled,
        applySiteDisabledState,
        pageAvailability,
        reconcileFeatures: () => { void activePageFeatureRegistry?.reconcileEnabled(); },
    }), {signal: pageEventController.signal});
    const runtimeMessageListener: ContentRuntimeMessageHandler = createContentRuntimeMessageHandler(ctx, {
        pageTranslationFont,
        isSiteDisabled: () => currentPageSiteDisabled,
        updateSiteDisabled: applySiteDisabledState,
        isPageSuspended: pageLifecycle.isSuspended,
    }, capabilities);
    cleanup = (): void => {
        if (cleanedUp) return;
        cleanedUp = true;
        pageEventController.abort();
        setMainWorldBridgesEnabled(document, false);
        try {
            runtimeMessages.removeListener(runtimeMessageListener);
        } catch { /* 失效上下文的监听由浏览器释放，页面清理仍由本运行时负责。 */ }
        disposePageFeatures();
        pageTranslationFont.dispose();
        unsubscribeContentConfig?.();
        unsubscribeContentConfig = null;
    };
    runtimeMessages.addListener(runtimeMessageListener);
    void reportSiteDisabledState();
    unsubscribeContentConfig = subscribeConfig(createPageTranslationDisplayModeSync(config, (nextConfig) => {
        siteRules.update(nextConfig);
        void ensureUiLanguageBundle(nextConfig.uiLanguage);
        applyCoreTranslationPreferences(nextConfig);
        siteAdaptation.update(nextConfig.siteAdaptation, new URL(window.location.href));
        syncBilingualSentenceHighlight(document, isPageRuntimeEnabled() && nextConfig.bilingualSentenceHighlightEnabled === true, nextConfig.bilingualSentenceHighlightStyle, nextConfig.bilingualSentenceHighlightAppearance);
        const nextSiteDisabled = siteRules.isExtensionDisabled(window.location.href);
        if (nextSiteDisabled !== currentPageSiteDisabled) {
            void applySiteDisabledState(nextSiteDisabled);
            return;
        }
        if (pageAvailability!.needsLifecycleReconcile()) {
            void pageAvailability!.reconcile();
            return;
        }
        if (!isPageRuntimeEnabled()) return;
        pageTranslationFont.set(nextConfig.browserDefaultTranslationFont === true);
        void activePageFeatureRegistry?.reconcileEnabled();
        pageAvailability!.refreshAutoTranslation();
    }));
    await pageAvailability.reconcile();
}
