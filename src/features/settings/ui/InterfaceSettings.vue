<!--
 * @file src/features/settings/ui/InterfaceSettings.vue
 * 文件职责：组织精简版“界面风格”页的译文样式、逐句高亮外观、界面与弹窗皮肤、翻译加载样式与界面字体。
 * 主要内容：移除菜单栏布局自定义面板，保留译文样式（4 种）、逐句高亮（5 种）、界面皮肤（11 套）、加载样式（12 种+无）与 10 套可下载界面字体管理。
 * 模块边界：本组件只负责界面配置的展示与双向绑定，不直接读写浏览器存储、不负责主题模式，也不关闭翻译功能本身。
 -->
<template>
  <SettingsPanel name="translation" :active="props.activePanel">
    <TranslationStyleSettings :config="props.config" />
    <SentenceHighlightStyleSettings :config="props.config" />
  </SettingsPanel>

  <SettingsPanel name="skin" :active="props.activePanel">
    <SettingsGroup title="界面与弹窗">
      <SettingsItem
        class="interface-appearance-settings"
        label="弹窗风格"
        description="风格只改变扩展界面的呈现，不影响网页翻译效果"
      >
        <template #copy>
          <InterfaceSkinPreview
            :skin="selectedSkinOption"
            :preview-label="`弹窗风格: ${selectedSkinOption.label}`"
          />
        </template>
        <div class="interface-skin-picker" role="radiogroup" aria-label="弹窗风格" @keydown="handleSkinKeydown">
          <div class="interface-skin-current">
            <strong>{{ selectedSkinOption.label }}</strong>
            <p>{{ selectedSkinOption.description.replace('FluentRead', t('common.brand')) }}</p>
          </div>
          <div
            v-for="group in groupedSkinOptions"
            :key="group.value"
            class="interface-skin-group"
            role="group"
            :aria-labelledby="`interface-skin-group-${group.value}`"
          >
            <div class="interface-skin-group-heading">
              <strong :id="`interface-skin-group-${group.value}`">{{ group.label }}</strong>
            </div>
            <div class="interface-skin-grid">
              <button
                v-for="skin in group.options"
                :key="skin.value"
                class="interface-skin-option"
                :class="{ selected: props.config.interfaceSkin === skin.value }"
                type="button"
                role="radio"
                :aria-checked="props.config.interfaceSkin === skin.value"
                :tabindex="props.config.interfaceSkin === skin.value ? 0 : -1"
                :aria-label="`${skin.label}: ${skin.description.replace('FluentRead', t('common.brand'))}`"
                :title="skin.description.replace('FluentRead', t('common.brand'))"
                :data-skin="skin.value"
                @click="selectInterfaceSkin(skin.value)"
              >
                <span
                  class="interface-skin-preview"
                  :style="{
                    '--skin-preview-canvas': skin.preview.canvas,
                    '--skin-preview-surface': skin.preview.surface,
                    '--skin-preview-accent': skin.preview.accent,
                    '--skin-preview-ink': skin.preview.ink,
                    '--skin-preview-title': skin.preview.title,
                    '--skin-preview-action': skin.preview.action,
                    '--skin-preview-backdrop': skin.preview.backdrop,
                    '--skin-preview-border': skin.preview.border,
                    '--skin-preview-radius': `${skin.preview.radius}px`,
                  }"
                  aria-hidden="true"
                >
                  <i class="interface-skin-preview-title" />
                  <span class="interface-skin-preview-card"><i /><i /></span>
                </span>
                <span class="interface-skin-copy">
                  <strong>{{ skin.label }}</strong>
                </span>
                <span class="interface-skin-radio" aria-hidden="true"><i /></span>
              </button>
            </div>
          </div>
        </div>
      </SettingsItem>
    </SettingsGroup>
  </SettingsPanel>

  <SettingsPanel name="motion" :active="props.activePanel">
    <TranslationLoadingStyleSettings :config="props.config" />
  </SettingsPanel>

  <SettingsPanel name="font" :active="props.activePanel">
    <SettingsGroup
      class="interface-font-group"
      :title="t('settings.interface.font.label')"
      :description="t('settings.interface.font.description')"
    >
      <div class="interface-font-settings">
        <div class="interface-font-picker" role="radiogroup" :aria-label="t('settings.interface.font.label')">
          <label
            v-for="font in interfaceFontOptions"
            :key="font.value"
            class="interface-font-option"
            :class="{ selected: props.config.interfaceFont === font.value }"
            :data-font="font.value"
          >
            <input
              :id="`interface-font-${font.value}`"
              :checked="props.config.interfaceFont === font.value"
              @change="selectInterfaceFont(font.value)"
              type="radio"
              name="interface-font"
              :value="font.value"
              :aria-label="t(font.labelKey)"
            />
            <span class="interface-font-copy" :style="{ fontFamily: font.fontFamily.replace(/FluentRead /g, 'FluentRead Preview ') }">
              <strong>{{ t(font.labelKey) }}</strong>
              <small>{{ t(font.descriptionKey) }}</small>
              <span class="interface-font-sample" aria-hidden="true">Aa Bb Cc · 0123456789</span>
            </span>
            <div class="interface-font-action-area">
              <div v-if="font.value === interfaceFontLoadState.font && interfaceFontLoadState.status === 'loading'" class="interface-font-card-status" role="status" aria-live="polite" :data-status="interfaceFontLoadState.status">
                <span>{{ fontStatusText }}</span>
                <progress :value="interfaceFontLoadState.loaded" :max="interfaceFontLoadState.total" :aria-label="t('settings.interface.font.downloading')" />
              </div>
              <div v-else-if="font.value === interfaceFontLoadState.font && interfaceFontLoadState.status === 'error'" class="interface-font-card-status is-error" role="status" aria-live="polite" :data-status="interfaceFontLoadState.status">
                <span>{{ fontStatusText }}</span>
                <button type="button" @click.stop.prevent="selectInterfaceFont(font.value)">{{ t('settings.interface.font.retry') }}</button>
              </div>
              <template v-else>
                <span v-if="font.value === props.config.interfaceFont" class="interface-font-action is-active">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
                  {{ t('settings.interface.font.active') }}
                </span>
                <button v-else type="button" class="interface-font-action" :class="{'is-download': !availableInterfaceFonts.includes(font.value)}" @click.stop.prevent="selectInterfaceFont(font.value)">
                  <svg v-if="!availableInterfaceFonts.includes(font.value)" class="interface-font-cloud" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M7 17H6a4 4 0 0 1-.6-7.95 6.5 6.5 0 0 1 12.5-1.9A5 5 0 0 1 19 17h-2M12 11v10m-3-3 3 3 3-3" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
                  {{ t(availableInterfaceFonts.includes(font.value) ? 'settings.interface.font.useFont' : 'settings.interface.font.downloadAndUse') }}
                </button>
              </template>
              <button
                v-if="canClearFont(font.value)"
                type="button"
                class="interface-font-clear"
                :disabled="clearingFont !== null"
                :aria-label="`${t('settings.interface.font.clear', {size: clearFontSize(font.value)})} · ${t(font.labelKey)}`"
                :title="`${t('settings.interface.font.clear', {size: clearFontSize(font.value)})} · ${t(font.labelKey)}`"
                @click.stop.prevent="confirmClearFont(font.value)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg>
                {{ clearingFont === font.value ? t('settings.interface.font.clearingCache') : clearFontSize(font.value) }}
              </button>
            </div>
          </label>
          <div class="interface-font-preview" :style="{ fontFamily: selectedFontOption.fontFamily.replace(/FluentRead /g, 'FluentRead Preview ') }">
            <span>{{ t('settings.interface.font.preview') }}</span>
            <small aria-hidden="true">Aa Bb Cc · 0123456789</small>
          </div>
          <p class="interface-font-note">{{ t('settings.interface.font.note') }}</p>
        </div>
      </div>
    </SettingsGroup>
  </SettingsPanel>

  <el-dialog v-model="fontClearDialogOpen" :title="t('settings.interface.font.clearConfirmTitle')" width="min(460px, calc(100vw - 32px))" append-to-body destroy-on-close>
    <p>{{ t('settings.interface.font.clearConfirmMessage', {font: pendingFontLabel}) }}</p>
    <template #footer>
      <el-button @click="fontClearActions.cancel">{{ t('settings.interface.font.clearConfirmCancel') }}</el-button>
      <el-button type="primary" @click="fontClearActions.confirm">{{ t('settings.interface.font.clearConfirmButton') }}</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import './interface-font-previews.css'
