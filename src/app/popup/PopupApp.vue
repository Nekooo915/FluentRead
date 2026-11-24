<!--
 * @file src/app/popup/PopupApp.vue
 * 文件职责：实现精简版扩展 Popup 主交互界面，连接当前标签页全文翻译状态、语言对与服务选择、译文模式与字体切换及当前网站规则。
 * 主要内容：固定简洁布局（顶部品牌与设置入口、翻译控制卡片含源/目标语言、服务抽屉、全文翻译主按钮、当前网站规则与 Aa/双语模式切换）；已移除底部翻译统计与清除缓存栏、自定义布局排序以及首次多语言引导页。
 * 模块边界：组件编排 UI、浏览器标签页事件与生命周期；页面消息归属由 pageActions 管理，公共配置经 services/config 与 useConfigEditor 持久化。
 -->
<template>
  <main
    class="popup-shell"
    :class="{ 'config-loading': !hydrated, 'default-skin': config.interfaceSkin === 'default' }"
    :aria-busy="!hydrated"
    :data-config-ready="hydrated ? 'true' : 'false'"
    :data-interface-skin="config.interfaceSkin"
    :inert="!hydrated"
  >
    <div class="popup-content">
      <header class="popup-header">
        <div class="brand">
          <span class="brand-icon-link" :data-animated="config.animations">
            <img src="/icon/128.png" alt="" />
          </span>
          <div class="brand-copy">
            <strong data-i18n-ignore>{{ t('common.brand') }}</strong>
            <small class="brand-version" data-testid="popup-version" :title="!config.on ? t('popup.heroDisabled') : undefined"
              >v{{ version }}<template v-if="!config.on"> · {{ t('popup.heroDisabled') }}</template></small>
          </div>
        </div>
        <div class="header-actions">
          <button class="settings-button" type="button" title="完整设置" aria-label="打开完整设置" :onClick="popupActions.settings">
            <Setting />
            <span>设置</span>
          </button>
        </div>
      </header>

      <section class="hero-card" data-popup-module="translation">
        <div class="language-pair">
          <label>
            <span>源语言</span>
            <PopupLanguageSelect aria-label="源语言" source v-model="config.from" :disabled="!config.on" :single-line="config.interfaceSkin === 'default'" />
          </label>
          <span class="arrow">→</span>
          <label>
            <span>目标语言</span>
            <PopupLanguageSelect aria-label="目标语言" v-model="config.to" :disabled="!config.on" :single-line="config.interfaceSkin === 'default'" />
          </label>
        </div>

        <div class="provider-strip" :class="{'needs-credentials': Boolean(credentialWarning)}">
          <ElTooltip :trigger="['hover', 'focus']" :trigger-keys="[]" :show-after="400" :hide-after="0"
            :persistent="false" :show-arrow="false" :enterable="false" :disabled="!popupContext.active.value || drawerVisible"
            placement="top" effect="light" popper-class="translation-tool-tooltip">
            <template #content><span class="translation-tool-tooltip-copy popup-label-tooltip-copy" data-i18n-ignore>{{ providerSummaryTitle }}</span></template>
            <button class="provider-summary" type="button" data-testid="popup-feature-services" data-i18n-ignore
              :aria-label="providerSummaryLabel" :aria-description="providerSummaryHelp" aria-haspopup="dialog"
              :aria-expanded="drawerVisible && activeDrawer === 'services'" :onClick="popupActions.services">
              <span class="provider-summary-copy">
                <span class="provider-summary-heading"><small>{{ t('popup.providers.title') }}</small><strong>{{ providerLabel(config.service) }}</strong></span>
                <small v-if="providerSummaryModel" class="provider-summary-model">{{ providerSummaryModel }}</small>
              </span>
              <span class="provider-summary-icons" aria-hidden="true">
                <span class="provider-avatar">
                  <ServiceIcon :service="config.service" :label="providerLabel(config.service)" size="small" />
                </span>
                <span class="provider-summary-chevron">›</span>
              </span>
            </button>
          </ElTooltip>
          <div v-if="credentialWarning" class="credential-warning" role="alert">
            <span><strong>配置提醒</strong>{{ credentialWarning }}</span>
            <button type="button" :title="credentialWarning"
              :aria-label="`去设置 · ${credentialWarning}`"
              :onClick="popupActions.serviceSettings"><span>去设置</span></button>
          </div>
        </div>

        <div class="translate-action" :class="{'is-translated': pageTranslated}">
          <button class="translate-button" :class="{ translated: pageTranslated }" type="button"
            data-testid="page-translation" :aria-pressed="pageTranslated" :aria-busy="translationInProgress"
            :aria-label="pageTranslationLabel" :title="pageTranslationTitle"
            :disabled="!config.on || currentSiteExtensionDisabled || translating || pageState.savingRule" :onClick="pageButtons.toggle">
            <span v-if="translationInProgress" class="spinner" aria-hidden="true" />
            <span class="translate-label">{{ pageTranslationButtonLabel }}</span>
          </button>
          <DiagnosticNotice v-if="pageDiagnostic" :diagnostic="pageDiagnostic" language="zh-CN" :busy="translating" :version="version" @action="diagnosticAction" />
        </div>

        <div class="translation-meta">
          <PopupSiteRule
            v-bind="siteRuleModuleProps"
            :onSetAlwaysTranslated="pageButtons.always"
            :onSetExtensionDisabled="pageButtons.disabled"
          />
          <div :ref="setPageFontFocusAnchor" class="translation-tools" tabindex="-1">
            <span class="display-mode-slot" :class="{'with-page-font': pageFontEntryVisible}" data-i18n-ignore>
              <ElTooltip v-if="pageFontEntryVisible" :ref="setPageFontTooltip" :trigger="['hover', 'focus']" :trigger-keys="[]" :show-after="350" :hide-after="0"
                :persistent="false" :show-arrow="false" :disabled="!pageFontContext.active.value || drawerVisible" placement="top-end" effect="light" popper-class="translation-tool-tooltip page-font-tooltip">
                <template #content>
                  <span class="translation-tool-tooltip-copy" data-testid="page-font-tooltip"><span>{{ pageFontButton.label }}</span><small>{{ t('popup.pageFont.hint') }}</small></span>
                </template>
                <button :ref="setPageFontEntry" class="display-mode-button page-font-entry" :class="{'is-browser-default': config.browserDefaultTranslationFont}" type="button" data-testid="page-font-entry"
                  :data-font-state="pageFontButton.state" :aria-label="pageFontButton.ariaLabel" :aria-pressed="config.browserDefaultTranslationFont"
                  :aria-description="pageFontState.error ? pageFontButton.label : undefined"
                  :aria-busy="pageFontState.busy" :disabled="pageFontButton.disabled" :onClick="pageFontButton.toggle">
                  <svg :data-font-style="config.browserDefaultTranslationFont ? 'sans' : 'serif'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path v-if="config.browserDefaultTranslationFont" d="m3 18 4.5-12L12 18M4.5 14h6M21 10v8M21 14a3.5 4 0 1 0-7 0 3.5 4 0 0 0 7 0" />
                    <path v-else d="m3 18 4.5-12L12 18M2 18h3M10.5 18h3M4.5 14h6M14.5 11c1-2 6.5-2 6.5 1v6h1M21 13c-8-1-8 7-2 4l2-2" />
                  </svg>
                </button>
              </ElTooltip>
              <ElTooltip :ref="setDisplayModeTooltip" :trigger="['hover', 'focus']" :trigger-keys="[]" :show-after="350" :hide-after="0"
                :persistent="false" :show-arrow="false" :disabled="!popupContext.active.value || drawerVisible" placement="top-end" effect="light" popper-class="translation-tool-tooltip">
                <template #content><span class="translation-tool-tooltip-copy" data-testid="display-mode-tooltip">{{ displayModeButton.label }}</span></template>
                <button class="display-mode-button" type="button" data-testid="popup-display-mode"
                  :data-display-mode="currentPageDisplay === 1 ? 'bilingual' : 'translation-only'"
                  :aria-label="t('popup.displayMode.translationOnly')" :aria-pressed="currentPageDisplay === 1" :aria-description="displayModeButton.disabled ? displayModeButton.label : undefined"
                  :disabled="displayModeButton.disabled" :onClick="displayModeButton.toggle">
                  <svg v-if="currentPageDisplay === 1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9.5 17h-5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2H12a2 2 0 0 1 2 2v3M5.5 12.5l2-5.5 2 5.5M6.2 10.5h2.6"/>
                    <rect x="9.5" y="8" width="12" height="13" rx="2"/>
                    <path d="M15.5 10.5v2M12.5 12.5h6M13.3 12.5c.4 2.5 2.3 4.5 5.2 5.5M17.7 12.5c-.4 2.5-2.3 4.5-5.2 5.5"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="5" y="3" width="14" height="18" rx="2"/>
                    <path d="M12 7v2M8 9h8M9 9c.5 3.5 2.7 6.5 7 8M15 9c-.5 3.5-2.7 6.5-7 8"/>
                  </svg>
                </button>
              </ElTooltip>
            </span>
          </div>
        </div>

        <div v-if="pageFontState.error && pageFontEntryVisible" class="page-font-error" data-testid="page-font-error" data-i18n-ignore>
          <span class="page-font-error-copy" role="alert">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M8 4.5v4.1M8 11.3h.01"/></svg>
            <span>{{ t(pageFontState.error) }}</span>
          </span>
          <button class="page-font-retry" type="button" data-testid="page-font-retry" :aria-label="t('popup.pageFont.retryAction')"
            :disabled="pageFontButton.disabled" :onClick="retryPageFont">{{ t('popup.pageFont.retry') }}</button>
        </div>

        <p v-if="notice" class="notice" :class="noticeType" :role="noticeType === 'error' ? 'alert' : 'status'" :aria-live="noticeType === 'error' ? 'assertive' : 'polite'">{{ notice }}</p>
      </section>

      <el-drawer
        v-if="drawerMounted"
        v-model="drawerVisible"
        :title="drawerTitle"
        direction="btt"
        size="auto"
        :with-header="false"
        :append-to-body="true"
        :close-on-press-escape="activeDrawer !== 'services'"
        modal-class="popup-drawer-modal"
        class="popup-drawer"
        :class="{ 'popup-services-drawer': activeDrawer === 'services' }"
      >
        <div ref="drawerSurface" class="drawer-surface">
          <div class="drawer-handle" />
          <header v-if="activeDrawer !== 'services'" class="drawer-header">
            <div class="drawer-heading">
              <button v-if="activeDrawer === 'aiContext'" type="button" :aria-label="t('popup.providers.title')" :onClick="drawerActions.services">←</button>
              <div class="drawer-heading-copy">
                <div class="drawer-title-row"><h2>{{ drawerTitle }}</h2></div>
                <p v-if="drawerDescription">{{ drawerDescription }}</p>
              </div>
            </div>
            <button type="button" aria-label="关闭" :onClick="drawerActions.close">×</button>
          </header>

          <div v-if="activeDrawer === 'services'" class="drawer-content provider-drawer-content">
            <PopupServices ref="servicesPanel" :config="config" :service-options="allServiceOptions" :active="drawerVisible && activeDrawer === 'services'" :onClose="drawerActions.close" />
          </div>
          <div v-else class="drawer-content ai-context-details" data-i18n-ignore>
            <div class="ai-context-detail-state" :data-ai-context-state="aiContextPresentation.state">
              <span class="ai-context-status" role="status">{{ t(`popup.aiContext.status.${aiContextPresentation.state}`) }}</span>
              <p data-testid="ai-context-description">{{ t(aiContextPresentation.descriptionKey) }}</p>
            </div>
            <p v-if="credentialWarning" class="ai-context-setup-details" role="alert">{{ credentialWarning }}</p>
            <div class="setting-row">
              <span><strong>{{ t('popup.aiContext.preference') }}</strong><small>{{ t('popup.aiContext.preferenceHint') }}</small></span>
              <button
                class="switch compact ai-context-detail-switch"
                type="button"
                role="switch"
                :aria-label="t('popup.aiContext.preference')"
                :aria-checked="config.enableAIContext"
                :disabled="aiContextPresentation.toggleDisabled"
                :onClick="drawerActions.aiContext"
              ><i /></button>
            </div>
            <dl class="ai-context-explanation">
              <div><dt>{{ t('popup.aiContext.howTitle') }}</dt><dd>{{ t('popup.aiContext.how') }}</dd></div>
              <div><dt>{{ t('popup.aiContext.costTitle') }}</dt><dd>{{ t('popup.aiContext.cost') }}</dd></div>
              <div><dt>{{ t('popup.aiContext.applyTitle') }}</dt><dd>{{ t('popup.aiContext.apply') }}</dd></div>
            </dl>
            <button class="secondary-action" type="button" data-testid="ai-context-settings" :onClick="drawerActions.serviceSettings">{{ t('popup.aiContext.configure') }} ↗</button>
          </div>

          <p v-if="notice && noticeType === 'error'" class="notice error" role="alert">{{ notice }}</p>
        </div>
      </el-drawer>
    </div>
  </main>
