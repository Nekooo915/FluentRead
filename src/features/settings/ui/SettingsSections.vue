<!--
 * @file src/features/settings/ui/SettingsSections.vue
 * 文件职责：承载 FluentRead Lite Options 页面各业务设置分区，连接运行时配置、保留的 5 类翻译服务、全文翻译、悬浮球、视频字幕、站点规则、界面风格、高级选项和本地 JSON 备份。
 * 主要内容：移除通用设置里的按功能分配服务卡片与七国语言切换、移除视频字幕的课程自动翻译与会议平台自动开启选项、移除组合翻译与其他已删翻译服务逻辑；保留核心翻译、悬浮球、界面风格、站点规则、隐私/识别/并发/缓存设置与手动本地导入导出。
 * 模块边界：该组件负责设置 UI 编排但不实现 provider 网络、配置仓库或 feature 运行时；校验与迁移来自 core/config，持久化经 services/config。
 -->
<template>
  <section v-if="hasVisitedSection('settings-general')" v-show="props.activeSection === 'settings-general'" id="settings-general" class="settings-section general-settings-section">
    <SettingsGroup class="plugin-master-setting" data-testid="plugin-master-setting">
      <FeatureEnableCard v-model="config.on" :title="t('settings.general.masterTitle')" :description="t('settings.general.masterHelp')" @update:model-value="handlePluginStateChange" />
    </SettingsGroup>
    <SettingsGroup
      title="基础配置"
      data-testid="translation-display-settings"
      data-settings-anchor="basics" data-settings-anchor-label="基础配置"
    >
      <template #heading-extra>
        <button type="button" class="settings-navigation-link settings-heading-link" data-testid="open-translation-style-settings" @click="openSettingsSection('settings-interface')">
          <span>{{ t('settings.translationStyle.title') }}</span><el-icon aria-hidden="true"><ArrowRight /></el-icon>
        </button>
      </template>
      <SettingsItem label="默认网页翻译服务" :description="t('quickTranslation.defaultServiceDescription')">
        <div
          class="service-default-control general-service-control"
          data-testid="default-translation-service-card"
          :data-default-service="config.service"
        >
          <el-select v-model="config.service" aria-label="默认网页翻译服务" placeholder="请选择翻译服务" :search-placeholder="t('select.searchService')" filterable>
            <template #prefix><ServiceIcon :service="config.service" :label="defaultTextServiceLabel" size="small" /></template>
            <el-option v-if="selectedTextServiceUnavailableMessage" :label="defaultTextServiceLabel" :value="config.service" disabled />
            <el-option-group v-for="group in textServiceGroups" :key="group.value" :label="group.label">
              <el-option v-for="item in group.options" :key="item.value" :label="item.label" :value="item.value" :disabled="item.disabled">
                <span class="fluentread-service-option"><ServiceIcon :service="item.value" :label="item.label" size="small" /><span>{{ item.label }}</span></span>
              </el-option>
            </el-option-group>
          </el-select>
          <button
            type="button"
            class="general-service-configure"
            data-testid="configure-default-translation-service"
            @click="openInputServiceSettings(config.service)"
          >
            配置服务
          </button>
        </div>
      </SettingsItem>
      <SettingsItem
        data-testid="translation-language-setting"
        :label="t('settings.general.defaultTargetLanguage')"
        :description="t('settings.general.defaultTargetLanguageDescription')"
      >
        <el-select v-model="config.to" data-config-field="to" :aria-label="t('settings.general.defaultTargetLanguage')" :placeholder="t('settings.general.targetLanguagePlaceholder')" filterable>
          <el-option v-for="item in options.to" :key="item.value" data-i18n-ignore class="select-left" :label="getMultilingualTargetLanguageLabel(item.value, item.label)" :value="item.value" />
        </el-select>
      </SettingsItem>
      <SettingsItem label="翻译模式" description="双语对照保留原文，仅译文模式会替换原文显示">
        <SegmentedControl v-model="config.display" :options="options.display" label="翻译模式" />
      </SettingsItem>
    </SettingsGroup>
    <div v-if="selectedTextServiceUnavailableMessage" class="disabled-section" role="status">
      <strong>{{ defaultTextServiceLabel }}</strong>
      <p>{{ selectedTextServiceUnavailableMessage }}请在上方选择可用服务。</p>
    </div>
  </section>

  <section v-if="hasVisitedSection('settings-sites')" v-show="props.activeSection === 'settings-sites'" id="settings-sites" class="settings-section site-settings-section">
    <SettingsPanel name="rules">
      <SitePreferencesSettings :settings="config" :save-preferences="persistConfigPatch" />
    </SettingsPanel>
    <SettingsPanel name="adaptation">
      <ServiceRepairReturn :active="viewActive && props.activeSection === 'settings-sites'" :context="siteRepairContext" context-key="settings-sites:adaptation" />
      <SiteAdaptationSettings :model-value="config.siteAdaptation" :save-settings="saveSiteAdaptationSettings" :inspect-rule-id="siteRuleInspectId" :active="viewActive && props.activeSection === 'settings-sites'"
        :official-release="officialSiteRuleRelease" :official-updates-enabled="officialSiteRuleUpdatesEnabled" :checking-official-rules="checkingOfficialSiteRules"
        @refresh-official="updateOfficialSiteRules(true)" />
    </SettingsPanel>
    <SettingsPanel name="preview">
      <SiteRulePreview :settings="config" :adaptation="config.siteAdaptation" :scope="config.translationScope"
        :official-pack="officialSiteRuleRelease?.pack" @inspect-rule="inspectSiteRule" />
    </SettingsPanel>
  </section>

  <div class="settings-main-sections">
    <!-- 翻译服务 -->
    <section v-if="hasVisitedSection('settings-services')" v-show="props.activeSection === 'settings-services'" id="settings-services" class="settings-section">
      <SettingsPanel name="connections" :active="props.activePanel">
      <ServiceCatalog :active="viewActive && props.activeSection === 'settings-services'" :context="config"
        :add-service-feedback-visible="customProviderFeedbackVisible"
        :service="selectedConfigurationService"
        :default-service="config.service"
        :website="selectedConfigurationWebsite"
        :credential-guide="selectedConfigurationCredentialGuide"
        :selected-model="selectedConfigurationModel"
        :services="catalogServiceOptions"
        :favorite-services="config.favoriteServices"
        :disabled-services="config.disabledTranslationServices"
        :configured-services="configuredServiceIds"
        :model-options="configurationModelOptions"
        :show-model="configurationCompute.showModel"
        :maximum-models="MAX_CUSTOM_OPENAI_MODELS_PER_PROVIDER"
        :maximum-model-length="MAX_CUSTOM_OPENAI_MODEL_LENGTH"
        :custom-model-count="selectedConfigurationCustomModelCount"
        :allow-custom-models="configurationCompute.allowCustomModels"
        @update:service="setConfigurationService"
        @update:default-service="setDefaultConfigurationService"
        @toggle-availability="requestServiceRemoval"
        @update:model="selectConfigurationModel"
        @add:service="openCustomProviderDialog"
        @add:model="addConfigurationModel"
        @remove:model="removeConfigurationModel"
      >
        <template #add-service-status>
          <div v-if="customProviderFeedbackVisible" class="custom-provider-load-feedback">
            <p v-if="customProviderLoadState === 'error'" data-testid="custom-service-load-error" role="alert">{{ t('learning.panelLoadError') }}</p>
            <p v-else data-testid="custom-service-load-status" role="status">{{ t('common.loading') }}</p>
            <button type="button" data-testid="custom-service-load-close" :onClick="customProviderFeedbackActions.close">{{ t('common.close') }}</button>
          </div>
        </template>
        <template #configuration="{ connectionActionTarget }">
          <ServiceConfiguration
            :active="viewActive && props.activeSection === 'settings-services'"
            :connection-action-target="connectionActionTarget"
            :config="config"
            :service="selectedConfigurationService"
            :selected-model-thinking="selectedConfigurationModelThinking"
            :compute="configurationCompute"
            :options="options"
            :custom-provider="selectedCustomProvider"
            @update:model-thinking="updateSelectedConfigurationModelThinking"
            @update:custom-provider="updateSelectedCustomProvider"
            @delete:custom-provider="deleteSelectedCustomProvider"
          />
        </template>
      </ServiceCatalog>
      </SettingsPanel>
    </section>

    <!-- 视频字幕 -->
    <section v-if="hasVisitedSection('settings-video')" v-show="props.activeSection === 'settings-video'" id="settings-video" class="settings-section">
      <SettingsPanel name="general" :active="props.activePanel">
      <SettingsGroup>
        <FeatureEnableCard v-model="config.videoTranslationEnabled" title="视频字幕翻译" :description="t('video.description')" />
        <SettingsItem label="优先使用人工字幕" description="YouTube、Udemy、Disney+ 有目标语言人工字幕时优先使用；不可用时继续翻译原字幕" :disabled="!config.videoTranslationEnabled">
          <el-switch v-model="config.videoPreferHumanSubtitles" class="settings-toggle" aria-label="优先使用人工字幕" :disabled="!config.videoTranslationEnabled" />
        </SettingsItem>
        <SettingsItem label="视频翻译服务" description="默认跟随网页翻译服务，也可单独选择；AI 服务会提前预取字幕" :disabled="!config.videoTranslationEnabled">
          <el-select v-model="config.videoService" :empty-values="[null, undefined]" aria-label="视频字幕翻译服务" :disabled="!config.videoTranslationEnabled" placeholder="请选择服务" filterable>
            <el-option :label="t('featureServices.followDefault')" value="" />
            <el-option v-if="config.videoService && selectedVideoServiceUnavailableMessage" :label="selectedVideoServiceLabel" :value="config.videoService" disabled />
            <el-option v-for="item in videoServiceOptions" :key="item.value" class="select-left" :label="item.label" :value="item.value" />
          </el-select>
          <p v-if="selectedVideoServiceUnavailableMessage" class="capability-warning">{{ selectedVideoServiceUnavailableMessage }}</p>
        </SettingsItem>
      </SettingsGroup>
      </SettingsPanel>
      <SettingsPanel name="appearance" :active="props.activePanel">
        <VideoSubtitleAppearanceSettings :config="config" />
      </SettingsPanel>
    </section>

    <!-- 网页翻译 -->
    <section v-if="hasVisitedSection('settings-translation')" v-show="props.activeSection === 'settings-translation'" id="settings-translation" class="settings-section">
      <SettingsPanel name="reading" :active="props.activePanel">
        <ReadingAssistanceSettings :config="config" @configure-style="openSettingsSection('settings-interface', 'translation-sentence-highlight-style')" />
      </SettingsPanel>
    </section>

    <!-- 高级选项 -->
    <section v-if="hasVisitedSection('settings-advanced')" v-show="props.activeSection === 'settings-advanced'" id="settings-advanced" class="settings-section">
      <SettingsPanel name="privacy" :active="props.activePanel">
        <PrivacyProtectionSettings id="privacy-protection-settings" :config="config" :active="viewActive && props.activeSection === 'settings-advanced' && (!props.activePanel || props.activePanel === 'privacy')" />
      </SettingsPanel>
      <SettingsPanel name="recognition" :active="props.activePanel">
        <SettingsGroup :title="t('settings.pageRecognition.title')">
          <SettingsItem :label="t('settings.pageRecognition.allNodes')" :description="t('settings.pageRecognition.description')">
            <el-switch v-model="config.translationScope" active-value="all" inactive-value="content" class="settings-toggle" :aria-label="t('settings.pageRecognition.allNodes')" />
          </SettingsItem>
          <SettingsItem :label="t('settings.pageRecognition.pageTitle')" :description="t('settings.pageRecognition.pageTitleDescription')">
            <el-switch v-model="config.pageTitleTranslationEnabled" class="settings-toggle" :aria-label="t('settings.pageRecognition.pageTitle')" />
          </SettingsItem>
          <SettingsItem :label="t('settings.pageRecognition.sidebar')" :description="t('settings.pageRecognition.sidebarDescription')">
            <el-switch v-model="config.sidebarTranslationEnabled" class="settings-toggle" :aria-label="t('settings.pageRecognition.sidebar')" />
          </SettingsItem>
        </SettingsGroup>
        <ParagraphHandlingSettings :config="config" />
      </SettingsPanel>
      <SettingsPanel name="cache" :active="props.activePanel">
        <TranslationCacheSettings :config="config" :active="viewActive && props.activeSection === 'settings-advanced' && (!props.activePanel || props.activePanel === 'cache')" />
      </SettingsPanel>
    </section>

    <section v-if="hasVisitedSection('settings-general')" v-show="props.activeSection === 'settings-general'" class="settings-section settings-section-continuation">
      <SettingsGroup :title="t('settings.general.assistance')" data-settings-anchor="assistance" :data-settings-anchor-label="t('settings.general.assistance')">
        <template #heading-extra>
          <button
            type="button"
            class="settings-navigation-link settings-heading-link"
            data-testid="open-translation-settings"
            @click="openSettingsSection('settings-translation')"
          >
            <span>{{ t('settings.general.translationSettingsShortcut') }}</span>
            <el-icon aria-hidden="true"><ArrowRight /></el-icon>
          </button>
        </template>
        <SettingsItem :label="t('popup.aiContext.settingsTitle')" :description="t('popup.aiContext.how')" :help="t('settings.general.aiContextHelp')">
          <el-switch v-model="config.enableAIContext" class="settings-toggle" :aria-label="t('popup.aiContext.settingsTitle')" />
        </SettingsItem>
        <SettingsItem id="floating-ball-toggle" :label="t('settings.general.floatingBall')">
          <template #description>
            <small>{{ t('settings.general.floatingBallDescription') }} <button type="button" class="settings-inline-link" data-testid="open-floating-ball-settings" @click="openSettingsSection('settings-translation', 'floating-ball-settings')">{{ t('settings.general.floatingBallSettingsAction') }}</button></small>
          </template>
          <el-switch v-model="floatingBallEnabled" class="settings-toggle" :aria-label="t('settings.general.floatingBall')" />
        </SettingsItem>
        <ToolbarClickSetting :config="config" />
        <SettingsItem :label="t('settings.general.progressPanel')" :description="t('settings.general.progressPanelDescription')">
          <el-switch v-model="config.translationProgressPanelEnabled" class="settings-toggle" :aria-label="t('settings.general.progressPanel')" @change="handleTranslationProgressPanelChange" />
        </SettingsItem>
      </SettingsGroup>
      <SettingsGroup :title="t('settings.general.preferences')" data-settings-anchor="preferences" :data-settings-anchor-label="t('settings.general.preferences')">
        <SettingsItem :label="t('settings.general.theme')" :description="t('settings.general.themeDescription')">
          <SegmentedControl v-model="config.theme" :options="options.theme" :label="t('settings.general.theme')" />
        </SettingsItem>
      </SettingsGroup>
    </section>

    <section v-if="hasVisitedSection('settings-interface')" v-show="props.activeSection === 'settings-interface'" id="settings-interface" class="settings-section">
      <InterfaceSettings :config="config" :active-panel="props.activePanel" :active="viewActive && props.activeSection === 'settings-interface'" />
    </section>

    <section v-if="hasVisitedSection('settings-translation')" v-show="props.activeSection === 'settings-translation'" class="settings-section settings-section-continuation">
      <SettingsPanel name="page" :active="props.activePanel">
        <SettingsGroup title="全文翻译" description="设置启动全文翻译的方式、处理范围和网页内入口">
          <SettingsItem :label="t('quickTranslation.commonFullPageShortcut')" description="设置快捷键，用于在全文翻译和原文之间切换">
            <div class="hotkey-config">
              <el-select :model-value="config.floatingBallHotkey" aria-label="全文翻译快捷键" placeholder="选择快捷键" @change="handleHotkeyChange">
                <el-option v-for="item in options.floatingBallHotkeys" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <div v-if="config.floatingBallHotkey === 'custom'" class="custom-hotkey-display">
                <span v-if="config.customFloatingBallHotkey" class="hotkey-text">{{ getCustomHotkeyDisplayName() }}</span>
                <span v-else class="hotkey-text placeholder-text">点击设置自定义快捷键</span>
                <el-button size="small" type="text" class="edit-button" aria-label="编辑全文翻译快捷键" title="编辑全文翻译快捷键" @click="openCustomHotkeyDialog">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </div>
            </div>
          </SettingsItem>
          <AiMultiSegmentSettings :config="config" :active="viewActive && props.activeSection === 'settings-translation' && (!props.activePanel || props.activePanel === 'page')"
            @update:limits="setAIMultiSegmentLimits" />
          <SettingsItem label="全文翻译范围" help="“按阅读进度”预翻译可视区域附近的内容；“立即翻译到网页底部”处理已加载的整页及后续新增内容，无需自动滚动，可能增加无限滚动页面的请求量和费用；下次启动全文翻译时生效">
            <SegmentedControl v-model="config.fullPageTranslationMode" :options="fullPageTranslationModeOptions" label="全文翻译范围" />
          </SettingsItem>
        </SettingsGroup>
      </SettingsPanel>
      <SettingsPanel name="context-menu" id="context-menu-settings" :active="props.activePanel">
        <ContextMenuSettings :active="viewActive && props.activeSection === 'settings-translation' && (!props.activePanel || props.activePanel === 'context-menu')" :config="config" />
      </SettingsPanel>
    </section>

    <section v-if="hasVisitedSection('settings-translation')" v-show="props.activeSection === 'settings-translation'" id="floating-ball-settings" class="settings-section settings-section-continuation">
      <SettingsPanel name="floating-ball" :active="props.activePanel">
        <FloatingBallSettings :config="config" />
      </SettingsPanel>
    </section>

    <section v-if="hasVisitedSection('settings-translation')" v-show="props.activeSection === 'settings-translation'" class="settings-section settings-section-continuation">
      <SettingsPanel name="excluded-languages" id="excluded-language-settings" :active="props.activePanel">
        <ExcludedLanguageSettings v-model="config.excludedLanguages" />
      </SettingsPanel>
    </section>

    <section v-if="hasVisitedSection('settings-advanced')" v-show="props.activeSection === 'settings-advanced'" class="settings-section settings-section-continuation">
      <SettingsPanel name="requests" :active="props.activePanel">
        <SettingsGroup :title="t('settings.requestLimits.globalTitle')" :description="t('settings.requestLimits.globalHelp')">
          <div data-testid="translation-scheduler-settings">
            <RequestLimitFields :active="viewActive && props.activeSection === 'settings-advanced'" :model-value="config" @update:model-value="Object.assign(config, $event)" />
            <SettingsItem data-testid="ai-request-timeout-settings" :label="t('settings.requestLimits.aiTimeout')" :description="t('settings.requestLimits.aiTimeoutHelp')">
              <SettingsNumberInput
                :key="requestSettingsContext.revision.value"
                :model-value="aiRequestTimeoutSeconds"
                :disabled="!requestSettingsContext.active.value"
                :unit="t('settings.requestLimits.seconds')"
                :aria-label="t('settings.requestLimits.aiTimeout')"
                :min="MIN_AI_REQUEST_TIMEOUT_MS / 1000"
                :max="MAX_AI_REQUEST_TIMEOUT_MS / 1000"
                :step="1"
                :onChange="requestSettingsActions.timeout"
              />
            </SettingsItem>
            <SettingsItem label="失败后最多重试">
              <SettingsNumberInput :key="requestSettingsContext.revision.value" :model-value="config.translationMaxRetries" :disabled="!requestSettingsContext.active.value" aria-label="失败后最多重试" :min="0" :max="10" :onChange="requestSettingsActions.retries" />
            </SettingsItem>
            <SettingsItem
              :label="t('settings.requestLimits.apiKeyRecovery')"
              :description="t('settings.requestLimits.apiKeyRecoveryHelp')"
            >
              <div data-testid="api-key-recovery-setting">
                <SettingsNumberInput
                  :key="requestSettingsContext.revision.value"
                  :disabled="!requestSettingsContext.active.value"
                  :model-value="apiKeyRecoveryMinutes"
                  :unit="t('settings.requestLimits.minutes')"
                  :aria-label="t('settings.requestLimits.apiKeyRecovery')"
                  :min="MIN_API_KEY_RECOVERY_MINUTES"
                  :max="MAX_API_KEY_RECOVERY_MINUTES"
                  :step="1"
                  :onChange="requestSettingsActions.keyRecovery"
                />
              </div>
            </SettingsItem>
            <details class="request-retry-settings" data-testid="translation-retry-settings">
              <summary>{{ t('settings.requestLimits.retryIntervals') }}</summary>
              <SettingsItem :label="t('settings.requestLimits.initialRetryWait')">
                <SettingsNumberInput :key="requestSettingsContext.revision.value" :disabled="!requestSettingsContext.active.value" :model-value="config.translationBackoffBaseMs" unit="ms" :aria-label="t('settings.requestLimits.initialRetryWait')" :min="MIN_TRANSLATION_BACKOFF_BASE_MS" :max="MAX_TRANSLATION_BACKOFF_BASE_MS" :step="100" :onChange="requestSettingsActions.backoffBase" />
              </SettingsItem>
              <SettingsItem :label="t('settings.requestLimits.maximumRetryWait')">
                <SettingsNumberInput :key="requestSettingsContext.revision.value" :disabled="!requestSettingsContext.active.value" :model-value="config.translationBackoffMaxMs" unit="ms" :aria-label="t('settings.requestLimits.maximumRetryWait')" :min="Math.max(MIN_TRANSLATION_BACKOFF_MAX_MS, config.translationBackoffBaseMs)" :max="MAX_TRANSLATION_BACKOFF_MAX_MS" :step="1000" :onChange="requestSettingsActions.backoffMax" />
              </SettingsItem>
            </details>
          </div>
        </SettingsGroup>
      </SettingsPanel>
    </section>
  </div>

  <!-- 全文翻译自定义快捷键对话框 -->
  <CustomHotkeyInput
    v-if="showCustomHotkeyDialog"
    v-model="showCustomHotkeyDialog"
    :current-value="config.customFloatingBallHotkey"
    :validate="validateCustomFullPageHotkey"
    @confirm="handleCustomHotkeyConfirm"
    @cancel="handleCustomHotkeyCancel"
  />
  <CustomOpenAIProviderDialog v-if="customProviderDialogRequested"
    v-model="customProviderDialogOpen" :active="serviceAvailabilityContext.active.value" :config="config" :context="config"
    :restore-services="removedServiceOptions"
    @submit="createCustomProvider" @submit:restore="restoreService"
  />
  <el-dialog v-if="pendingServiceAvailability" :model-value="true" data-service-availability-dialog
    :title="t('settings.services.library.removeNamedService', {service: pendingServiceAvailability.item.label})"
    width="min(400px, calc(100vw - 24px))" align-center :show-close="false" :close-on-click-modal="false"
    :onUpdate:modelValue="serviceAvailabilityActions.update"
    @keydown.enter.exact="serviceAvailabilityActions.handleEnter">
    <p>{{ t('settings.services.library.availabilityHelp') }}</p>
    <p v-if="pendingServiceAvailability.replacement">{{ t('settings.services.library.defaultReplacement', {service: pendingServiceAvailability.replacement.label}) }}</p>
    <template #footer>
      <el-button data-service-availability-cancel :onClick="serviceAvailabilityActions.cancel">{{ t('common.cancel') }}</el-button>
      <el-button data-service-availability-confirm type="danger" :onClick="serviceAvailabilityActions.confirm">{{ t('common.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import SettingsPanel from './components/SettingsPanel.vue';
import PrivacyProtectionSettings from './PrivacyProtectionSettings.vue';
import ServiceRepairReturn from './services/ServiceRepairReturn.vue';
import FeatureEnableCard from '@/src/ui/components/FeatureEnableCard.vue';
import {computed, defineAsyncComponent, nextTick, ref, shallowRef, watch, onActivated, onBeforeUnmount, onDeactivated, onUnmounted} from 'vue';
import {customModelString, defaultOption, getMultilingualTargetLanguageLabel, options, services, servicesType} from '@/src/core/config/catalog';
import {
  createNextCustomOpenAIProviderId,
  getCustomOpenAIProvider,
  isCustomOpenAIProviderId,
  LEGACY_CUSTOM_OPENAI_PROVIDER_ID,
  MAX_CUSTOM_OPENAI_MODEL_LENGTH,
  MAX_CUSTOM_OPENAI_MODELS_PER_PROVIDER,
  normalizeCustomOpenAIModels,
  normalizeCustomOpenAIProviders,
  removeCustomOpenAIProvider,
  withCustomOpenAIServiceOptions,
  type CustomOpenAIProvider,
} from '@/src/core/config/customOpenAI';
import {withModelThinkingPreference} from '@/src/core/config/modelThinking';
import {useServiceModelOptions} from './services/modelOptions';
import {
  Config,
  MAX_TRANSLATION_BACKOFF_BASE_MS,
  MAX_TRANSLATION_BACKOFF_MAX_MS,
  API_KEY_RECOVERY_MINUTE_MS,
  MAX_API_KEY_RECOVERY_MINUTES,
  MIN_API_KEY_RECOVERY_MINUTES,
  MIN_TRANSLATION_BACKOFF_BASE_MS,
  MIN_TRANSLATION_BACKOFF_MAX_MS,
  MAX_AI_REQUEST_TIMEOUT_MS,
  MIN_AI_REQUEST_TIMEOUT_MS,
  normalizeConfig,
  normalizeApiKeyRecoveryMs,
  normalizeAiRequestTimeoutMs,
  normalizeTranslationBackoffBaseMs,
  normalizeTranslationBackoffMaxMs,
} from '@/src/core/config/model';
import {ArrowRight, Edit} from '@element-plus/icons-vue';
import {ElMessage} from 'element-plus';
import browser from 'webextension-polyfill';
import {isBrowserTabId} from '@/src/platform/browser/ids';

const CustomHotkeyInput = defineAsyncComponent(() => import('@/src/ui/components/CustomHotkeyInput.vue'));
import ServiceIcon from '@/src/ui/components/ServiceIcon.vue';
import {hasSavedServiceConfiguration} from '@/src/ui/view-model/serviceLibrary';
import {getServiceCredentialGuide, getServiceWebsite} from '@/src/ui/view-model/serviceCatalog';
const ServiceCatalog = defineAsyncComponent(() => import('./services/ServiceCatalog.vue'));
const ServiceConfiguration = defineAsyncComponent(() => import('./services/ServiceConfiguration.vue'));
const customProviderLoadState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
const CustomOpenAIProviderDialog = defineAsyncComponent(async () => {
  customProviderLoadState.value = 'loading';
  try {
    const component = await import('./services/CustomOpenAIProviderDialog.vue');
    if (!disposed) customProviderLoadState.value = 'ready';
    return component.default;
  } catch {
    if (!disposed) customProviderLoadState.value = 'error';
    return {name: 'CustomProviderLoadFailure', inheritAttrs: false, render: () => null};
  }
});
const openInputServiceSettings = (service: string) => {setConfigurationService(service); openSettingsSection('settings-services', 'connections');};
const FloatingBallSettings = defineAsyncComponent(() => import('./FloatingBallSettings.vue'));
import ToolbarClickSetting from './components/ToolbarClickSetting.vue';
const SiteAdaptationSettings = defineAsyncComponent(() => import('./SiteAdaptationSettings.vue'));
const SitePreferencesSettings = defineAsyncComponent(() => import('./SitePreferencesSettings.vue'));
const SiteRulePreview = defineAsyncComponent(() => import('./SiteRulePreview.vue'));
const siteRuleInspectId = ref('');
async function inspectSiteRule(id: string) {
  siteRuleInspectId.value = '';
  const revision = navigationRevision;
  await nextTick();
  await nextTick();
  if (disposed || !viewActive.value || revision !== navigationRevision) return;
  siteRuleInspectId.value = id;
  openSettingsSection('settings-sites', 'adaptation');
}
import type {SiteAdaptationSettings as SiteAdaptationConfig} from '@/src/core/site-adaptation/types';
import type {OfficialSiteRuleRelease} from '@/src/core/site-adaptation/officialRelease';
import {officialSiteRuleUpdatesEnabled, readOfficialSiteRuleRelease, refreshOfficialSiteRuleRelease} from '@/src/services/site-adaptation/officialClient';
import {getApiKeyRequirementKey, getMissingCredentialMessage, isApiKeyRequired} from '@/src/core/config/validation';
const VideoSubtitleAppearanceSettings = defineAsyncComponent(() => import('./VideoSubtitleAppearanceSettings.vue'));
const InterfaceSettings = defineAsyncComponent(() => import('./InterfaceSettings.vue'));
const ParagraphHandlingSettings = defineAsyncComponent(() => import('./ParagraphHandlingSettings.vue'));
const TranslationCacheSettings = defineAsyncComponent(() => import('./TranslationCacheSettings.vue'));
import AiMultiSegmentSettings from './AiMultiSegmentSettings.vue';
import type {AiMultiSegmentLimits} from '@/src/core/config/aiMultiSegment';
import SettingsGroup from './components/SettingsGroup.vue';
import ExcludedLanguageSettings from './ExcludedLanguageSettings.vue';
import ReadingAssistanceSettings from './ReadingAssistanceSettings.vue';
import SettingsItem from './components/SettingsItem.vue';
import SettingsNumberInput from './components/SettingsNumberInput.vue';
import RequestLimitFields from './services/RequestLimitFields.vue';
import SegmentedControl from './components/SegmentedControl.vue';
import {localizeServiceOptions, useUiI18n} from '@/src/ui/i18n';
import {applyInterfaceTheme} from '@/src/ui/interfaceAppearance';
const ContextMenuSettings = defineAsyncComponent(() => import('./ContextMenuSettings.vue'));
import {useTranslationShortcutSettings} from './useTranslationShortcutSettings';
import {useSettingsActionContext} from '../model/useSettingsActionContext';
import {useConfigEditor} from '../model/useConfigEditor';
import {removeConfiguredModel} from '@/src/core/config/modelEditing';
import {config as runtimeConfig, configReady, requestConfigPatch, handoffPendingConfigPatches, subscribeConfig} from '@/src/services/config/store';
import {filterAvailableTranslationServices, getTranslationServiceUnavailableMessage} from '@/src/services/translation/capabilities';
import {markDisabledTranslationServices, normalizeDisabledTranslationServices} from '@/src/core/config/serviceAvailability';

const props = withDefaults(defineProps<{
  activeSection?: string
  activePanel?: string
  settingsHashPrefix?: string
  queryRoot?: ParentNode | null
  appearanceRoot?: HTMLElement | null
  onNavigateSection?: (section: string, targetId?: string) => void
}>(), {activeSection: 'settings-general'});

const visitedSections = ref(new Set<string>());
const hasVisitedSection = (section: string): boolean => visitedSections.value.has(section);
watch(() => props.activeSection, (section) => {
  if (!section || visitedSections.value.has(section)) return;
  visitedSections.value = new Set([...visitedSections.value, section]);
}, {immediate: true});
const {t, translateLegacy} = useUiI18n();
const viewActive = ref(true);
let disposed = false;
const officialSiteRuleRelease = shallowRef<OfficialSiteRuleRelease | null>(null);
const checkingOfficialSiteRules = ref(false);
async function updateOfficialSiteRules(refresh = false): Promise<void> {
  if (!officialSiteRuleUpdatesEnabled || checkingOfficialSiteRules.value || disposed) return;
  checkingOfficialSiteRules.value = true;
  try {
    const release = await (refresh ? refreshOfficialSiteRuleRelease() : readOfficialSiteRuleRelease());
    if (!disposed && release) officialSiteRuleRelease.value = release;
  } finally {
    if (!disposed) checkingOfficialSiteRules.value = false;
  }
}
watch(() => viewActive.value && props.activeSection === 'settings-sites', active => {
  if (active) void updateOfficialSiteRules();
}, {immediate: true});
let navigationRevision = 0;
let pendingScroll: number | undefined;
let scrollDestination: string | undefined;

function cancelPendingScroll(): void {
  navigationRevision += 1;
  if (pendingScroll !== undefined) window.cancelAnimationFrame(pendingScroll);
  pendingScroll = undefined;
  scrollDestination = undefined;
}
onActivated(() => {viewActive.value = true;});
onDeactivated(() => {viewActive.value = false; customProviderDialogOpen.value = false; cancelPendingScroll();});
onBeforeUnmount(() => {disposed = true; viewActive.value = false; cancelPendingScroll();});
watch(() => props.activeSection, (section) => {
  if (section !== scrollDestination) cancelPendingScroll();
  if (section !== 'settings-services') customProviderDialogOpen.value = false;
});

function openSettingsSection(section: string, targetId?: string): void {
  if (disposed || !viewActive.value) return;
  cancelPendingScroll();
  if (props.onNavigateSection) {props.onNavigateSection(section, targetId); return;}
  const nextHash = props.settingsHashPrefix ? `${props.settingsHashPrefix}/${section}` : `#${section}`;
  if (window.location.hash !== nextHash) window.location.hash = nextHash;
  if (!targetId) return;
  scrollDestination = section;
  const revision = navigationRevision;
  let attempts = 0;
  const scrollWhenMounted = () => {
    if (disposed || !viewActive.value || revision !== navigationRevision) return;
    pendingScroll = undefined;
    const target = (props.queryRoot || document).querySelector<HTMLElement>(`#${targetId}`);
    if (target) {target.scrollIntoView({block: 'start'}); return;}
    attempts += 1;
    if (attempts < 20) pendingScroll = window.requestAnimationFrame(scrollWhenMounted);
  };
  pendingScroll = window.requestAnimationFrame(scrollWhenMounted);
}

const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
function updateTheme(theme: string) {
  if (disposed) return;
  if (theme === 'auto') applyInterfaceTheme(darkModeMediaQuery.matches, props.appearanceRoot);
  else applyInterfaceTheme(theme === 'dark', props.appearanceRoot);
}

const config = ref(new Config());
const siteRepairContext = computed(() => [config.value, JSON.stringify([config.value.siteAdaptation, config.value.translationScope])]);
const sendConfigMessage = browser.runtime.sendMessage.bind(browser.runtime);
const persistConfigPatch = (value: unknown) => requestConfigPatch(value, sendConfigMessage);
const saveSiteAdaptationSettings = (value: SiteAdaptationConfig): Promise<void> => persistConfigPatch({siteAdaptation: value});
let hydrated = false;
let pageExitSaveStarted = false;
const configEditor = useConfigEditor({
  copySnapshot: normalizeConfig,
  readDraft: () => config.value,
  writeDraft: snapshot => {Object.assign(config.value, snapshot);},
  saveDraft: snapshot => persistConfigPatch(snapshot),
  subscribe: subscribeConfig,
  ready: configReady,
  readAuthority: () => runtimeConfig,
  flush: 'sync',
  onEdited: () => {pageExitSaveStarted = false;},
  onSaved: () => {},
  onSaveError: error => console.warn('[FluentRead] 保存设置失败', error),
  onReady: () => {
    if (configurationService.value === null && /^(?:chrome|moz)-extension:$/u.test(window.location.protocol) && requestedConfigurationService
      && getCustomOpenAIProvider(config.value.customOpenAIProviders, requestedConfigurationService)) {
      configurationService.value = requestedConfigurationService;
    }
    hydrated = true;
    updateTheme(config.value.theme || 'auto');
  },
  onReadyError: error => console.warn('[FluentRead] 无法读取本地配置', error),
});

const {
  getCustomHotkeyDisplayName,
  handleCustomHotkeyCancel,
  handleCustomHotkeyConfirm,
  handleHotkeyChange,
  openCustomHotkeyDialog,
  showCustomHotkeyDialog,
  validateCustomFullPageHotkey,
} = useTranslationShortcutSettings(config, () => viewActive.value && props.activeSection === 'settings-translation', () => configEditor.applying);

const customProviderDialogOpen = ref(false);
const customProviderDialogRequested = ref(false);
const customProviderFeedbackContext = useSettingsActionContext(
  () => !disposed && viewActive.value && props.activeSection === 'settings-services'
    && customProviderDialogOpen.value && (customProviderLoadState.value === 'loading' || customProviderLoadState.value === 'error'),
  () => [config.value],
);
const customProviderFeedbackVisible = computed(() => customProviderFeedbackContext.active.value);
const customProviderFeedbackActions = computed(() => {
  const owns = customProviderFeedbackContext.capture();
  return {close: () => {if (owns()) customProviderDialogOpen.value = false;}};
});

function persistOnPageExit() {
  if (!hydrated || pageExitSaveStarted) return;
  pageExitSaveStarted = true;
  void persistConfigPatch(config.value).catch((error) => console.warn('[FluentRead] 设置页关闭前后台保存失败', error));
  void handoffPendingConfigPatches(sendConfigMessage, sendConfigMessage)
    .catch((error) => console.warn('[FluentRead] 设置页关闭前交接设置失败', error));
}

onUnmounted(() => {
  persistOnPageExit();
  window.removeEventListener('beforeunload', persistOnPageExit);
  window.removeEventListener('pagehide', saveOnPageHide);
});
function saveOnPageHide() {persistOnPageExit();}
window.addEventListener('beforeunload', persistOnPageExit);
window.addEventListener('pagehide', saveOnPageHide);

const requestedConfigurationService = new URLSearchParams(window.location.search).get('service');
const configurationService = ref<string | null>(
  /^(?:chrome|moz)-extension:$/u.test(window.location.protocol)
    && Object.values(services).some(service => service === requestedConfigurationService)
    ? requestedConfigurationService : null,
);
const selectedConfigurationService = computed(() => configurationService.value ?? config.value.service);
const selectedConfigurationWebsite = computed(() => {
  const service = selectedConfigurationService.value;
  const endpoint = isCustomOpenAIProviderId(service)
    ? getCustomOpenAIProvider(config.value.customOpenAIProviders, service)?.endpoint
    : config.value.custom;
  return getServiceWebsite(service, {endpoint});
});
const selectedConfigurationCredentialGuide = computed(() => getServiceCredentialGuide(selectedConfigurationService.value));

watch(
  () => [
    configurationService.value,
    config.value.disabledTranslationServices.includes(configurationService.value ?? ''),
    config.value.customOpenAIProviders.map(provider => provider.id),
  ] as const,
  ([service, removed]) => {
    if (service && (removed || isCustomOpenAIProviderId(service) && !getCustomOpenAIProvider(config.value.customOpenAIProviders, service))) {
      configurationService.value = null;
    }
  },
  {immediate: true, flush: 'sync'},
);

const setConfigurationService = (value: string) => {configurationService.value = value;};
const serviceOptionsWithCustomProviders = computed(() => localizeServiceOptions(
  withCustomOpenAIServiceOptions(options.services, config.value.customOpenAIProviders),
  config.value.customOpenAIProviders,
  translateLegacy,
));
const platformAvailableServiceOptions = computed(() => filterAvailableTranslationServices(serviceOptionsWithCustomProviders.value));
const catalogServiceOptions = computed(() => platformAvailableServiceOptions.value);
const availableServiceOptions = computed(() => markDisabledTranslationServices(platformAvailableServiceOptions.value, config.value.disabledTranslationServices));
const setDefaultConfigurationService = (value: string) => {
  if (!viewActive.value || props.activeSection !== 'settings-services'
    || value !== selectedConfigurationService.value
    || !availableServiceOptions.value.some(item => item.value === value && !item.disabled)) return;
  config.value.service = value;
};
const manageableServiceOptions = computed(() => platformAvailableServiceOptions.value
  .filter(item => !item.disabled && item.value !== 'machine' && item.value !== 'ai'));
const removedServiceOptions = computed(() => {
  const disabled = new Set(normalizeDisabledTranslationServices(config.value.disabledTranslationServices));
  return manageableServiceOptions.value.filter(item => disabled.has(item.value));
});
function resolveServiceAvailabilityChange(service: string, enabled: boolean) {
  const serviceOptions = manageableServiceOptions.value;
  const item = serviceOptions.find(option => option.value === service);
  const disabled = new Set(normalizeDisabledTranslationServices(config.value.disabledTranslationServices));
  if (!item || disabled.has(service) === !enabled) return;
  if (enabled) disabled.delete(service);
  else disabled.add(service);
  const fallback = serviceOptions.find(option => !disabled.has(option.value));
  if (!fallback) return;
  const replacement = disabled.has(config.value.service) ? fallback : undefined;
  return {item, disabled, replacement};
}
const serviceAvailabilityContext = useSettingsActionContext(
  () => viewActive.value && props.activeSection === 'settings-services' && (!props.activePanel || props.activePanel === 'connections'),
  () => [config.value, selectedConfigurationService.value],
);
const pendingServiceAvailability = shallowRef<(Pick<NonNullable<ReturnType<typeof resolveServiceAvailabilityChange>>, 'item' | 'replacement'> & {current: () => boolean}) | null>(null);
function requestServiceRemoval(service: string, enabled: boolean): void {
  if (!serviceAvailabilityContext.active.value || pendingServiceAvailability.value || enabled !== false) return;
  const change = resolveServiceAvailabilityChange(service, false);
  if (change) {
    const {item, replacement} = change;
    pendingServiceAvailability.value = {item, replacement, current: serviceAvailabilityContext.capture()};
  }
}
const currentServiceAvailabilityChange = computed(() => {
  const request = pendingServiceAvailability.value;
  if (!request?.current()) return;
  const change = resolveServiceAvailabilityChange(request.item.value, false);
  if (change?.item === request.item && change.replacement === request.replacement) return change;
});
watch(currentServiceAvailabilityChange, change => {if (!change) pendingServiceAvailability.value = null;}, {flush: 'sync'});
const serviceAvailabilityActions = computed(() => {
  const request = pendingServiceAvailability.value;
  const cancel = () => {if (request === pendingServiceAvailability.value) pendingServiceAvailability.value = null;};
  const confirm = () => {
    if (!request || request !== pendingServiceAvailability.value) return;
    const change = currentServiceAvailabilityChange.value;
    cancel();
    if (!change) return;
    applyServiceAvailabilityChange(change);
  };
  return {
    cancel,
    update: (open: boolean) => {if (!open) cancel();},
    confirm,
    handleEnter: (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing) {event.preventDefault(); return;}
      if (event.target === event.currentTarget) {event.preventDefault(); confirm();}
    },
  };
});
function applyServiceAvailabilityChange(change: NonNullable<ReturnType<typeof resolveServiceAvailabilityChange>>): void {
  updateConfigAtomically(draft => {
    draft.disabledTranslationServices = [...change.disabled];
    if (change.replacement) draft.service = change.replacement.value;
  });
}
function restoreService(service: string): void {
  if (!serviceAvailabilityContext.active.value) return;
  const change = resolveServiceAvailabilityChange(service, true);
  if (change) applyServiceAvailabilityChange(change);
}
const textServiceGroups = computed(() => {
  const groups: {value: string; label: string; options: typeof availableServiceOptions.value}[] = [];
  for (const item of availableServiceOptions.value) {
    if (item.value === 'machine' || item.value === 'ai') groups.push({value: item.value, label: item.label, options: []});
    else groups.at(-1)?.options.push(item);
  }
  return groups.filter(group => group.options.length > 0);
});
const defaultTextServiceLabel = computed(() => serviceOptionsWithCustomProviders.value.find((item: any) => item.value === config.value.service)?.label || config.value.service);
const selectedVideoServiceLabel = computed(() => {
  const service = config.value.videoService || config.value.service;
  return serviceOptionsWithCustomProviders.value.find(item => item.value === service)?.label || service;
});
const configuredServiceIds = computed(() => platformAvailableServiceOptions.value
  .filter(item => !item.disabled && hasSavedServiceConfiguration(item.value, config.value))
  .map(item => item.value));
const videoServiceOptions = computed(() => availableServiceOptions.value.filter((item: any) => !item.disabled));
const selectedTextServiceUnavailableMessage = computed(() => config.value.disabledTranslationServices.includes(config.value.service)
  ? t('settings.services.library.serviceDisabledMessage') : getTranslationServiceUnavailableMessage(config.value.service));
const selectedVideoServiceUnavailableMessage = computed(() => {
  const service = config.value.videoService || config.value.service;
  return config.value.disabledTranslationServices.includes(service)
    ? t('settings.services.library.serviceDisabledMessage') : getTranslationServiceUnavailableMessage(service);
});
const fullPageTranslationModeOptions = [
  {value: 'viewport', label: '按阅读进度'},
  {value: 'all', label: '翻译到页底'},
];

interface CustomProviderDraft {name: string; endpoint: string; apiKey: string; model: string}
function setAIMultiSegmentLimits(limits: AiMultiSegmentLimits): void {updateConfigAtomically(draft => Object.assign(draft, limits));}
function updateConfigAtomically(update: (draft: Config) => void): void {
  const draft = normalizeConfig(config.value);
  update(draft);
  config.value = normalizeConfig(draft);
}

const {
  builtInModels: builtInConfigurationModels,
  customModelCount: selectedConfigurationCustomModelCount,
  modelOptions: configurationModelOptions,
  selectedCustomProvider,
  selectedModel: selectedConfigurationModel,
  selectedModelThinking: selectedConfigurationModelThinking,
} = useServiceModelOptions(config, selectedConfigurationService);

function openCustomProviderDialog(): void {
  if (disposed || !serviceAvailabilityContext.active.value) return;
  customProviderDialogRequested.value = true;
  customProviderDialogOpen.value = true;
}

function createCustomProvider(draft: CustomProviderDraft): void {
  if (disposed || !viewActive.value || props.activeSection !== 'settings-services') return;
  const id = createNextCustomOpenAIProviderId(config.value.customOpenAIProviders);
  const provider: CustomOpenAIProvider = {id, name: draft.name, endpoint: draft.endpoint, models: [draft.model]};
  updateConfigAtomically((next) => {
    next.customOpenAIProviders = normalizeCustomOpenAIProviders([...next.customOpenAIProviders, provider]);
    next.model[id] = draft.model;
    next.documentModel[id] = draft.model;
    next.system_role[id] = defaultOption.system_role;
    next.user_role[id] = defaultOption.user_role;
    if (draft.apiKey) next.token[id] = draft.apiKey;
    next.modelThinking = withModelThinkingPreference(next.modelThinking, id, draft.model, false);
  });
  configurationService.value = id;
  ElMessage({message: '自定义服务已添加', type: 'success', grouping: true, duration: 1800});
}

function updateSelectedCustomProvider(patch: Partial<Pick<CustomOpenAIProvider, 'name' | 'endpoint'>>): void {
  const service = selectedConfigurationService.value;
  config.value.customOpenAIProviders = config.value.customOpenAIProviders.map((provider) => (
    provider.id === service ? {...provider, ...patch} : provider
  ));
}

function deleteSelectedCustomProvider(): void {
  const service = selectedConfigurationService.value;
  if (!getCustomOpenAIProvider(config.value.customOpenAIProviders, service)) return;
  updateConfigAtomically((next) => {
    next.customOpenAIProviders = removeCustomOpenAIProvider(next.customOpenAIProviders, service);
    for (const mapping of [
      next.token, next.model, next.documentModel, next.customModel, next.customModels, next.modelThinking,
      next.documentCustomModel, next.proxy, next.system_role, next.user_role, next.customBody, next.customHeaders,
    ]) delete mapping[service];
    if (next.service === service) next.service = defaultOption.service;
    if (next.documentService === service) next.documentService = '';
    if (next.videoService === service) next.videoService = '';
    next.translationCenterServices = next.translationCenterServices.filter((item) => item !== service);
    if (service === LEGACY_CUSTOM_OPENAI_PROVIDER_ID) next.custom = defaultOption.custom;
  });
  configurationService.value = config.value.service;
  ElMessage({message: '自定义服务已删除', type: 'success', grouping: true, duration: 1800});
}

function selectConfigurationModel(model: string): void {
  const service = selectedConfigurationService.value;
  if (selectedCustomProvider.value || builtInConfigurationModels.value.includes(model)) {
    config.value.model[service] = model;
    return;
  }
  updateConfigAtomically((next) => {
    next.customModel[service] = model;
    next.model[service] = customModelString;
  });
}

function updateSelectedConfigurationModelThinking(enabled: boolean): void {
  const service = selectedConfigurationService.value;
  const model = selectedConfigurationModel.value;
  if (!model) return;
  config.value.modelThinking = withModelThinkingPreference(config.value.modelThinking, service, model, enabled);
}

function addConfigurationModel(model: string): void {
  const service = selectedConfigurationService.value;
  const provider = selectedCustomProvider.value;
  if (provider) {
    updateConfigAtomically((next) => {
      next.customOpenAIProviders = normalizeCustomOpenAIProviders(
        next.customOpenAIProviders.map((item) => item.id === service ? {...item, models: [...item.models, model]} : item),
      );
      next.model[service] = model;
      next.modelThinking = withModelThinkingPreference(next.modelThinking, service, model, false);
    });
    return;
  }
  updateConfigAtomically((next) => {
    next.customModels[service] = normalizeCustomOpenAIModels([...(next.customModels[service] || []), model]);
    next.customModel[service] = model;
    next.model[service] = customModelString;
    next.modelThinking = withModelThinkingPreference(next.modelThinking, service, model, false);
  });
}

function removeConfigurationModel(model: string): void {
  updateConfigAtomically(next => removeConfiguredModel(next, selectedConfigurationService.value, model, builtInConfigurationModels.value[0] || ''));
}

const configurationCompute = ref({
  showAI: computed(() => isCustomOpenAIProviderId(selectedConfigurationService.value) || servicesType.isAI(selectedConfigurationService.value)),
  showProxy: computed(() => isCustomOpenAIProviderId(selectedConfigurationService.value) || servicesType.isUseProxy(selectedConfigurationService.value)),
  showModel: computed(() => isCustomOpenAIProviderId(selectedConfigurationService.value) || servicesType.isUseModel(selectedConfigurationService.value)),
  showCustomBody: computed(() => isCustomOpenAIProviderId(selectedConfigurationService.value) || servicesType.isUseCustomBody(selectedConfigurationService.value)),
  showToken: computed(() => isCustomOpenAIProviderId(selectedConfigurationService.value) || servicesType.isUseToken(selectedConfigurationService.value)),
  allowCustomModels: computed(() => true),
  requireApiKey: computed({
    get: () => isApiKeyRequired(selectedConfigurationService.value, config.value),
    set: (value: boolean) => {config.value.requireApiKey[getApiKeyRequirementKey(selectedConfigurationService.value, config.value)] = value;},
  }),
  credentialWarning: computed(() => getMissingCredentialMessage(selectedConfigurationService.value, config.value)),
  showCustomOpenAI: computed(() => Boolean(getCustomOpenAIProvider(config.value.customOpenAIProviders, selectedConfigurationService.value))),
  showDeepseekApiType: computed(() => selectedConfigurationService.value === services.deepseek),
});

watch(() => config.value.theme, (newTheme) => {updateTheme(newTheme || 'auto');});
darkModeMediaQuery.onchange = () => {if (config.value.theme === 'auto') updateTheme('auto');};
onUnmounted(() => {darkModeMediaQuery.onchange = null; configEditor.dispose();});

type SettingsBroadcastType = 'toggleFloatingBall' | 'toggleTranslationProgressPanel';
const pendingBroadcasts = new Set<SettingsBroadcastType>();
let pendingTabsQuery: ReturnType<typeof browser.tabs.query> | undefined;
function broadcastFeatureState(types: readonly SettingsBroadcastType[]): void {
  if (disposed) return;
  for (const type of types) pendingBroadcasts.add(type);
  if (pendingTabsQuery) return;
  const query = Promise.resolve().then(() => browser.tabs.query({}));
  pendingTabsQuery = query;
  void query.then(tabs => {
    if (pendingTabsQuery !== query) return;
    pendingTabsQuery = undefined;
    const requested = [...pendingBroadcasts];
    pendingBroadcasts.clear();
    if (disposed) return;
    const current = config.value;
    const messages = requested.map(type => ({
      type,
      isEnabled: type === 'toggleTranslationProgressPanel' ? current.translationProgressPanelEnabled : current.on && !current.disableFloatingBall,
    }));
    for (const tab of tabs) {
      if (!isBrowserTabId(tab.id)) continue;
      for (const message of messages) {
        try {void browser.tabs.sendMessage(tab.id, message).catch(() => undefined);} catch { /* 无可用消息通道。 */ }
      }
    }
  }).catch(() => {
    if (pendingTabsQuery !== query) return;
    pendingTabsQuery = undefined;
    pendingBroadcasts.clear();
  });
}

const floatingBallEnabled = computed({
  get: () => !config.value.disableFloatingBall,
  set: (value) => {config.value.disableFloatingBall = !value; broadcastFeatureState(['toggleFloatingBall']);},
});
const handleTranslationProgressPanelChange = () => {broadcastFeatureState(['toggleTranslationProgressPanel']);};
const handlePluginStateChange = () => {broadcastFeatureState(['toggleFloatingBall']);};

const apiKeyRecoveryMinutes = computed(() => Math.round(normalizeApiKeyRecoveryMs(config.value.apiKeyRecoveryMs) / API_KEY_RECOVERY_MINUTE_MS));
const aiRequestTimeoutSeconds = computed(() => normalizeAiRequestTimeoutMs(config.value.aiRequestTimeoutMs) / 1000);
const requestSettingsContext = useSettingsActionContext(
  () => !disposed && viewActive.value && props.activeSection === 'settings-advanced' && (!props.activePanel || props.activePanel === 'requests'),
  () => [config.value, props.activePanel, config.value.aiRequestTimeoutMs, config.value.translationMaxRetries,
    config.value.apiKeyRecoveryMs, config.value.translationBackoffBaseMs, config.value.translationBackoffMaxMs],
);
const requestSettingsActions = computed(() => {
  const owns = requestSettingsContext.capture();
  return {
    timeout: (value: number | undefined) => {
      if (!owns() || value === undefined || !Number.isFinite(value)) return;
      config.value.aiRequestTimeoutMs = normalizeAiRequestTimeoutMs(value * 1000);
    },
    retries: (value: number | undefined) => {
      if (!owns() || value === undefined || !Number.isSafeInteger(value) || value < 0 || value > 10) return;
      config.value.translationMaxRetries = value;
    },
    keyRecovery: (value: number | undefined) => {
      if (!owns() || value === undefined || !Number.isFinite(value)) return;
      config.value.apiKeyRecoveryMs = normalizeApiKeyRecoveryMs(value * API_KEY_RECOVERY_MINUTE_MS);
    },
    backoffBase: (value: number | undefined) => {
      if (!owns() || value === undefined || !Number.isSafeInteger(value)) return;
      const nextBase = normalizeTranslationBackoffBaseMs(value);
      updateConfigAtomically(next => {
        next.translationBackoffBaseMs = nextBase;
        next.translationBackoffMaxMs = Math.max(next.translationBackoffMaxMs, nextBase);
      });
    },
    backoffMax: (value: number | undefined) => {
      if (!owns() || value === undefined || !Number.isSafeInteger(value)) return;
      config.value.translationBackoffMaxMs = Math.max(config.value.translationBackoffBaseMs, normalizeTranslationBackoffMaxMs(value));
    },
  };
});
</script>

<style scoped src="./settings-sections.css"></style>