import SettingsPanel from './components/SettingsPanel.vue'
import {computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch} from 'vue'
import {ElMessage} from 'element-plus'
import type {Config} from '@/src/core/config/model'
import {
  getInterfaceFontOption,
  getInterfaceSkinOption,
  interfaceFontOptions,
  interfaceSkinGroups,
  interfaceSkinOptions,
  type InterfaceFont,
} from '@/src/core/config/interfaceAppearance'
import {useUiI18n} from '@/src/ui/i18n'
import {getClearableInterfaceFontAssets} from '@/src/core/config/interfaceFontAssets'
import {availableInterfaceFonts, cachedInterfaceFonts, clearInterfaceFont, interfaceFontLoadState, refreshInterfaceFontAvailability, retryInterfaceFont} from '@/src/ui/interfaceAppearance'
import InterfaceSkinPreview from './components/InterfaceSkinPreview.vue'
import TranslationLoadingStyleSettings from './TranslationLoadingStyleSettings.vue'
import TranslationStyleSettings from './TranslationStyleSettings.vue'
import SentenceHighlightStyleSettings from './SentenceHighlightStyleSettings.vue'
import SettingsGroup from './components/SettingsGroup.vue'
import SettingsItem from './components/SettingsItem.vue'

const props = withDefaults(defineProps<{
  config: Config
  activePanel?: string
  active?: boolean
}>(), {active: true})
const {t} = useUiI18n()
const viewActive = ref(true)
const settingsActive = computed(() => viewActive.value && props.active)
const fontEditorActive = computed(() => settingsActive.value && (!props.activePanel || props.activePanel === 'font'))
const skinEditorActive = computed(() => settingsActive.value && (!props.activePanel || props.activePanel === 'skin'))
function selectInterfaceSkin(skin: string): void {
  if (!skinEditorActive.value) return
  const option = interfaceSkinOptions.find(item => item.value === skin)
  if (option) props.config.interfaceSkin = option.value
}
function handleSkinKeydown(event: KeyboardEvent): void {
  if (!skinEditorActive.value || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  const radios = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="radio"]'))
  if (!radios.length) return
  event.preventDefault()
  const focusedIndex = radios.indexOf(event.target as HTMLButtonElement)
  const selectedIndex = radios.findIndex(button => button.dataset.skin === props.config.interfaceSkin)
  const current = Math.max(0, focusedIndex >= 0 ? focusedIndex : selectedIndex)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? radios.length - 1
    : (current + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + radios.length) % radios.length
  selectInterfaceSkin(radios[next].dataset.skin || '')
  radios[next].focus()
}
const selectedSkinOption = computed(() => getInterfaceSkinOption(props.config.interfaceSkin))
const selectedFontOption = computed(() => getInterfaceFontOption(props.config.interfaceFont))
function selectInterfaceFont(font: InterfaceFont) {
  if (!fontEditorActive.value) return
  if (font === props.config.interfaceFont) {
    if (interfaceFontLoadState.value.status === 'error') retryInterfaceFont()
    return
  }
  props.config.interfaceFont = font
}
const clearingFont = ref<InterfaceFont | null>(null)
const fontClearDialogOpen = ref(false)
let clearVersion = 0
type FontClearOperation = {font: InterfaceFont; config: Config; selectedFont: InterfaceFont; version: number; label: string}
const pendingClear = ref<FontClearOperation | null>(null)
const pendingFontLabel = computed(() => pendingClear.value?.label || '')
const fontClearActions = computed(() => {
  const operation = pendingClear.value
  return {confirm: () => performClearFont(operation), cancel: () => {
    if (pendingClear.value === operation) closeFontClearDialog()
  }}
})
function closeFontClearDialog(): void {pendingClear.value = null;fontClearDialogOpen.value = false}
function isCurrentClear(operation: FontClearOperation): boolean {
  return fontEditorActive.value && operation.version === clearVersion && operation.config === props.config
    && operation.selectedFont === props.config.interfaceFont
}
watch(() => [fontEditorActive.value, props.config, props.config.interfaceFont], () => {
  clearVersion++;closeFontClearDialog()
}, {flush: 'sync'})
watch(fontClearDialogOpen, open => {if (!open) pendingClear.value = null}, {flush: 'sync'})
watch(fontEditorActive, active => {if (active) void refreshInterfaceFontAvailability()}, {immediate: true})
onActivated(() => {viewActive.value = true})
onDeactivated(() => {viewActive.value = false})
onBeforeUnmount(() => {viewActive.value = false})
function clearFontSize(font: InterfaceFont): string {
  const bytes = getClearableInterfaceFontAssets(font, cachedInterfaceFonts.value).reduce((sum, asset) => sum + asset.bytes, 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function canClearFont(font: InterfaceFont): boolean {
  return font !== 'system'
    && cachedInterfaceFonts.value.includes(font)
    && getClearableInterfaceFontAssets(font, cachedInterfaceFonts.value).length > 0
    && !(interfaceFontLoadState.value.font === font && interfaceFontLoadState.value.status === 'loading')
}
function confirmClearFont(font: InterfaceFont): void {
  if (!fontEditorActive.value || !canClearFont(font) || clearingFont.value || fontClearDialogOpen.value) return
  const option = interfaceFontOptions.find(item => item.value === font)
  const label = option ? t(option.labelKey) : font
  pendingClear.value = {font, config: props.config, selectedFont: props.config.interfaceFont, version: ++clearVersion, label}
  fontClearDialogOpen.value = true
}
async function performClearFont(operation: FontClearOperation | null = pendingClear.value): Promise<void> {
  if (!operation || operation !== pendingClear.value || !fontClearDialogOpen.value || clearingFont.value || !isCurrentClear(operation) || !canClearFont(operation.font)) return
  clearingFont.value = operation.font
  closeFontClearDialog()
  try {
    await clearInterfaceFont(operation.font)
    if (!isCurrentClear(operation)) return
    if (props.config.interfaceFont === operation.font) props.config.interfaceFont = 'system'
    ElMessage({message: t('settings.interface.font.clearSuccess', {font: operation.label}), type: 'success', duration: 1800})
  } catch {
    if (isCurrentClear(operation)) ElMessage({message: t('settings.interface.font.clearFailed', {font: operation.label}), type: 'error', duration: 2200})
  } finally {
    clearingFont.value = null
  }
}
const fontStatusText = computed(() => {
  const state = interfaceFontLoadState.value
  if (state.status === 'system') return t('settings.interface.font.noDownload')
  if (state.status === 'error') return t('settings.interface.font.failed')
  if (state.status === 'ready') return t(state.persistent ? 'settings.interface.font.saved' : 'settings.interface.font.sessionOnly')
  return `${t('settings.interface.font.downloading')} ${Math.floor(state.loaded / Math.max(1, state.total) * 100)}%`
})

const groupedSkinOptions = interfaceSkinGroups.map((group) => ({
  ...group,
  options: interfaceSkinOptions.filter((skin) => skin.group === group.value),
}))
</script>

<style scoped>
.interface-appearance-settings { grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 24px; }
.interface-appearance-settings:hover { background: transparent; }
.interface-appearance-settings :deep(.settings-item-copy) { position: sticky; top: 0; }
.interface-font-settings { padding: 12px 16px; }
.interface-font-picker { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; width: 100%; }
.interface-font-option { display: grid; min-width: 0; grid-template-columns: 16px minmax(0, 1fr); align-items: start; gap: 6px 8px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); background: var(--surface); text-align: left; cursor: pointer; transition: border-color 150ms ease, background 150ms ease; }
.interface-font-option:hover { border-color: var(--brand); }
.interface-font-option.selected { border-color: var(--brand); background: var(--brand-soft); }
.interface-font-option:has(input:focus-visible) { outline: 2px solid var(--brand); outline-offset: 2px; }
.interface-font-option input { width: 16px; height: 16px; margin: 2px 0 0; accent-color: var(--brand); cursor: pointer; }
.interface-font-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; cursor: pointer; }
.interface-font-action-area { grid-column: 2; display: flex; min-width: 0; align-items: center; align-self: end; flex-wrap: wrap; gap: 4px 8px; }
.interface-font-action { display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: fit-content; max-width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; font-size: 10px; line-height: 1.4; background: var(--surface); color: var(--brand); cursor: pointer; }
.interface-font-action.is-download { background: var(--brand-soft); border-color: transparent; }
.interface-font-option:hover .interface-font-action:not(.is-active) { border-color: var(--brand); }
.interface-font-action.is-active { cursor: default; color: var(--muted); background: transparent; border-color: transparent; }
.interface-font-action svg { width: 14px; height: 14px; flex-shrink: 0; }
.interface-font-clear { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 0; border: 0; border-radius: 6px; padding: 3px 4px; color: var(--muted); background: transparent; cursor: pointer; font-size: 10px; line-height: 1.4; }
.interface-font-clear:hover:not(:disabled) { border-color: #e69bad; color: var(--brand-strong); background: var(--brand-soft); }
.interface-font-clear:disabled { opacity: .55; cursor: wait; }
.interface-font-clear svg { width: 15px; height: 15px; flex: 0 0 15px; }
.interface-font-card-status { display: grid; flex: 1 1 100%; min-width: 0; gap: 5px; color: var(--brand-strong); font-size: 10.5px; line-height: 1.45; }
.interface-font-card-status > span { overflow-wrap: anywhere; }
.interface-font-card-status progress { width: 100%; height: 5px; accent-color: var(--brand); }
.interface-font-card-status.is-error { color: var(--brand-strong); }
.interface-font-card-status button { width: fit-content; border: 1px solid var(--line); border-radius: 7px; padding: 4px 8px; color: var(--brand-strong); background: var(--surface); cursor: pointer; font-size: 10.5px; }
.interface-font-card-status button:hover { border-color: var(--brand); background: var(--brand-soft); }
.interface-font-copy strong { overflow-wrap: anywhere; font-size: 12px; font-weight: 700; line-height: 1.35; }
.interface-font-copy small { color: var(--muted); font-size: 10.5px; font-weight: 400; line-height: 1.4; }
.interface-font-sample { margin-top: 2px; color: var(--ink); font-size: 12px; font-weight: 400; line-height: 1.5; overflow-wrap: anywhere; }
.interface-font-preview { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 20px; padding: 12px 14px; border-radius: 10px; color: var(--ink); background: var(--surface-soft); overflow-wrap: anywhere; font-size: 17px; font-weight: 400; line-height: 1.6; }
.interface-font-preview small { color: var(--muted); font-size: 13px; }
.interface-font-note { grid-column: 1 / -1; margin: 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
.interface-skin-picker { display: grid; width: 100%; gap: 12px; }
.interface-skin-current { display: grid; gap: 4px; padding: 0 2px 4px; }
.interface-skin-current strong { color: var(--ink); font-size: 13px; font-weight: 600; line-height: 1.45; }
.interface-skin-current p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
@media (max-width: 1050px) { .interface-font-picker { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 700px) { .interface-font-picker { grid-template-columns: repeat(2, minmax(0, 1fr)); } .interface-font-settings { padding: 12px; } }
@media (max-width: 460px) { .interface-font-picker { grid-template-columns: minmax(0, 1fr); } }
.interface-skin-group { display: grid; gap: 7px; }
.interface-skin-group-heading { display: flex; min-width: 0; align-items: baseline; justify-content: space-between; gap: 10px; padding: 0 2px; }
.interface-skin-group-heading strong { flex: none; color: var(--ink); font-size: 12px; }
.interface-skin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 152px), 1fr)); gap: 7px; }
.interface-skin-option { position: relative; display: grid; grid-template-columns: 40px minmax(0, 1fr) 14px; align-items: center; gap: 8px; min-width: 0; min-height: 64px; padding: 8px; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--surface); font: inherit; text-align: start; cursor: pointer; transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease; }
.interface-skin-option:hover { border-color: var(--brand); background: var(--surface-soft); }
.interface-skin-option:focus-visible { outline: 2px solid var(--brand-strong); outline-offset: 2px; }
.interface-skin-option.selected { border-color: var(--brand); background: var(--brand-soft); box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 10%, transparent); }
.interface-skin-preview { display: flex; width: 40px; height: 46px; flex-direction: column; gap: 4px; justify-content: center; padding: 5px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--skin-preview-ink) 16%, transparent); border-radius: 6px; background: var(--skin-preview-backdrop); }
.interface-skin-preview-title { display: block; width: 46%; height: 3px; border-radius: 2px; background: var(--skin-preview-title); }
.interface-skin-preview-card { display: flex; flex-direction: column; gap: 3px; padding: 4px 3px; border: 1px solid var(--skin-preview-border); border-radius: var(--skin-preview-radius); background: var(--skin-preview-surface); }
.interface-skin-preview-card > i { display: block; height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--skin-preview-ink) 16%, var(--skin-preview-surface)); }
.interface-skin-preview-card > i:last-child { height: 8px; border-radius: min(3px, var(--skin-preview-radius)); background: var(--skin-preview-action); }
.interface-skin-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.interface-skin-copy strong { font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
.interface-skin-radio { display: grid; place-items: center; width: 14px; height: 14px; border: 1px solid #b9c0cd; border-radius: 999px; background: var(--surface); }
.interface-skin-option.selected .interface-skin-radio { border-color: var(--brand); background: var(--brand); }
.interface-skin-radio > i { width: 4px; height: 4px; border-radius: 999px; background: #fff; opacity: 0; }
.interface-skin-option.selected .interface-skin-radio > i { opacity: 1; }
@media (max-width: 1100px) { .interface-appearance-settings { grid-template-columns: minmax(0, 1fr); } .interface-appearance-settings :deep(.settings-item-copy) { position: static; order: 2; } .interface-appearance-settings :deep(.settings-item-control) { justify-content: stretch; order: 1; } }
@media (max-width: 520px) { .interface-skin-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .interface-skin-option { gap: 6px; } .interface-skin-copy strong { font-size: 12px; } }
@media (prefers-reduced-motion: reduce) { .interface-skin-option { transition: none; } }
</style>