</template>

<script lang="ts" setup>
import {ElTooltip, type TooltipInstance} from 'element-plus/es/components/tooltip/index';
import PopupLanguageSelect from './PopupLanguageSelect.vue';
import DiagnosticNotice from '@/src/features/self-help/ui/DiagnosticNotice.vue';
import {getDiagnosticUiText, diagnoseFailure, normalizeDiagnostic, type Diagnostic, type DiagnosticAction, type DiagnosticUiTextKey} from '@/src/services/diagnostics';
import {normalizeTranslationToolbarStatus, type TranslationToolbarStatus} from '@/src/features/full-page-translation/toolbarStatus';
import {computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, toRefs, watch} from 'vue';
import browser from 'webextension-polyfill';
import type {Tabs} from 'webextension-polyfill';
import {
  config as runtimeConfig,
  configReady,
  handoffPendingConfigPatches,
  requestConfigPatch,
  subscribeConfig,
} from '@/src/services/config/store';
import {Setting} from '@element-plus/icons-vue';
import {getVisualViewportRect, observeVisualViewport} from '@/src/platform/dom/visualViewport';
import {normalizeConfig} from '@/src/core/config/model';
import {createApiKeyCheckRevision} from '@/src/core/config/apiKeyCheckIdentity';
import {options, resolveConfiguredModel, servicesType} from '@/src/core/config/catalog';
import {parseHotkey, resolveConfiguredHotkey} from '@/src/core/hotkey';
import {getCustomOpenAIProvider, withCustomOpenAIServiceOptions} from '@/src/core/config/customOpenAI';
import {isTranslationServiceDisabled} from '@/src/core/config/serviceAvailability';
import {getMissingCredentialMessage} from '@/src/core/config/validation';
import {resolveAIContextPresentation} from '@/src/ui/view-model/aiContext';
import {resolveSiteTranslationDisplay} from '@/src/core/site-rules/domain';
import {createPopupPageActions, type PopupPageState, type PopupSiteRulePatch} from './pageActions';
import {createPopupTabSource} from './sourceTab';
import {createPopupPageFontActions, type PopupPageFontState} from './pageFontActions';
import {getEmbeddedPopupTabId, closePopupSurface} from './embedded';
import {useSettingsActionContext} from '@/src/features/settings/model/useSettingsActionContext';
import {useConfigEditor} from '@/src/features/settings/model/useConfigEditor';
import {applyInterfaceFont, applyInterfaceSkin} from '@/src/ui/interfaceAppearance';
import ServiceIcon from '@/src/ui/components/ServiceIcon.vue';
import {useUiI18n} from '@/src/ui/i18n';
import PopupSiteRule from './PopupSiteRule.vue';
import {getTranslationServiceUnavailableMessage} from '@/src/services/translation/capabilities';
import {featureServiceDefinitions, getFeatureService} from '@/src/core/config/featureServices';

