<!--
 * @file src/features/settings/ui/services/ServiceConfiguration.vue
 * 文件职责：渲染精简版 5 类保留翻译服务（微软、谷歌、DeepSeek、OpenRouter、自定义接口及多自定义 OpenAI 服务）的连接与高级配置面板。
 * 主要内容：提供免配置提示、自定义服务名称/接口编辑、多 API Key 管理与轮换、逐 Key / 整体连接测试与诊断恢复、模型 Thinking、提示词模板编辑与一键同步、原生合批开关与请求限流、DeepSeek API 格式、代理地址、自定义请求头与请求体。
 * 模块边界：本组件只编辑传入的 Config 草稿并通过后台消息发起连接测试，不实现具体 provider HTTP 协议或持久化事务。
 -->
<template>
  <section
    ref="configurationRoot"
    tabindex="-1"
    class="settings-section service-connection-section"
    :data-service-configuration-service="service"
    :data-custom-service-configuration="compute.showCustomOpenAI ? 'true' : 'false'"
    :data-ai-advanced-settings="compute.showAI ? 'true' : 'false'"
  >
    <Teleport v-if="connectionActionTarget" :to="connectionActionTarget">
      <section class="service-connection-action">
        <div class="connection-test-inline">
          <button
            type="button"
            class="connection-test-button"
            data-connection-test-button
            ref="connectionTestButton"
            :disabled="connectionTestDisabled"
            @click="connectionTestBusy ? stopApiKeyChecks() : testConnection()"
          >
            <svg v-if="connectionTestBusy" class="connection-action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
            <svg v-else class="connection-action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
            {{ connectionTestBusy ? '停止检查' : t('settings.services.keys.checkConnection') }}
          </button>
        </div>
      </section>
    </Teleport>

    <section class="connection-card" data-configuration-group="connection">
      <p v-if="service === services.microsoft || service === services.google" class="configuration-scope" data-service-no-setup>{{ t('settings.organization.noSetup') }}</p>

      <template v-if="compute.showCustomOpenAI && customProvider">
        <div class="connection-field" data-testid="custom-service-name-row">
          <div class="connection-field-label"><strong>服务名称</strong><FieldHelp content="仅用于识别此接口" /></div>
          <div class="connection-field-control">
            <el-input
              :model-value="customProvider?.name ?? ''"
              aria-label="自定义服务名称"
              data-testid="custom-service-edit-name"
              placeholder="请输入服务名称"
              :maxlength="MAX_CUSTOM_OPENAI_PROVIDER_NAME_LENGTH"
              :onUpdate:modelValue="fieldActions.customName"
            />
          </div>
        </div>
        <div class="connection-field" data-testid="custom-service-endpoint-row">
          <div class="connection-field-label"><strong>接口地址</strong><FieldHelp :content="t('settings.services.customEndpointHelp')" /></div>
          <div class="connection-field-control">
            <el-input
              :model-value="customProvider?.endpoint ?? ''"
              aria-label="自定义服务接口地址"
              data-testid="custom-service-edit-endpoint"
              placeholder="http://localhost:11434/v1/chat/completions"
              :maxlength="MAX_CUSTOM_OPENAI_PROVIDER_ENDPOINT_LENGTH"
              :onUpdate:modelValue="fieldActions.customEndpoint"
            />
          </div>
        </div>
      </template>

      <ApiKeyList
        v-if="compute.showToken"
        :active="active"
        :context="config"
        :context-key="service"
        :label="compute.showAI && !compute.requireApiKey ? 'API Key（可选）' : 'API Key'"
        :placeholder="compute.showAI && !compute.requireApiKey ? t('settings.services.keys.optionalPlaceholder') : undefined"
        :keys="apiKeys"
        :states="apiKeyChecks"
        :summary="apiKeySummary"
        :busy="connectionTestBusy"
        :standby-indexes="standbyApiKeys"
        :connection-state="standaloneApiKeyCheck"
        :check-mode="apiKeyCheckMode"
        @add="addApiKey"
        @update="updateApiKey"
        @remove="removeApiKey"
        @test="testSingleApiKey"
      >
        <template #help><FieldHelp v-if="compute.showAI" :content="t('settings.services.keys.listHelp')" /></template>
        <template v-if="usableApiKeyCount > 1" #tools>
          <div class="credential-usage" data-api-key-rotation-setting role="radiogroup" :aria-label="t('settings.services.keys.usage')">
            <span class="credential-usage-label" aria-hidden="true">{{ t('settings.services.keys.usage') }}</span>
            <div class="credential-modes">
              <label :class="{'is-selected': apiKeyRotationEnabled}"><input type="radio" :name="`api-key-mode-${service}`" value="rotation" :checked="apiKeyRotationEnabled" :onChange="fieldActions.rotateApiKeys" /><span>{{ t('settings.services.keys.rotate') }}</span></label>
              <label :class="{'is-selected': !apiKeyRotationEnabled}"><input type="radio" :name="`api-key-mode-${service}`" value="single" :checked="!apiKeyRotationEnabled" :onChange="fieldActions.useFirstApiKey" /><span>{{ t('settings.services.keys.firstOnly') }}</span></label>
            </div>
            <FieldHelp :content="t('settings.services.keys.usageHelp')" />
          </div>
        </template>
      </ApiKeyList>

      <div
        v-if="connectionTestMessage && !connectionTestDiagnostic && !compute.showToken"
        class="connection-test-result"
        :class="`is-${connectionTestState}`"
        data-connection-test-status
        role="status"
        aria-live="polite"
      >
        <strong>{{ connectionTestTitle }}</strong>
        <span>{{ connectionTestMessage }}</span>
      </div>
    </section>

    <div v-if="connectionTestState === 'error' && connectionTestDiagnostic" class="connection-test-result is-error connection-repair" data-connection-repair :data-diagnostic-code="connectionTestDiagnostic.code" role="status" aria-live="polite">
      <strong>{{ connectionRepairText.title }}</strong>
      <span>{{ connectionRepairText.detail }}</span>
      <div class="connection-repair-actions">
        <button type="button" class="connection-repair-button" data-connection-retry :disabled="connectionTestDisabled || connectionRetryWaiting" @click="testConnection()">{{ t('diagnostics.action.retry') }}</button>
        <button v-if="connectionTestDiagnostic.actions.includes('services')" type="button" class="connection-repair-button" data-connection-repair-config :disabled="!active" @click="focusConnectionConfiguration">{{ t('diagnostics.action.services') }}</button>
      </div>
    </div>

    <ServiceRepairReturn :active="active" :context="config" :context-key="service" @repair-ready="focusInitialRepair" />

    <el-tabs v-if="settingsTabs.requests" :model-value="activeSettingsTab" :onUpdate:modelValue="fieldActions.tab" class="service-settings-tabs" :class="{ 'is-single-tab': singleSettingsTab }" data-service-settings-tabs>
      <el-tab-pane v-if="settingsTabs.translation" name="translation" :label="t(SETTINGS_TAB_LABELS.translation)">
        <section id="service-translation-settings" class="service-settings-panel" data-configuration-group="translation">
          <div v-if="compute.showModel" class="connection-field" data-testid="model-thinking-control">
            <div class="connection-field-label">
              <strong>{{ t('settings.services.reasoning') }}</strong>
              <FieldHelp :content="t('settings.organization.thinkingHelp')" />
            </div>
            <div class="connection-field-control model-thinking-setting">
              <el-switch
                :model-value="selectedModelThinking"
                :disabled="!effectiveModelLabel"
                aria-label="当前模型是否启用 Thinking"
                :onUpdate:modelValue="fieldActions.modelThinking"
              />
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane v-if="settingsTabs.prompts" name="prompts" :label="t(SETTINGS_TAB_LABELS.prompts)">
        <section id="service-prompts-settings" class="service-settings-panel" data-configuration-group="prompts">
          <div class="custom-template-heading">
            <p class="configuration-scope">{{ t('settings.organization.promptsHelp') }}</p>
            <div class="custom-template-actions">
              <button type="button" class="prompt-sync-button" data-testid="prompt-sync-all" :disabled="!active || activeSettingsTab !== 'prompts' || serviceActionOpen || promptSyncTargets.length === 0" :onClick="syncPromptTemplates">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h13a5 5 0 0 1 5 5M17 20l4-4-4-4M21 16H8a5 5 0 0 1-5-5" /></svg>
                {{ t('settings.services.prompts.syncAll') }}
              </button>
              <el-button type="primary" link size="small" @click="resetCustomTemplate">恢复默认模板</el-button>
            </div>
          </div>

          <div class="prompt-template-list" data-testid="prompt-template-list">
            <PromptTemplateEditor :model-value="config.system_role[service]" :onUpdate:modelValue="fieldActions.system_role" role="system" :active="active && activeSettingsTab === 'prompts'" :context="config" :context-key="service" />
            <PromptTemplateEditor :model-value="config.user_role[service]" :onUpdate:modelValue="fieldActions.user_role" role="user" :active="active && activeSettingsTab === 'prompts'" :context="config" :context-key="service" />
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane v-if="settingsTabs.requests" name="requests" :label="t(SETTINGS_TAB_LABELS.requests)">
        <component :is="singleSettingsTab ? SettingsDisclosure : 'section'" :key="singleSettingsTab ? service : undefined" v-bind="singleSettingsTab ? singleRequestDisclosure : {}" id="service-requests-settings" class="service-settings-panel" :class="{'single-request-settings': singleSettingsTab}" data-configuration-group="requests">
          <div v-if="showNativeBatchTranslation" class="connection-field" :data-native-batch-service="service">
            <div class="connection-field-label">
              <strong>{{ t('settings.services.nativeBatch.label') }}</strong>
              <FieldHelp :content="t('settings.services.nativeBatch.help')" />
            </div>
            <div class="connection-field-control model-thinking-setting">
              <el-switch
                :model-value="nativeBatchTranslationEnabled"
                :disabled="!active || activeSettingsTab !== 'requests'"
                :aria-label="t('settings.services.nativeBatch.label')"
                data-native-batch-toggle
                :onUpdate:modelValue="setNativeBatchTranslationEnabled"
              />
            </div>
          </div>
          <RequestLimitSettings :active="active && activeSettingsTab === 'requests'" :config="config" :service="service" :model="compute.showModel ? requestLimitModel : undefined" />
        </component>
      </el-tab-pane>

      <el-tab-pane v-if="settingsTabs['custom-request']" name="custom-request" :label="t(SETTINGS_TAB_LABELS['custom-request'])">
        <section id="service-custom-request-settings" class="service-settings-panel" data-configuration-group="custom-request">
          <div v-if="compute.showDeepseekApiType" class="connection-field">
            <div class="connection-field-label"><strong>API 格式</strong><FieldHelp content="选择 DeepSeek 接口使用的 API 格式" /></div>
            <div class="connection-field-control">
              <el-select :model-value="config.deepseekApiType" :onUpdate:modelValue="fieldActions.deepseekApiType" aria-label="API 格式" placeholder="请选择 API 格式">
                <el-option class="select-left" v-for="item in options.deepseekApiType" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </div>
          </div>

          <div v-if="compute.showAI && compute.showProxy" class="connection-field">
            <div class="connection-field-label"><strong>代理地址</strong><FieldHelp content="可选的代理地址；填写后，当前 AI 服务请求会优先发送到这里" /></div>
            <div class="connection-field-control">
              <el-input :model-value="config.proxy[service]" :onUpdate:modelValue="fieldActions.proxy" aria-label="代理地址" placeholder="默认直连自定义接口" />
            </div>
          </div>

          <div v-if="compute.showAI && compute.showToken" class="connection-field" data-api-key-requirement-row>
            <div class="connection-field-label"><strong>{{ t('settings.services.keys.requirement') }}</strong><FieldHelp :content="t('settings.services.keys.requirementHelp')" /></div>
            <div class="connection-field-control">
              <SegmentedControl
                compact
                class="credential-requirement"
                data-api-key-auth-policy
                :label="t('settings.services.keys.requirement')"
                :options="apiKeyRequirementOptions"
                :model-value="compute.requireApiKey ? 'required' : 'optional'"
                :onUpdate:modelValue="fieldActions.apiKeyRequirement"
              />
            </div>
          </div>

          <div v-if="customProvider" class="connection-field custom-headers-field" data-testid="custom-service-headers">
            <div class="connection-field-label"><strong>自定义请求头</strong><FieldHelp content="填写值为字符串的 JSON 对象，仅用于当前自定义服务，同名请求头会覆盖默认值；留空则不启用" /></div>
            <div class="connection-field-control">
              <el-input :model-value="config.customHeaders[service]" :onUpdate:modelValue="fieldActions.customHeaders" type="textarea" :rows="3"
                aria-label="自定义请求头" :spellcheck="false" :class="{ 'input-error': !isValidCustomHeaders(config.customHeaders[service]) }"
                placeholder='{"x-opencode-session": "your-stable-session-id"}' />
              <div v-if="!isValidCustomHeaders(config.customHeaders[service])" class="error-text">请输入有效的请求头 JSON 对象，名称和值必须符合 HTTP 格式</div>
            </div>
          </div>

          <RequestHeaderSettings v-if="compute.showAI" :active="active && activeSettingsTab === 'custom-request'" :config="config" />

          <div v-if="compute.showCustomBody" class="connection-field">
            <div class="connection-field-label"><strong>自定义请求体</strong><FieldHelp content="填写要合并到翻译请求中的 JSON 参数对象" /></div>
            <div class="connection-field-control">
              <el-input :model-value="config.customBody[service]" :onUpdate:modelValue="fieldActions.customBody" type="textarea" :rows="3" aria-label="自定义请求体" :class="{ 'input-error': !isValidCustomBody(config.customBody[service]) }" placeholder='例如：{"thinking": {"type": "disabled"}}' />
              <div v-if="!isValidCustomBody(config.customBody[service])" class="error-text">请输入合法的 JSON 对象，否则该配置将被忽略</div>
            </div>
          </div>
        </section>
      </el-tab-pane>
    </el-tabs>

    <div v-if="compute.showCustomOpenAI" class="service-maintenance-actions">
      <button type="button" class="delete-service-button" data-testid="custom-service-delete" @click="confirmDeleteProvider">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></svg>
        删除服务
      </button>
    </div>
  </section>

  <el-dialog :key="serviceActionRevision" :model-value="serviceActionOpen" :onUpdate:modelValue="serviceActionButtons.open" :title="serviceActionTitle" width="min(460px, calc(100vw - 32px))" append-to-body destroy-on-close>
    <p>{{ serviceActionMessage }}</p>
    <template #footer>
      <el-button :onClick="serviceActionButtons.cancel">{{ t(pendingServiceAction?.kind === 'sync' ? 'settings.services.prompts.syncCancel' : 'common.cancel') }}</el-button>
      <el-button :type="pendingServiceAction?.kind === 'delete' ? 'danger' : 'primary'" :onClick="serviceActionButtons.confirm">{{ t(pendingServiceAction?.kind === 'sync' ? 'settings.services.prompts.syncConfirmAction' : 'common.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, ref, shallowRef, toRef, watch} from 'vue'
import type {Config} from '@/src/core/config/model'
import type {TranslationParams} from '@/src/core/i18n'
import {defaultOption, options as optionConfig, resolveConfiguredModel, services, servicesType} from '@/src/core/config/catalog'
import {
  MAX_CUSTOM_OPENAI_PROVIDER_ENDPOINT_LENGTH,
  MAX_CUSTOM_OPENAI_PROVIDER_NAME_LENGTH,
  type CustomOpenAIProvider,
} from '@/src/core/config/customOpenAI'
import {isValidCustomBody} from '@/src/core/config/customBody'
import {resolveTranslationRequestModel} from '@/src/core/config/requestModel'
import {getServiceRequestLimitPreference} from '@/src/core/config/requestLimits'
import {isValidCustomHeaders} from '@/src/core/config/customHeaders'
import {createApiKeyCheckRevision} from '@/src/core/config/apiKeyCheckIdentity'
import {isNativeBatchTranslationService, isNativeTranslationBatchEnabled} from '@/src/core/config/nativeBatch'
import browser from 'webextension-polyfill'
import {normalizeDiagnostic, diagnoseFailure, type Diagnostic} from '@/src/services/diagnostics'
import {requestConfigSave, waitForConfigPersistenceQueue} from '@/src/services/config/store'
import {CONNECTION_TEST_MESSAGE} from '@/src/core/config/constants'
import {ElMessage, ElTabs, ElTabPane} from 'element-plus'
import 'element-plus/es/components/tabs/style/css'
import FieldHelp from '../components/FieldHelp.vue'
import SegmentedControl from '../components/SegmentedControl.vue'
import SettingsDisclosure from '../components/SettingsDisclosure.vue'
import {useUiI18n} from '@/src/ui/i18n'
import PromptTemplateEditor from './PromptTemplateEditor.vue'
import ApiKeyList from './ApiKeyList.vue'
import {normalizeApiKeyList, eligibleApiKeyIndexes, activeApiKeyIndexes, standbyApiKeyIndexes, summarizeApiKeyChecks, type ApiKeyCheckState, type ApiKeySummary} from './apiKeyTypes'
import RequestLimitSettings from './RequestLimitSettings.vue'
import RequestHeaderSettings from './RequestHeaderSettings.vue'
import ServiceRepairReturn from './ServiceRepairReturn.vue'
import {createServiceRepairFocus} from './serviceRepairFocus'
import {listPromptTemplateSyncTargets, syncPromptTemplates as applyPromptTemplateSync} from './promptTemplateSync'
import {waitForSettingsTask} from '../../model/taskWait'
import {useSettingsActionContext} from '../../model/useSettingsActionContext'

const props = withDefaults(defineProps<{
  config: Config
  service: string
  selectedModelThinking: boolean
  compute: Record<string, any>
  options: typeof optionConfig
  customProvider?: CustomOpenAIProvider
  connectionActionTarget?: HTMLElement | null
  active?: boolean
}>(), {active: true})

const emit = defineEmits<{
  'update:model-thinking': [value: boolean]
  'update:custom-provider': [patch: Partial<Pick<CustomOpenAIProvider, 'name' | 'endpoint'>>]
  'delete:custom-provider': []
}>()

const config = toRef(props, 'config')
const service = toRef(props, 'service')
const compute = toRef(props, 'compute')
const options = toRef(props, 'options')
const customProvider = toRef(props, 'customProvider')
const {t} = useUiI18n()
const activeSettingsTab = ref('requests')
const serviceActionOpen = ref(false)
const sourcePromptProvider = computed(() => config.value.customOpenAIProviders.find(provider => provider.id === service.value))
const {active, capture: captureServiceActionContext, revision: serviceActionRevision} = useSettingsActionContext(() => props.active, () => [
  config.value, service.value, customProvider.value, activeSettingsTab.value, Boolean(compute.value.showAI), serviceActionOpen.value,
  sourcePromptProvider.value, config.value.system_role[service.value], config.value.user_role[service.value],
])
const showNativeBatchTranslation = computed(() => isNativeBatchTranslationService(service.value))
const nativeBatchTranslationEnabled = computed(() => isNativeTranslationBatchEnabled(service.value, config.value.nativeBatchTranslationEnabled))
const setNativeBatchTranslationEnabled = computed(() => {
  const owner = config.value
  const ownerService = service.value
  const current = captureServiceActionContext()
  return (enabled: boolean): void => {
    if (!current() || activeSettingsTab.value !== 'requests' || !isNativeBatchTranslationService(ownerService)) return
    owner.nativeBatchTranslationEnabled[ownerService] = enabled === true
  }
})
watch(() => [service.value, Boolean(compute.value.showAI), Boolean(compute.value.showModel)], () => {
  activeSettingsTab.value = compute.value.showAI && compute.value.showModel ? 'translation' : compute.value.showAI ? 'prompts' : 'requests'
}, {immediate: true})

const SETTINGS_TAB_LABELS = {
  translation: 'settings.organization.model',
  prompts: 'settings.organization.prompts',
  requests: 'settings.organization.requests',
  'custom-request': 'settings.organization.compatibility',
} as const
const settingsTabs = computed<Record<keyof typeof SETTINGS_TAB_LABELS, boolean>>(() => ({
  translation: Boolean(compute.value.showAI && compute.value.showModel),
  prompts: Boolean(compute.value.showAI),
  requests: true,
  'custom-request': Boolean(compute.value.showDeepseekApiType || compute.value.showAI || compute.value.showCustomBody || customProvider.value),
}))
const singleSettingsTab = computed(() => {
  const visible = (Object.keys(SETTINGS_TAB_LABELS) as Array<keyof typeof SETTINGS_TAB_LABELS>).filter(name => settingsTabs.value[name])
  return visible.length === 1 && visible[0] === 'requests' ? t(SETTINGS_TAB_LABELS.requests) : ''
})
const singleRequestDisclosure = computed(() => ({
  title: singleSettingsTab.value,
  defaultOpen: true,
  status: t(getServiceRequestLimitPreference(config.value.serviceRequestLimits, service.value)?.enabled
    ? 'settings.requestLimits.custom' : 'settings.requestLimits.followGlobal'),
  'data-service-request-disclosure': '',
}))

const fieldContext = useSettingsActionContext(() => active.value, () => [
  config.value, service.value, customProvider.value, activeSettingsTab.value,
  config.value.model[service.value], config.value.customModel[service.value], props.selectedModelThinking, compute.value.requireApiKey,
])
const fieldActions = computed(() => {
  const current = fieldContext.capture()
  const own = <Args extends unknown[]>(apply: (...args: Args) => void) => (...args: Args) => {if (current()) apply(...args)}
  const owner = config.value, ownerService = service.value
  const set = <Key extends keyof Config>(key: Key) => {
    const before = owner[key]
    return own((value: Config[Key]) => {if (owner[key] === before) owner[key] = value})
  }
  const setService = (key: 'proxy' | 'system_role' | 'user_role' | 'customHeaders' | 'customBody') => {
    const fields = owner[key], before = fields[ownerService]
    return own((value: string) => {if (owner[key] === fields && fields[ownerService] === before) fields[ownerService] = String(value)})
  }
  return {
    deepseekApiType: set('deepseekApiType'),
    proxy: setService('proxy'), system_role: setService('system_role'), user_role: setService('user_role'),
    customHeaders: setService('customHeaders'), customBody: setService('customBody'),
    customName: own((value: string) => updateCustomProvider('name', String(value))), customEndpoint: own((value: string) => updateCustomProvider('endpoint', String(value))),
    rotateApiKeys: own(() => setApiKeyRotationEnabled(true)), useFirstApiKey: own(() => setApiKeyRotationEnabled(false)), apiKeyRequirement: own(setApiKeyRequirement),
    modelThinking: own((value: unknown) => emit('update:model-thinking', Boolean(value))), tab: own((value: string | number) => {activeSettingsTab.value = String(value)}),
  }
})

const effectiveModelLabel = computed(() => resolveConfiguredModel(
  config.value.model[service.value],
  config.value.customModel[service.value],
))
const requestLimitModel = computed(() => resolveTranslationRequestModel(config.value, service.value))

const apiKeys = computed(() => {
  const configured = config.value.apiKeys?.[service.value]
  return normalizeApiKeyList(configured, config.value.token[service.value] || '')
})
const apiKeyRotationEnabled = computed<boolean>({
  get: () => {
    const explicit = config.value.apiKeyRotationEnabled?.[service.value]
    return explicit === true || (explicit === undefined && apiKeys.value.filter(Boolean).length > 1)
  },
  set: (value) => {
    if (!active.value) return
    config.value.apiKeyRotationEnabled = {
      ...(config.value.apiKeyRotationEnabled || {}),
      [service.value]: value,
    }
  },
})
function setApiKeyRotationEnabled(value: boolean): void {apiKeyRotationEnabled.value = value}
function setApiKeyRequirement(value: string | number): void {
  if (!active.value) return
  compute.value.requireApiKey = value === 'required'
}
const apiKeyRequirementOptions = computed(() => [
  {value: 'required', label: t('settings.services.keys.required')},
  {value: 'optional', label: t('settings.services.keys.optional')},
])
const usableApiKeys = computed(() => eligibleApiKeyIndexes(apiKeys.value))
const usableApiKeyCount = computed(() => usableApiKeys.value.length)
const apiKeyIndexes = computed(() => activeApiKeyIndexes(usableApiKeys.value, apiKeyRotationEnabled.value))
const standbyApiKeys = computed(() => standbyApiKeyIndexes(usableApiKeys.value, apiKeyRotationEnabled.value))

type LocalizedConnectionTestMessage = {readonly key: string; readonly params?: TranslationParams}
type LocalizedCheckState = Omit<ApiKeyCheckState, 'error'> & {error?: LocalizedConnectionTestMessage}
const apiKeyCheckStates = ref<Record<number, LocalizedCheckState>>({})
const apiKeyChecks = computed<Record<number, ApiKeyCheckState>>(() => Object.fromEntries(
  Object.entries(apiKeyCheckStates.value).map(([index, state]) => [index, localizeCheckState(state)]),
))
function localizeCheckState(state: LocalizedCheckState): ApiKeyCheckState {
  const {error, ...result} = state
  return {...result, ...(error ? {error: t(error.key, error.params)} : {})}
}
const apiKeySummary = ref<ApiKeySummary | null>(null)
const apiKeyCheckMode = ref<'single' | 'all'>('all')

function syncApiKeys(next: string[]): void {
  if (!active.value) return
  const storedValue = next.length > 0 ? next : ['']
  if (!config.value.apiKeys) config.value.apiKeys = {}
  config.value.apiKeys[service.value] = storedValue
  config.value.token[service.value] = storedValue.find(key => key.trim()) || ''
}
function addApiKey(): void {
  if (!active.value) return
  if (usableApiKeyCount.value < 2 && config.value.apiKeyRotationEnabled?.[service.value] === false) {
    const {[service.value]: _stale, ...rest} = config.value.apiKeyRotationEnabled
    config.value.apiKeyRotationEnabled = rest
  }
  syncApiKeys([...apiKeys.value, ''])
}
function updateApiKey(index: number, value: string): void {
  if (!active.value || !Number.isInteger(index) || index < 0 || index >= apiKeys.value.length) return
  const next = [...apiKeys.value]
  next[index] = value
  syncApiKeys(next)
}
function removeApiKey(index: number): void {
  if (!active.value || !Number.isInteger(index) || index < 0 || index >= apiKeys.value.length) return
  syncApiKeys(apiKeys.value.filter((_, itemIndex) => itemIndex !== index))
}
function resetApiKeyChecks(): void {apiKeyCheckStates.value = {};apiKeySummary.value = null}
function setApiKeyState(index: number, state: LocalizedCheckState): void {apiKeyCheckStates.value = {...apiKeyCheckStates.value, [index]: state}}
function updateApiKeySummary(): void {apiKeySummary.value = summarizeApiKeyChecks(apiKeyChecks.value)}
function updateCustomProvider(field: 'name' | 'endpoint', value: string): void {
  if (!active.value) return
  emit('update:custom-provider', {[field]: value})
}

type ConnectionTestState = 'idle' | 'testing' | 'success' | 'error'
const CONNECTION_CONFIG_WAIT_TIMEOUT_MS = 10_000
const CONNECTION_RESPONSE_WAIT_TIMEOUT_MS = 45_000
const connectionTestBusy = ref(false)
const configurationRoot = ref<HTMLElement>()
const connectionTestButton = ref<HTMLButtonElement>()
const focusRepairEntry = createServiceRepairFocus(() => nextTick())
function focusInitialRepair(requestedService: string): void {
  if (requestedService !== service.value) return
  void focusRepairEntry(captureServiceActionContext(), () => ({button: connectionTestButton.value,
    fallback: configurationRoot.value?.closest('.service-detail')?.querySelector<HTMLElement>('h4') || configurationRoot.value}))
}
const connectionTestDisabled = computed(() => !active.value || (!connectionTestBusy.value && (connectionRetryWaiting.value || compute.value.showToken && apiKeyIndexes.value.length === 0 && compute.value.requireApiKey)))
const connectionTestState = ref<ConnectionTestState>('idle')
const connectionTestMessageState = ref<LocalizedConnectionTestMessage | string | null>(null)
const connectionTestDiagnostic = shallowRef<Diagnostic | null>(null)
const connectionRepairText = computed(() => connectionTestDiagnostic.value ? {title: t(connectionTestDiagnostic.value.titleKey), detail: t(connectionTestDiagnostic.value.detailKey)} : {title: '', detail: ''})
const connectionRetryWaiting = ref(false)
const MAX_CONNECTION_RETRY_TIMER_MS = 2_147_483_647
let connectionRetryDeadline = 0
let connectionRetryTimer: ReturnType<typeof setTimeout> | undefined
function scheduleConnectionRetryWake(): void {
  clearTimeout(connectionRetryTimer)
  connectionRetryTimer = undefined
  const remaining = connectionRetryDeadline - Date.now()
  connectionRetryWaiting.value = remaining > 0
  if (remaining > 0) connectionRetryTimer = setTimeout(scheduleConnectionRetryWake, Math.min(MAX_CONNECTION_RETRY_TIMER_MS, remaining))
  else connectionRetryDeadline = 0
}
function clearConnectionDiagnostic(): void {
  connectionTestDiagnostic.value = null
  connectionRetryWaiting.value = false
  connectionRetryDeadline = 0
  clearTimeout(connectionRetryTimer)
  connectionRetryTimer = undefined
}
function describeConnectionFailure(error: unknown, applyCooldown = true): LocalizedConnectionTestMessage {
  const diagnostic = normalizeDiagnostic(error) || diagnoseFailure(error, {online: typeof navigator === 'undefined' ? undefined : navigator.onLine,
    ...(error instanceof ConnectionConfigurationError ? {reason: 'configuration-save' as const} : {})})
  if (!connectionTestDiagnostic.value) connectionTestDiagnostic.value = diagnostic
  if (applyCooldown && diagnostic.retryAfterMs) {
    connectionRetryDeadline = Math.max(connectionRetryDeadline, Date.now() + diagnostic.retryAfterMs)
    scheduleConnectionRetryWake()
  }
  return {key: diagnostic.titleKey}
}
function focusConnectionConfiguration(): void {
  if (!active.value || !connectionTestDiagnostic.value) return
  const root = configurationRoot.value
  const modelFailure = connectionTestDiagnostic.value.code === 'model-configuration'
  const modelTarget = modelFailure ? root?.closest('.service-detail')?.querySelector<HTMLElement>('[data-testid="model-picker-trigger"]') : undefined
  const target = modelTarget || root?.querySelector<HTMLElement>('.connection-card input:not([type="hidden"]), .connection-card select, .connection-card textarea')
    || root?.closest('.service-detail')?.querySelector<HTMLElement>('[data-testid="model-picker-trigger"]')
  target?.focus({preventScroll: true})
  target?.scrollIntoView({block: 'nearest', inline: 'nearest'})
}
class ConnectionConfigurationError extends Error {}
onBeforeUnmount(clearConnectionDiagnostic)

const connectionTestMessage = computed(() => {
  const message = connectionTestMessageState.value
  if (!message) return ''
  return typeof message === 'string' ? message : t(message.key, message.params)
})
const standaloneApiKeyCheck = computed<ApiKeyCheckState | undefined>(() => {
  if (connectionTestState.value === 'idle') return undefined
  if (connectionTestState.value === 'testing') return {status: 'checking'}
  if (connectionTestState.value === 'success') return {status: 'success'}
  return {status: 'error', error: connectionTestMessage.value}
})
let connectionTestGeneration = 0
let activeConnection: AbortController | undefined
function waitForConnectionStep<T>(operation: Promise<T>, timeoutMs: number, timeoutKey: string, signal: AbortSignal): Promise<T> {
  return waitForSettingsTask(operation, signal, timeoutMs, t(timeoutKey)).catch(error => {
    if (timeoutKey === 'settings.services.keys.configTimeout' && !signal.aborted) throw new ConnectionConfigurationError()
    throw error
  })
}
const connectionTestTitle = computed(() => connectionTestState.value === 'testing' ? '检查中' : connectionTestState.value === 'success' ? '连接正常' : '连接失败')
function resetConnectionTest(): void {
  clearConnectionDiagnostic()
  connectionTestState.value = 'idle'
  connectionTestMessageState.value = null
  resetApiKeyChecks()
}
function invalidateConnectionTest(): void {
  connectionTestGeneration += 1
  activeConnection?.abort()
  activeConnection = undefined
  connectionTestBusy.value = false
  resetConnectionTest()
}

async function runApiKeyCheck(index: number, generation: number, signal: AbortSignal): Promise<boolean> {
  if (!active.value || generation !== connectionTestGeneration || signal.aborted) return false
  const key = apiKeys.value[index]?.trim() || ''
  if (!key) return false
  setApiKeyState(index, {status: 'checking'})
  try {
    const response = await waitForConnectionStep(browser.runtime.sendMessage({
      type: CONNECTION_TEST_MESSAGE,
      service: service.value,
      keyIndex: index,
      keyRevision: createApiKeyCheckRevision(config.value, service.value),
    }), CONNECTION_RESPONSE_WAIT_TIMEOUT_MS, 'settings.services.keys.responseTimeout', signal) as {success?: boolean; durationMs?: number; error?: string; diagnostic?: unknown} | undefined
    if (generation !== connectionTestGeneration) return false
    if (!response?.success) throw normalizeDiagnostic(response?.diagnostic) || new Error(response?.error || '连接测试失败')
    setApiKeyState(index, {status: 'success', durationMs: response.durationMs})
    updateApiKeySummary()
    return true
  } catch (error) {
    if (generation !== connectionTestGeneration) return false
    setApiKeyState(index, {status: 'error', error: describeConnectionFailure(error)})
    updateApiKeySummary()
    return false
  }
}

function stopApiKeyChecks(): void {
  connectionTestGeneration += 1
  activeConnection?.abort()
  activeConnection = undefined
  connectionTestBusy.value = false
  connectionTestState.value = 'idle'
  connectionTestMessageState.value = null
  clearConnectionDiagnostic()
  apiKeyCheckStates.value = Object.fromEntries(Object.entries(apiKeyCheckStates.value).map(([index, state]) => [index,
    state.status === 'checking' || state.status === 'queued' ? {status: 'idle' as const} : state]))
  updateApiKeySummary()
}

async function testSingleApiKey(index: number): Promise<void> {
  if (!active.value || connectionTestBusy.value || connectionRetryWaiting.value || !usableApiKeys.value.includes(index)) return
  clearConnectionDiagnostic()
  apiKeyCheckMode.value = 'single'
  const generation = ++connectionTestGeneration
  const controller = new AbortController()
  activeConnection = controller
  connectionTestBusy.value = true
  connectionTestState.value = 'testing'
  connectionTestMessageState.value = {key: 'settings.services.keys.checking'}
  setApiKeyState(index, {status: 'checking'})
  updateApiKeySummary()
  try {
    await waitForConnectionStep(waitForConfigPersistenceQueue(), CONNECTION_CONFIG_WAIT_TIMEOUT_MS, 'settings.services.keys.configTimeout', controller.signal)
    if (generation !== connectionTestGeneration) return
    await waitForConnectionStep(requestConfigSave(config.value, browser.runtime.sendMessage.bind(browser.runtime)), CONNECTION_CONFIG_WAIT_TIMEOUT_MS, 'settings.services.keys.configTimeout', controller.signal)
    if (generation !== connectionTestGeneration) return
    const success = await runApiKeyCheck(index, generation, controller.signal)
    if (generation !== connectionTestGeneration) return
    connectionTestState.value = success ? 'success' : 'error'
    connectionTestMessageState.value = {key: success ? 'settings.services.keys.passed' : 'settings.services.keys.failed'}
  } catch (error) {
    if (generation === connectionTestGeneration) {
      connectionTestState.value = 'error'
      connectionTestMessageState.value = describeConnectionFailure(error)
      setApiKeyState(index, {status: 'error', error: connectionTestMessageState.value})
      updateApiKeySummary()
    }
  } finally {
    controller.abort()
    if (activeConnection === controller) activeConnection = undefined
    if (generation === connectionTestGeneration) connectionTestBusy.value = false
  }
}

async function testConnection(): Promise<void> {
  if (!active.value || connectionTestBusy.value || connectionTestDisabled.value || connectionRetryWaiting.value) return
  clearConnectionDiagnostic()
  apiKeyCheckMode.value = 'all'
  const testedService = service.value
  const generation = ++connectionTestGeneration
  const controller = new AbortController()
  activeConnection = controller
  const isCurrent = () => active.value && generation === connectionTestGeneration
  connectionTestBusy.value = true
  connectionTestState.value = 'testing'
  if (compute.value.showToken) resetApiKeyChecks()
  connectionTestMessageState.value = '正在保存当前配置并请求服务…'
  try {
    await waitForConnectionStep(waitForConfigPersistenceQueue(), CONNECTION_CONFIG_WAIT_TIMEOUT_MS, 'settings.services.keys.configTimeout', controller.signal)
    if (!isCurrent()) return
    await waitForConnectionStep(requestConfigSave(config.value, browser.runtime.sendMessage.bind(browser.runtime)), CONNECTION_CONFIG_WAIT_TIMEOUT_MS, 'settings.services.keys.configTimeout', controller.signal)
    if (!isCurrent()) return
    if (compute.value.showToken && apiKeyIndexes.value.length > 0) {
      const checks = [...apiKeyIndexes.value]
      apiKeyCheckStates.value = Object.fromEntries(checks.map(index => [index, {status: 'queued' as const}]))
      let successes = 0
      for (const index of checks) {
        if (!isCurrent()) return
        if (await runApiKeyCheck(index, generation, controller.signal)) successes += 1
        if (connectionRetryWaiting.value) {
          apiKeyCheckStates.value = Object.fromEntries(Object.entries(apiKeyCheckStates.value).map(([row, state]) => [row, state.status === 'queued' ? {status: 'idle' as const} : state]))
          break
        }
      }
      if (!isCurrent()) return
      connectionTestState.value = checks.length - successes === 0 ? 'success' : 'error'
      connectionTestMessageState.value = null
    } else {
      const response = await waitForConnectionStep(browser.runtime.sendMessage({
        type: CONNECTION_TEST_MESSAGE,
        service: testedService,
      }), CONNECTION_RESPONSE_WAIT_TIMEOUT_MS, 'settings.services.keys.responseTimeout', controller.signal) as {success?: boolean; durationMs?: number; error?: string; diagnostic?: unknown} | undefined
      if (!isCurrent()) return
      if (!response?.success) throw normalizeDiagnostic(response?.diagnostic) || new Error(response?.error || '连接测试失败')
      connectionTestState.value = 'success'
      connectionTestMessageState.value = `已完成真实翻译请求${typeof response.durationMs === 'number' ? `（${response.durationMs} ms）` : ''}。`
    }
  } catch (error) {
    if (!isCurrent()) return
    connectionTestState.value = 'error'
    connectionTestMessageState.value = describeConnectionFailure(error)
  } finally {
    controller.abort()
    if (isCurrent()) {
      if (activeConnection === controller) activeConnection = undefined
      connectionTestBusy.value = false
    }
  }
}

type ServiceAction = {kind: 'reset' | 'delete' | 'sync'; config: Config; service: string; provider: CustomOpenAIProvider | undefined; sourceProvider: CustomOpenAIProvider | undefined; system: string; user: string; name: string}
const pendingServiceAction = shallowRef<ServiceAction | null>(null)
const serviceActionTitle = computed(() => pendingServiceAction.value?.kind === 'sync'
  ? t('settings.services.prompts.syncConfirmTitle')
  : pendingServiceAction.value?.kind === 'delete' ? '删除自定义服务' : '恢复默认模板')
const serviceActionMessage = computed(() => pendingServiceAction.value?.kind === 'delete'
  ? `确定要删除“${pendingServiceAction.value.name}”吗？相关模型和连接配置也会一并清理。`
  : pendingServiceAction.value?.kind === 'sync'
    ? t('settings.services.prompts.syncConfirmMessage', {count: promptSyncTargets.value.length})
    : '确定要恢复当前 AI 服务的默认 system 和 user 模板吗？此操作会覆盖当前模板。')
const serviceActionButtons = computed(() => {
  const action = pendingServiceAction.value
  const cancel = () => {if (pendingServiceAction.value === action) closeServiceAction()}
  return {confirm: () => performServiceAction(action), cancel, open: (open: boolean) => {if (!open) cancel()}}
})
function closeServiceAction(): void {pendingServiceAction.value = null;serviceActionOpen.value = false}
function isCurrentServiceAction(action: ServiceAction): boolean {
  return active.value && action.config === config.value && action.service === service.value && action.provider === customProvider.value
    && (action.kind === 'delete' ? Boolean(compute.value.showCustomOpenAI && customProvider.value?.id === service.value && customProvider.value.name === action.name)
      : Boolean(compute.value.showAI && activeSettingsTab.value === 'prompts'
        && action.system === config.value.system_role[service.value] && action.user === config.value.user_role[service.value]
        && (action.kind !== 'sync' || (servicesType.AI.has(action.service)
          || Boolean(action.sourceProvider && action.sourceProvider === sourcePromptProvider.value)))))
}
function openServiceAction(kind: ServiceAction['kind']): void {
  if (serviceActionOpen.value || !active.value) return
  const action: ServiceAction = {kind, config: config.value, service: service.value, provider: customProvider.value,
    sourceProvider: sourcePromptProvider.value, system: config.value.system_role[service.value], user: config.value.user_role[service.value], name: customProvider.value?.name || '此自定义服务'}
  if (kind === 'sync' && promptSyncTargets.value.length === 0) return
  if (!isCurrentServiceAction(action)) return
  pendingServiceAction.value = action;serviceActionOpen.value = true
}
function performServiceAction(action: ServiceAction | null): void {
  if (!action || action !== pendingServiceAction.value || !serviceActionOpen.value || !isCurrentServiceAction(action)) return
  closeServiceAction()
  if (action.kind === 'reset') {
    action.config.system_role[action.service] = defaultOption.system_role
    action.config.user_role[action.service] = defaultOption.user_role
    ElMessage.success('已恢复当前 AI 服务默认模板')
  } else if (action.kind === 'sync') {
    const count = listPromptTemplateSyncTargets(action.config, action.service).length
    const next = applyPromptTemplateSync(action.config, action.service)
    action.config.system_role = next.system_role
    action.config.user_role = next.user_role
    ElMessage.success(t('settings.services.prompts.syncDone', {count}))
  } else emit('delete:custom-provider')
}
function resetCustomTemplate(): void {openServiceAction('reset')}
const promptSyncTargets = computed(() => listPromptTemplateSyncTargets(config.value, service.value))
const syncPromptTemplates = computed(() => {
  const current = captureServiceActionContext()
  return () => {if (current()) openServiceAction('sync')}
})
function confirmDeleteProvider(): void {openServiceAction('delete')}

watch(() => active.value ? [config.value, service.value, config.value.from, config.value.to, createApiKeyCheckRevision(config.value, service.value),
  config.value.apiKeyRotationEnabled?.[service.value], compute.value.requireApiKey] : null,
  invalidateConnectionTest, {flush: 'sync'})
watch(() => pendingServiceAction.value && !isCurrentServiceAction(pendingServiceAction.value), invalid => {if (invalid) closeServiceAction()}, {flush: 'sync'})
watch(serviceActionOpen, open => {if (!open) pendingServiceAction.value = null}, {flush: 'sync'})
</script>

<style scoped>
.service-connection-section { container-type: inline-size; display: grid; gap: 0; color: var(--ink, #172033); }
.connection-card { min-width: 0; padding: 0; border: 0; border-radius: 0; background: var(--surface, #fff); }
.connection-field { display: grid; grid-template-columns: var(--fr-service-label-width, 140px) minmax(0, 1fr); align-items: start; gap: var(--fr-service-column-gap, 16px); padding: var(--fr-settings-row-padding-block, 14px) 0; }
.connection-field + .connection-field { border-top: 1px solid var(--line, #e4e7ef); }
.connection-field-label { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; min-height: var(--fr-service-control-height, 40px); }
.connection-field-label strong { color: var(--ink); font-size: 13px; font-weight: 550; line-height: 1.5; }
.connection-field-control { display: flex; flex-direction: column; align-items: stretch; justify-self: start; width: 100%; max-width: var(--fr-service-control-width, 640px); min-width: 0; }
.connection-field-control :deep(.el-input), .connection-field-control :deep(.el-select), .connection-field-control :deep(.el-textarea) { width: 100% !important; max-width: 640px !important; }
.connection-field-control :deep(.el-select) { max-width: 360px !important; }
.service-connection-section :deep(.el-input__wrapper), .service-connection-section :deep(.el-select:not(.fluentread-select) .el-select__wrapper) { min-height: var(--fr-service-control-height, 40px); padding: 0 11px; border-radius: 8px; background: var(--surface, #fff); border-color: var(--line); }
.service-connection-section :deep(.el-input__inner), .service-connection-section :deep(.el-select__selected-item) { font-size: 13px; }
.service-connection-section :deep(.el-textarea__inner) { border-radius: 8px; background: var(--surface); font-size: 13px; padding: 10px 12px; }
.service-connection-section :deep(.el-switch) { --el-switch-on-color: var(--brand, #ef4776); }
.model-thinking-setting { justify-content: center; align-items: flex-start; min-height: 38px; }
.model-thinking-setting :deep(.el-switch) { flex: none; margin: -3px 0 -3px -4px; }
.service-settings-tabs { margin-top: 18px; min-width: 0; --el-color-primary: var(--brand-strong); }
.service-settings-tabs.is-single-tab { margin-top: 20px; }
.service-settings-tabs.is-single-tab :deep(.el-tabs__header) { display: none; }
.service-settings-tabs.is-single-tab .service-settings-panel { padding-top: 0; }
.single-request-settings { margin-bottom: 0; }
.single-request-settings :deep(.settings-disclosure-body) { padding: 0 var(--fr-card-padding-inline, 20px) 4px; }
.service-settings-tabs :deep(.el-tabs__header) { margin: 0; }
.service-settings-tabs :deep(.el-tabs__item) { height: 44px; padding: 0 18px; color: var(--muted); font-size: 13px; font-weight: 550; }
.service-settings-tabs :deep(.el-tabs__item.is-active) { color: var(--brand-strong); }
.service-settings-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background: var(--line); }
.service-settings-panel { min-width: 0; padding-top: 12px; }
.configuration-scope { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.credential-usage { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.credential-usage-label { color: var(--muted); font-size: 12px; white-space: nowrap; }
.credential-modes { display: flex; flex-wrap: wrap; padding: 3px; gap: 2px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.credential-modes label { position: relative; display: inline-flex; align-items: center; min-height: 24px; padding: 2px 10px; border-radius: 7px; color: var(--muted); font-size: 11px; font-weight: 600; white-space: nowrap; cursor: pointer; }
.credential-modes label:not(.is-selected):hover { color: var(--ink); }
.credential-modes label.is-selected { color: var(--brand-strong); background: var(--surface); box-shadow: 0 2px 7px rgba(31, 40, 61, .09); }
.credential-modes input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.credential-requirement { max-width: 360px; }
.custom-template-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; margin: 2px 0 12px; }
.custom-template-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; margin-left: auto; }
.prompt-sync-button { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--surface); font-size: 12px; font-weight: 550; cursor: pointer; }
.prompt-sync-button:hover:not(:disabled) { border-color: var(--brand-border, #f3c0ce); color: var(--brand-strong); background: var(--brand-soft); }
.prompt-sync-button:disabled { opacity: .5; cursor: not-allowed; }
.prompt-template-list { display: grid; gap: 14px; }
.service-connection-section :deep(.request-limit-settings) { width: 100%; }
.connection-card > :deep(.api-key-list:first-child) { border-top: 0; }
.connection-card > .configuration-scope { padding: 14px 0 6px; }
.connection-test-inline { display: flex; align-items: center; justify-content: flex-start; gap: 12px; flex-wrap: wrap; margin: 0; width: 100%; }
.connection-test-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-width: 0; max-width: 100%; min-height: 36px; padding: 7px 12px; border: 1px solid var(--brand-border, #f3c0ce); border-radius: 8px; color: var(--brand-strong, #bd2853); background: var(--brand-soft, #fff0f4); font-size: 12px; font-weight: 600; line-height: 1.5; cursor: pointer; }
.connection-test-button:hover:not(:disabled) { border-color: var(--brand); }
.connection-test-button:disabled { cursor: wait; opacity: .65; }
.connection-action-icon { flex: none; }
.service-connection-action { position: relative; display: flex; width: 100%; min-width: 0; }
.connection-test-result { display: grid; gap: 4px; margin-top: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; color: var(--ink); background: var(--surface-soft); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.connection-test-result.is-success { border-color: var(--el-color-success-light-5); color: var(--el-color-success); background: var(--el-color-success-light-9); }
.connection-test-result.is-error { border-color: var(--el-color-danger-light-5); color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.connection-repair-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.connection-repair-button { min-height: 32px; padding: 4px 10px; border: 1px solid currentColor; border-radius: 7px; color: inherit; background: transparent; font: inherit; cursor: pointer; }
.connection-repair-button:hover:not(:disabled) { background: var(--surface); }
.connection-repair-button:disabled { opacity: .6; cursor: default; }
.error-text { color: var(--el-color-danger); font-size: 12px; line-height: 1.6; margin-top: 7px; }
.service-maintenance-actions { display: flex; justify-content: flex-end; padding-top: 16px; margin-top: 16px; border-top: 1px solid var(--line); }
.delete-service-button { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 5px 8px; border: 0; border-radius: 6px; color: var(--el-color-danger); background: transparent; font-size: 12px; cursor: pointer; }
.delete-service-button:hover { background: var(--el-color-danger-light-9); }
button:focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; }
@container (max-width: 600px) {
  .connection-field { grid-template-columns: 1fr; gap: 8px; }
  .connection-field-label { min-height: 24px; }
  .connection-field-control { max-width: none; }
}
</style>