type DrawerName = 'services' | 'aiContext';
type SettingsSection = 'settings-general' | 'settings-interface' | 'settings-translation' | 'settings-services' | 'settings-sites' | 'settings-video';

const PopupServices = defineAsyncComponent(() => import('./PopupServices.vue'));
const pageFontTooltip = ref<TooltipInstance>();
const pageFontEntry = shallowRef<HTMLButtonElement>();
const pageFontFocusAnchor = shallowRef<HTMLElement>();
const displayModeTooltip = ref<TooltipInstance>();
const setPageFontTooltip = (tooltip: unknown) => {pageFontTooltip.value = tooltip ? tooltip as TooltipInstance : undefined;};
const setPageFontEntry = (element: unknown) => {pageFontEntry.value = element ? element as HTMLButtonElement : undefined;};
const setPageFontFocusAnchor = (element: unknown) => {pageFontFocusAnchor.value = element ? element as HTMLElement : undefined;};
const setDisplayModeTooltip = (tooltip: unknown) => {displayModeTooltip.value = tooltip ? tooltip as TooltipInstance : undefined;};
const ElDrawer = defineAsyncComponent(() => import('./PopupDrawer'));
const {t} = useUiI18n();
function diagnosticUi(key: DiagnosticUiTextKey): string {
  return getDiagnosticUiText(key, 'zh-CN');
}
const version = browser.runtime.getManifest().version;
const config = ref(normalizeConfig(runtimeConfig));
const drawerVisible = ref(false);
const drawerMounted = ref(false);
const drawerSurface = shallowRef<HTMLElement | null>(null);
const servicesPanel = shallowRef<InstanceType<typeof PopupServices> | null>(null);
let releaseDrawerViewport: (() => void) | undefined;
const activeDrawer = ref<DrawerName>('services');
const pageState = reactive<PopupPageState>({tabId: null, url: '', domain: '', translated: false, busy: false, savingRule: false});
const {busy: translating, translated: pageTranslated, tabId: currentTabId, domain: currentSiteDomain} = toRefs(pageState);
const currentSiteTranslationOnly = computed(() => Boolean(pageState.domain && config.value.translationOnlyDomains?.includes(pageState.domain)));
const currentPageDisplay = computed(() => resolveSiteTranslationDisplay(config.value, pageState.url));
const pageTranslationLabel = computed(() => t(pageTranslated.value ? 'popup.restoreCurrentPage' : 'popup.translateCurrentPage'));
const pageDiagnostic = shallowRef<Diagnostic>();
const pageResultStatus = ref<TranslationToolbarStatus>('idle');
const translationInProgress = computed(() => translating.value || pageResultStatus.value === 'translating');
function readPageResult(value: unknown) {
  const response = value as {isTranslated?: unknown; toolbarStatus?: unknown; diagnostic?: unknown} | undefined;
  pageResultStatus.value = normalizeTranslationToolbarStatus(response?.toolbarStatus);
  pageDiagnostic.value = normalizeDiagnostic(response?.diagnostic);
  if (pageResultStatus.value === 'error' && !pageDiagnostic.value) pageDiagnostic.value = diagnoseFailure(undefined);
}
const notice = ref('');
const noticeType = ref<'success' | 'error' | 'pending'>('success');
const hydrated = ref(false);
let pageExitSaveStarted = false;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
const sendConfigMessage = browser.runtime.sendMessage.bind(browser.runtime);
const persistConfigPatch = (value: unknown) => requestConfigPatch(value, sendConfigMessage);

const customProviderNames = computed(() => new Map(config.value.customOpenAIProviders.map(provider => [provider.id, provider.name])));
const allServiceOptions = computed(() => withCustomOpenAIServiceOptions(
  options.services,
  config.value.customOpenAIProviders,
).filter((item: any) => !item.disabled).map((item: any) => ({
  ...item,
  label: customProviderNames.value.get(item.value) ?? item.label,
  searchTerms: [...(item.searchTerms || []), customProviderNames.value.get(item.value) ?? item.label],
})));
const providerLabels = computed(() => new Map(allServiceOptions.value.map(item => [item.value, item.label])));
const providerLabel = (service: string) => providerLabels.value.get(service) || service;
const assignedProviders = computed(() => [...new Set([
  config.value.service,
  ...featureServiceDefinitions.map(feature => getFeatureService(config.value, feature) || config.value.service),
])]);
const selectedServiceUnavailableMessage = computed(() => isTranslationServiceDisabled(config.value.disabledTranslationServices, config.value.service)
  ? t('settings.services.library.serviceDisabledMessage') : getTranslationServiceUnavailableMessage(config.value.service));
const selectedCustomOpenAIProvider = computed(() => getCustomOpenAIProvider(config.value.customOpenAIProviders, config.value.service));
const aiContextModel = computed(() => selectedCustomOpenAIProvider.value
  ? config.value.model[config.value.service] || selectedCustomOpenAIProvider.value.models[0] || ''
  : resolveConfiguredModel(config.value.model[config.value.service], config.value.customModel[config.value.service]));
const providerSummaryModel = computed(() => servicesType.isUseModel(config.value.service) ? aiContextModel.value : '');
const providerSummaryModelLabel = computed(() => providerSummaryModel.value ? t('featureServices.configuredModel', {model: providerSummaryModel.value}) : '');
const providerSummaryLabel = computed(() => [t('featureServices.open'), t('featureServices.default'), providerLabel(config.value.service), providerSummaryModelLabel.value].filter(Boolean).join(' · '));
const providerSummaryHelp = computed(() => `${t('featureServices.shortHelp')}\n${assignedProviders.value.map(providerLabel).join(' · ')}`);
const providerSummaryTitle = computed(() => [providerLabel(config.value.service), providerSummaryModelLabel.value].filter(Boolean).join('\n'));
const canUseAIContext = computed(() => servicesType.isUseAIContext(selectedCustomOpenAIProvider.value ? 'custom' : config.value.service, aiContextModel.value));
const missingCredentialMessage = computed(() => getMissingCredentialMessage(config.value.service, config.value));
const credentialWarning = computed(() => selectedServiceUnavailableMessage.value || missingCredentialMessage.value);
const pageFontEntryVisible = computed(() => /^(?:https?|file):/u.test(pageState.url));
const currentSiteSupported = computed(() => currentTabId.value !== null && Boolean(currentSiteDomain.value));
const currentSiteRuleEnabled = computed(() => currentSiteSupported.value && (config.value.alwaysTranslateDomains ?? []).includes(currentSiteDomain.value));
const currentSiteExtensionDisabled = computed(() => currentSiteSupported.value && (config.value.disabledExtensionDomains ?? []).includes(currentSiteDomain.value));
const currentSiteAlwaysTranslated = computed(() => currentSiteSupported.value && !currentSiteExtensionDisabled.value && (config.value.autoTranslate || currentSiteRuleEnabled.value));
const aiContextPresentation = computed(() => resolveAIContextPresentation({
  enabled: config.value.enableAIContext,
  supported: canUseAIContext.value,
  pluginEnabled: config.value.on,
  siteDisabled: currentSiteExtensionDisabled.value,
  unavailable: Boolean(selectedServiceUnavailableMessage.value),
  missingCredentials: Boolean(missingCredentialMessage.value),
  translating: translating.value,
}));
const pageTranslationHotkey = computed(() => {
  const shortcut = resolveConfiguredHotkey(config.value.floatingBallHotkey, config.value.customFloatingBallHotkey);
  if (!shortcut || shortcut === 'none') return '';
  let displayName = parseHotkey(shortcut).displayName;
  if (/Mac|iPod|iPhone|iPad/u.test(navigator.platform)) {
    displayName = displayName.replace(/Control(?=\+)/gu, '⌃').replace(/Option(?=\+)/gu, '⌥')
      .replace(/Shift(?=\+)/gu, '⇧').replace(/Cmd(?=\+)/gu, '⌘');
  }
  return displayName.replace(/Pageup$/u, 'PgUp').replace(/Pagedown$/u, 'PgDn');
});
const pageTranslationButtonLabel = computed(() => {
  const action = t(pageTranslated.value ? 'popup.compact.restore' : 'popup.compact.translate');
  const shortcut = pageTranslationHotkey.value;
  if (!shortcut || shortcut.length > 10) return action;
  return `${action}（${shortcut}）`;
});
const pageTranslationTitle = computed(() => !pageTranslationHotkey.value ? pageTranslationLabel.value : `${pageTranslationLabel.value} · ${pageTranslationHotkey.value}`);
const currentSiteSwitchLabel = computed(() => currentSiteSupported.value
  ? currentSiteExtensionDisabled.value
    ? `${currentSiteDomain.value} 已禁用扩展，无法开启始终翻译 · ${config.value.autoTranslate || currentSiteRuleEnabled.value ? '恢复扩展后继续自动翻译' : '请先恢复扩展'}`
    : config.value.autoTranslate
    ? `所有网站自动翻译已开启，${currentSiteDomain.value} 会自动翻译`
    : `始终翻译 ${currentSiteDomain.value}`
  : '始终翻译当前网站（当前页面不可用）');
const currentSiteExtensionSwitchLabel = computed(() => currentSiteSupported.value
  ? currentSiteExtensionDisabled.value
    ? `恢复 ${currentSiteDomain.value} 的扩展`
    : `在 ${currentSiteDomain.value} 禁用扩展`
  : '在此网站禁用扩展（当前页面不可用）');
const siteRuleModuleProps = computed(() => ({
  active: popupContext.active.value,
  context: pageContext.revision.value,
  domain: currentSiteDomain.value,
  supported: currentSiteSupported.value,
  alwaysTranslated: currentSiteAlwaysTranslated.value,
  alwaysPaused: currentSiteExtensionDisabled.value && (config.value.autoTranslate || currentSiteRuleEnabled.value),
  extensionDisabled: currentSiteExtensionDisabled.value,
  autoTranslate: config.value.autoTranslate,
  translating: translating.value,
  saving: pageState.savingRule,
  switchLabel: currentSiteSwitchLabel.value,
  extensionSwitchLabel: currentSiteExtensionSwitchLabel.value,
}));
const drawerTitle = computed(() => ({services: t('popup.providers.title'), aiContext: t('popup.aiContext.title')}[activeDrawer.value]));
const drawerDescription = computed(() => ({services: '', aiContext: t('popup.aiContext.intro')}[activeDrawer.value]));

const pageExited = ref(false);
const popupContext = useSettingsActionContext(() => hydrated.value && !pageExited.value, () => [config.value, config.value.on]);
const pageConfigurationIdentity = computed(() => JSON.stringify([config.value.on, config.value.service,
  config.value.from, config.value.to, config.value.display, config.value.model[config.value.service],
  config.value.customModel[config.value.service], config.value.disabledExtensionDomains.join(','), config.value.alwaysTranslateDomains.join(','),
  config.value.autoTranslate, credentialWarning.value, createApiKeyCheckRevision(config.value, config.value.service)]));
const pageContext = useSettingsActionContext(() => popupContext.active.value, () => [pageConfigurationIdentity.value]);
const tabSource = createPopupTabSource(window.location?.search || '', {
  get: id => browser.tabs.get(id), query: () => browser.tabs.query({active: true, currentWindow: true}),
}, getEmbeddedPopupTabId());
const pageActions = createPopupPageActions({
  state: pageState,
  config: () => config.value,
  active: () => pageContext.active.value,
  warning: () => credentialWarning.value || '',
  getTab: tabSource.getTab,
  persistRule: persistSiteRulePatch,
  onStatus: readPageResult,
  onFailure: diagnostic => {pageDiagnostic.value = diagnostic; notice.value = '';},
  send: (id, message) => browser.tabs.sendMessage(id, message, {frameId: 0}),
  notice: showNotice,
  close: closePopupSurface,
  translate: t,
});
const {hydrate: hydrateCurrentSite, toggle: togglePageTranslation,
  setAlways: setCurrentSiteAlwaysTranslated, setDisabled: setCurrentSiteExtensionDisabled} = pageActions;
watch(pageContext.revision, () => {pageActions.invalidate(); readPageResult(undefined); if (!config.value.on || currentSiteExtensionDisabled.value) pageTranslated.value = false;}, {flush: 'sync'});
const pageRenderRevision = ref(0);
watch(() => [pageState.tabId, pageState.url, pageState.translated, pageState.busy, pageState.savingRule], () => {pageRenderRevision.value += 1;}, {flush: 'sync'});
const pageButtons = computed(() => {
  const current = pageContext.capture(), rev = pageRenderRevision.value;
  const owns = () => current() && rev === pageRenderRevision.value;
  return {
    toggle: () => {if (owns()) return togglePageTranslation();},
    always: (value: boolean) => {if (owns()) return setCurrentSiteAlwaysTranslated(value);},
    disabled: (value: boolean) => {if (owns()) return setCurrentSiteExtensionDisabled(value);},
  };
});

const popupActions = computed(() => {
  const current = popupContext.capture();
  const bind = (run: () => void | Promise<void>) => () => {if (current()) return run();};
  return {
    settings: bind(() => openOptions()),
    siteSettings: bind(() => openOptions('settings-sites')),
    serviceSettings: bind(() => openOptions('settings-services', undefined, config.value.service)),
    services: bind(() => openDrawer('services')),
  };
});

const displayModeContext = useSettingsActionContext(() => popupContext.active.value,
  () => [config.value, config.value.on, config.value.service, config.value.display, currentSiteTranslationOnly.value, pageState.url, translating.value, pageState.savingRule]);
const displayModeButton = computed(() => {
  const current = displayModeContext.capture(), next = config.value.display === 1 ? 0 : 1;
  const googleOnly = config.value.service === 'google' && next === 0;
  const disabled = !config.value.on || translating.value || pageState.savingRule || googleOnly || currentSiteTranslationOnly.value;
  return {
    disabled,
    label: currentSiteTranslationOnly.value ? '此网站已设为仅译文，可在网站偏好中修改' : t(googleOnly ? 'popup.displayMode.googleBilingualOnly'
      : config.value.display === 1 ? 'popup.displayMode.bilingual' : 'popup.displayMode.translationOnly'),
    toggle: () => {if (current() && !disabled) config.value.display = next;},
  };
});
const drawerContext = useSettingsActionContext(() => popupContext.active.value && drawerVisible.value,
  () => [config.value, activeDrawer.value, config.value.on, config.value.display, config.value.service, config.value.enableAIContext]);
const pageFontState = reactive<PopupPageFontState>({busy: false, error: ''});
const pageFontContext = useSettingsActionContext(() => popupContext.active.value && config.value.on, () => []);
const pageFontActions = createPopupPageFontActions({
  state: pageFontState,
  active: () => pageFontContext.active.value,
  read: () => config.value.browserDefaultTranslationFont,
  save: browserDefaultTranslationFont => persistConfigPatch({...config.value, browserDefaultTranslationFont}),
});
watch(pageFontContext.revision, () => pageFontActions.invalidate(), {flush: 'sync'});
const pageFontButtonContext = useSettingsActionContext(() => pageFontContext.active.value && pageFontEntryVisible.value && !drawerVisible.value,
  () => [pageFontContext.revision.value, config.value.browserDefaultTranslationFont, pageFontState.busy, pageFontState.error]);
const pageFontButton = computed(() => {
  const current = pageFontButtonContext.capture();
  const disabled = !pageFontButtonContext.active.value || pageFontState.busy;
  const state = pageFontState.busy ? 'loading' : pageFontState.error ? 'error'
    : config.value.browserDefaultTranslationFont ? 'browser-default' : 'host';
  const label = pageFontState.error ? `${t(pageFontState.error)} ${t('popup.pageFont.retryAction')}`
    : t(pageFontState.busy ? 'popup.pageFont.changing'
      : config.value.browserDefaultTranslationFont ? 'popup.pageFont.browserAction' : 'popup.pageFont.hostAction');
  const next = !config.value.browserDefaultTranslationFont;
  return {
    disabled,
    state,
    label,
    ariaLabel: t('popup.pageFont.hostAction'),
    toggle: () => {
      if (!current() || disabled) return;
      return pageFontState.error ? pageFontActions.retry() : pageFontActions.set(next);
    },
  };
});
async function retryPageFont() {
  if (!pageFontState.error || pageFontButton.value.disabled) return;
  const anchor = pageFontFocusAnchor.value;
  anchor?.focus({preventScroll: true});
  await pageFontButton.value.toggle();
  await nextTick();
  if (anchor && document.activeElement === anchor && !pageFontButton.value.disabled) pageFontEntry.value?.focus({preventScroll: true});
}
const drawerActions = computed(() => {
  const current = drawerContext.capture();
  const bind = (run: () => void | Promise<void>) => () => {if (current()) return run();};
  return {
    close: bind(() => {drawerVisible.value = false;}),
    aiContext: bind(toggleAIContext),
    services: bind(() => openDrawer('services')),
    serviceSettings: bind(() => openOptions('settings-services', undefined, config.value.service)),
  };
});

watch(popupContext.active, enabled => {if (!enabled) {drawerVisible.value = false; notice.value = ''; if (noticeTimer) clearTimeout(noticeTimer);}}, {flush: 'sync'});
watch([drawerVisible, drawerSurface, popupContext.active], ([visible, surface, active]) => {
  releaseDrawerViewport?.();
  releaseDrawerViewport = undefined;
  const overlay = surface?.closest<HTMLElement>('.popup-drawer-modal');
  if (!visible || !active || !overlay) return;
  const properties = ['left', 'top', 'width', 'height'] as const;
  let previousHeight: number | undefined;
  const update = () => {
    if (!drawerVisible.value || !popupContext.active.value || !overlay.isConnected) return;
    const viewport = getVisualViewportRect();
    for (const property of properties) overlay.style.setProperty(`--fluent-read-drawer-${property}`, `${viewport[property]}px`);
    overlay.setAttribute('data-fluent-read-popup-viewport', '');
    overlay.toggleAttribute('data-fluent-read-popup-short', viewport.height < 224);
    if (previousHeight !== undefined && viewport.height > previousHeight) servicesPanel.value?.revealFocusedSearch?.(drawerContext.capture());
    previousHeight = viewport.height;
  };
  update();
  const stop = observeVisualViewport(update);
  releaseDrawerViewport = () => {
    stop();
    overlay.removeAttribute('data-fluent-read-popup-viewport');
    overlay.removeAttribute('data-fluent-read-popup-short');
    for (const property of properties) overlay.style.removeProperty(`--fluent-read-drawer-${property}`);
  };
}, {flush: 'sync'});

function applyTheme(theme: string) {
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'auto' && darkMode.matches));
}

async function hydrate() {
  applyTheme(config.value.theme || 'auto');
  applyInterfaceSkin(config.value.interfaceSkin);
  applyInterfaceFont(config.value.interfaceFont);
  document.documentElement.dataset.popupHeight = 'content';
  hydrated.value = true;
  await hydrateCurrentSite();
}
void hydrate();

const configEditor = useConfigEditor({
  copySnapshot: normalizeConfig,
  readDraft: () => config.value,
  writeDraft: snapshot => {Object.assign(config.value, snapshot);},
  saveDraft: snapshot => persistConfigPatch(snapshot),
  subscribe: subscribeConfig,
  ready: configReady,
  readAuthority: () => runtimeConfig,
  flush: 'post',
  onEdited: () => {pageExitSaveStarted = false;},
  onSaved: () => {},
  onSaveError: error => console.warn('[FluentRead] 保存 popup 设置失败', error),
  onReady: () => {},
  onReadyError: error => console.warn('[FluentRead] 无法读取 popup 配置', error),
});

async function persistSiteRulePatch(patch: PopupSiteRulePatch): Promise<void> {
  await persistConfigPatch({...config.value, ...patch});
}
watch(() => config.value.theme, theme => applyTheme(theme || 'auto'));
watch(() => config.value.interfaceSkin, skin => applyInterfaceSkin(skin));
watch(() => config.value.interfaceFont, font => applyInterfaceFont(font));
darkMode.onchange = () => {if (config.value.theme === 'auto') applyTheme('auto');};

function handlePopupKeydown(event: KeyboardEvent) {
  if (!popupContext.active.value) return;
  if (event.key === 'Escape') {
    if (drawerVisible.value && activeDrawer.value === 'services') {
      event.preventDefault();
      if (!servicesPanel.value?.backToOverview()) drawerActions.value.close();
      return;
    }
    pageFontTooltip.value?.onClose();
    pageFontTooltip.value?.hide();
    displayModeTooltip.value?.onClose();
    displayModeTooltip.value?.hide();
  }
}
function toggleAIContext() {
  if (aiContextPresentation.value.toggleDisabled) return;
  config.value.enableAIContext = !config.value.enableAIContext;
}
function handleTabUpdated(tabId: number, change: Tabs.OnUpdatedChangeInfoType, tab: Tabs.Tab) {
  if (popupContext.active.value && (typeof change.url === 'string' || change.status === 'loading' || change.status === 'complete')
    && (tabSource.fixed ? tabId === tabSource.sourceTabId
      : tabId === currentTabId.value || (tab.active && (pageState.windowId === undefined || tab.windowId === pageState.windowId)))) void hydrateCurrentSite();
}
function handleTabActivated(info: Tabs.OnActivatedActiveInfoType) {
  if (!tabSource.fixed && popupContext.active.value && (pageState.windowId === undefined || info.windowId === pageState.windowId) && info.tabId !== currentTabId.value) void hydrateCurrentSite();
}
async function diagnosticAction(action: DiagnosticAction) {
  if (!popupContext.active.value || !pageDiagnostic.value) return;
  if (action === 'dismiss') {
    const current = popupContext.capture(); pageDiagnostic.value = undefined;
    await nextTick(); if (current()) document.querySelector<HTMLButtonElement>('[data-testid="page-translation"]')?.focus();
    return;
  }
  if (action === 'services') return openOptions('settings-services', undefined, config.value.service);
  if (action === 'site-settings') return openOptions('settings-sites', 'adaptation', undefined, true);
  if (action === 'refresh') {
    const current = pageContext.capture();
    try {
      const tab = await tabSource.getTab();
      if (current() && tab?.id === currentTabId.value && (tab.pendingUrl || tab.url || '') === pageState.url) {
        try {await browser.tabs.reload(tab.id); if (current()) closePopupSurface();} catch {if (current()) showNotice(diagnosticUi('refresh-failed'), 'error');}
      }
    } catch {if (current()) showNotice(diagnosticUi('source-closed'), 'error');}
    return;
  }
  if (action === 'retry') {pageDiagnostic.value = undefined; await pageActions.retry();}
}
function handlePageResultMessage(message: unknown, sender: {id?: string; url?: string; tab?: {id?: number; url?: string; pendingUrl?: string}; frameId?: number}): undefined {
  const response = message as {type?: unknown; isTranslated?: unknown; documentToken?: unknown} | undefined;
  if (!pageContext.active.value || sender.id !== browser.runtime.id || (sender.url !== undefined && sender.url !== pageState.url) || sender.tab?.id !== currentTabId.value || (sender.frameId !== undefined && sender.frameId !== 0) || response?.type !== 'fullPageTranslationState') return;
  pageActions.receiveStatus(sender.tab.id, sender.tab.pendingUrl || sender.tab.url, response);
  return undefined;
}
function handleTabRemoved(tabId: number) {
  if (popupContext.active.value && tabId === (tabSource.fixed ? tabSource.sourceTabId : currentTabId.value)) void hydrateCurrentSite();
}
onMounted(() => {
  browser.runtime.onMessage.addListener(handlePageResultMessage);
  document.addEventListener('keydown', handlePopupKeydown);
  browser.tabs.onUpdated.addListener(handleTabUpdated);
  browser.tabs.onActivated.addListener(handleTabActivated);
  browser.tabs.onRemoved.addListener(handleTabRemoved);
});
onUnmounted(() => {
  releaseDrawerViewport?.();
  releaseDrawerViewport = undefined;
  persistOnPageExit();
  pageExited.value = true;
  window.removeEventListener('pagehide', saveOnPageHide);
  window.removeEventListener('pageshow', resumeOnPageShow);
  configEditor.dispose();
  browser.runtime.onMessage.removeListener(handlePageResultMessage);
  document.removeEventListener('keydown', handlePopupKeydown);
  browser.tabs.onUpdated.removeListener(handleTabUpdated);
  browser.tabs.onActivated.removeListener(handleTabActivated);
  browser.tabs.onRemoved.removeListener(handleTabRemoved);
  darkMode.onchange = null;
  delete document.documentElement.dataset.popupHeight;
  if (noticeTimer) clearTimeout(noticeTimer);
});

function saveOnPageHide() {
  persistOnPageExit();
  pageExited.value = true;
}
function resumeOnPageShow() {
  if (!pageExited.value) return;
  pageExitSaveStarted = false;
  pageExited.value = false;
  if (popupContext.active.value) void hydrateCurrentSite();
}
window.addEventListener('pagehide', saveOnPageHide);
window.addEventListener('pageshow', resumeOnPageShow);

function persistOnPageExit() {
  if (!hydrated.value || pageExitSaveStarted) return;
  pageExitSaveStarted = true;
  void persistConfigPatch(config.value).catch((error) => console.warn('[FluentRead] popup 关闭前后台保存设置失败', error));
  void handoffPendingConfigPatches(sendConfigMessage, sendConfigMessage)
    .catch((error) => console.warn('[FluentRead] popup 关闭前交接设置失败', error));
}

function showNotice(message: string, type: 'success' | 'error' | 'pending' = 'success') {
  if (!popupContext.active.value) return;
  notice.value = message;
  noticeType.value = type;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {notice.value = '';}, type === 'success' ? 2800 : 5000);
}

function openDrawer(name: DrawerName) {
  if (!popupContext.active.value) return;
  activeDrawer.value = name;
  drawerMounted.value = true;
  drawerVisible.value = true;
}
async function openOptions(section?: SettingsSection, target?: string, service?: string, repairSource = false) {
  if (!popupContext.active.value) return;
  const current = popupContext.capture();
  try {
    if (section) {
      const query = new URLSearchParams();
      if (service) query.set('service', service);
      if (target) query.set('target', target);
      if ((service || repairSource) && currentTabId.value !== null) query.set('returnTabId', String(currentTabId.value));
      const search = query.toString();
      await browser.tabs.create({url: `${browser.runtime.getURL('options.html')}${search ? `?${search}` : ''}#${section}`});
    } else {
      await browser.runtime.openOptionsPage();
    }
    if (current()) closePopupSurface();
  } catch {
    if (current()) showNotice('无法打开设置，请从扩展菜单打开设置后重试', 'error');
  }
}
</script>

<style scoped>
.notice.pending { color: var(--muted); }
</style>
