<!--
 * @file src/features/settings/ui/components/PopupPreview.vue
 * 文件职责：按精简版 Popup 的实际结构、尺寸和皮肤变量还原弹窗预览，供“界面与弹窗”风格选择器实时展示。
 * 主要内容：绘制品牌标题与设置入口、语言对与服务卡片、翻译主按钮、当前网站规则与模式/字体工具；已移除快捷功能栏、底部统计/清除缓存栏与高对比样式。
 * 模块边界：仅用于无交互的外观预览，不读取用户配置或连接浏览器状态。
 -->
<template>
  <div
    class="preview-popup"
    :data-preview-skin="skin.value"
    :data-preview-kind="skin.kind"
    :data-preview-popup-width="skin.popupWidth"
  >
    <header class="preview-header" aria-hidden="true">
      <span class="preview-brand">
        <img class="preview-logo" :src="iconUrl" alt="" width="32" height="32" />
        <span><strong>{{ t('common.brand') }}</strong><small>v{{ version }}</small></span>
      </span>
      <span class="preview-header-actions">
        <span class="preview-settings"><Setting /><span>设置</span></span>
      </span>
    </header>

    <div class="preview-flow">
      <section class="preview-hero" data-preview-popup-module="translation">
        <div class="preview-language-pair" aria-hidden="true">
          <span class="preview-language">
            <small>{{ t('popup.sourceLanguage') }}</small>
            <span class="preview-language-select"><strong>自动检测</strong><i /></span>
          </span>
          <b>→</b>
          <span class="preview-language">
            <small>{{ t('popup.targetLanguage') }}</small>
            <span class="preview-language-select"><strong>简体中文</strong><i /></span>
          </span>
        </div>

        <div class="preview-service" aria-hidden="true">
          <span class="preview-service-copy"><small>{{ t('popup.providers.title') }}</small><strong>微软翻译</strong></span>
          <span class="preview-provider-icons">
            <span class="preview-provider-avatar"><ServiceIcon service="microsoft" size="small" /></span>
            <b>›</b>
          </span>
        </div>

        <div class="preview-action-row" aria-hidden="true">
          <span class="preview-action"><strong>{{ t('popup.compact.translate') }}（⌥+T）</strong></span>
        </div>

        <div class="preview-meta">
          <div class="preview-site-rules nested" data-preview-popup-module="siteRule">
            <span class="preview-site-rule-button" aria-hidden="true"><span>始终翻译此网站</span><i /></span>
            <span class="preview-site-rule-button preview-site-disable" aria-hidden="true"><span>在此网站禁用扩展</span><i /></span>
          </div>
          <span v-if="skin.kind === 'default'" class="preview-tools" aria-hidden="true">
            <span>Aa</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path :d="appearanceIconPath" /></svg>
          </span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import {Setting} from '@element-plus/icons-vue'
import {version} from '@/package.json'
import ServiceIcon from '@/src/ui/components/ServiceIcon.vue'
import type {InterfaceSkinOption} from '@/src/core/config/interfaceAppearance'
import {popupQuickFeatureIconPaths} from '@/src/ui/popupQuickFeatureIcons'
import {useUiI18n} from '@/src/ui/i18n'

defineProps<{
  skin: InterfaceSkinOption
}>()
const {t} = useUiI18n()
const iconUrl = '/icon/128.png'
const appearanceIconPath = popupQuickFeatureIconPaths.appearance
</script>

<style scoped>
.preview-popup {
  --layout-preview-accent: var(--brand);
  --layout-preview-surface: var(--surface);
  position: relative;
  width: 100%;
  padding: 10px 16px 12px;
  overflow: hidden;
  border-radius: 14px;
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--line);
  font-size: 11px;
  line-height: 1.4;
  text-align: left;
}
.preview-popup *, .preview-popup *::before, .preview-popup *::after { box-sizing: border-box; }
.preview-popup strong { color: inherit; font-size: inherit; font-weight: 650; line-height: 1.35; }
.preview-popup small { color: var(--muted); font-size: 10px; line-height: 1.4; }
.preview-header, .preview-brand, .preview-header-actions, .preview-header-actions > span { display: flex; align-items: center; }
.preview-header { flex-wrap: wrap; gap: 8px; justify-content: space-between; margin-bottom: 10px; }
.preview-brand { min-width: 0; gap: 9px; }
.preview-logo { width: 32px; height: 32px; flex: none; }
.preview-brand > span { display: flex; min-width: 0; flex-direction: column; }
.preview-popup .preview-brand strong { font-size: 14px; font-weight: 760; line-height: 1.25; white-space: nowrap; }
.preview-popup .preview-brand small { margin-top: 2px; }
.preview-header-actions { flex: none; gap: 7px; margin-left: auto; }
.preview-header-actions > span { justify-content: center; gap: 5px; height: 34px; padding: 0 8px; border: 1px solid var(--line); border-radius: 11px; color: var(--ink); background: var(--surface); font-size: 11px; font-weight: 700; }
.preview-header-actions svg { width: 16px; height: 16px; flex: none; }
.preview-flow { display: flex; flex-direction: column; gap: 10px; }
.preview-hero { display: grid; min-width: 0; gap: 8px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.preview-language-pair { display: grid; grid-template-columns: minmax(0, 1fr) 16px minmax(0, 1fr); align-items: end; gap: 6px; }
.preview-language { display: grid; min-width: 0; gap: 5px; }
.preview-popup .preview-language > small { padding-left: 3px; font-weight: 650; }
.preview-language-select { display: flex; min-height: 35px; align-items: center; justify-content: space-between; gap: 6px; padding: 0 9px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-soft); }
.preview-popup .preview-language-select strong { min-width: 0; overflow-wrap: anywhere; }
.preview-language-select i { width: 7px; height: 7px; margin-top: -3px; flex: none; border-right: 1px solid var(--muted); border-bottom: 1px solid var(--muted); transform: rotate(45deg); }
.preview-language-pair > b { display: grid; height: 35px; place-items: center; color: var(--muted); font-weight: 400; }
.preview-service { display: flex; min-width: 0; min-height: 40px; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 9px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.preview-service-copy { display: flex; min-width: 0; flex: 1; align-items: baseline; gap: 5px; }
.preview-popup .preview-service-copy strong { font-size: 12px; font-weight: 600; }
.preview-provider-icons { display: flex; flex: none; align-items: center; padding-left: 6px; }
.preview-provider-avatar { display: grid; width: 29px; height: 29px; margin-left: -6px; place-items: center; border: 2px solid var(--surface); border-radius: 50%; background: var(--surface-soft); }
.preview-provider-avatar :deep(.service-icon) { width: 23px; height: 23px; border-radius: 50%; }
.preview-provider-icons > b { margin-left: 7px; color: var(--muted); font-size: 19px; font-weight: 400; line-height: 1; }
.preview-action-row { display: flex; align-items: stretch; gap: 7px; }
.preview-action { display: flex; min-width: 0; min-height: 40px; flex: 1 1 auto; align-items: center; justify-content: center; gap: 6px; padding: 8px; border-radius: 14px; color: #fff; background: linear-gradient(135deg, #f35482, #e93267); box-shadow: 0 6px 16px rgba(233, 50, 103, .16); }
.preview-popup .preview-action > strong { min-width: 0; font-size: 12px; font-weight: 750; text-align: center; overflow-wrap: anywhere; }
.preview-site-rules { display: flex; min-height: 34px; flex-wrap: wrap; align-items: center; gap: 5px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-soft); }
.preview-site-rule-button { display: inline-flex; min-width: 0; min-height: 24px; align-items: center; gap: 6px; padding: 0 8px; border: 1px solid color-mix(in srgb, var(--brand) 26%, var(--line)); border-radius: 8px; color: var(--brand-strong); background: var(--surface); font-size: 9px; font-weight: 750; }
.preview-site-rule-button.preview-site-disable { border-color: var(--line); color: var(--muted); }
.preview-site-rule-button > i { width: 6px; height: 6px; flex: none; border-radius: 50%; background: color-mix(in srgb, var(--muted) 55%, transparent); }

[data-preview-kind="default"] .preview-header { flex-wrap: nowrap; }
[data-preview-kind="default"] .preview-settings { width: 68px; padding-inline: 5px; }
[data-preview-kind="default"] .preview-service { height: 43px; }
[data-preview-kind="default"] .preview-service-copy { display: grid; grid-template-columns: min(52px, 42%) minmax(0, 1fr); }
.preview-popup[data-preview-kind="default"] .preview-service-copy > small { font-size: 11px; }
[data-preview-kind="default"] .preview-action { min-height: 42px; border-radius: 10px; }
[data-preview-kind="default"] .preview-meta { display: flex; gap: 6px; }
[data-preview-kind="default"] .preview-site-rules { display: grid; grid-template-columns: minmax(0, 10fr) minmax(0, 11fr); min-height: 24px; padding: 0; border: 0; background: transparent; }
[data-preview-kind="default"] .preview-site-rules.nested { flex: 1; min-width: 0; }
[data-preview-kind="default"] .preview-site-rule-button { justify-content: space-between; }
.preview-tools { display: flex; flex: none; gap: 6px; margin-inline-start: auto; color: var(--brand-strong); }
.preview-tools > * { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 6px; background: var(--surface-soft); }
.preview-tools > span { font: 600 14px Georgia, serif; }
.preview-tools > svg { padding: 3px; }

.preview-popup[data-preview-kind="minimal"] { padding: 12px 12px 10px; }
.preview-popup[data-preview-kind="minimal"] .preview-header { min-height: 42px; margin-bottom: 12px; }
.preview-popup[data-preview-kind="minimal"] .preview-brand { gap: 8px; }
.preview-popup[data-preview-kind="minimal"] .preview-logo { width: 38px; height: 38px; }
.preview-popup[data-preview-kind="minimal"] .preview-brand small { font-size: 9px; }
.preview-popup[data-preview-kind="minimal"] .preview-header-actions > span { color: var(--muted); background: transparent; font-size: 9px; }
.preview-popup[data-preview-kind="minimal"] .preview-hero { gap: 10px; padding: 0; border: 0; border-radius: 0; background: transparent; }
.preview-popup[data-preview-kind="minimal"] .preview-language-select { border-color: transparent; }
.preview-popup[data-preview-kind="minimal"] .preview-action { min-height: 46px; padding: 10px 12px; border: 1px solid transparent; color: var(--ink); background: var(--surface-soft); box-shadow: none; }
.preview-popup[data-preview-kind="minimal"] .preview-site-rules { border: 0; border-radius: 13px; }
.preview-popup[data-preview-kind="minimal"] .preview-site-rule-button { min-height: 22px; padding: 3px 6px; border-radius: 6px; }

.preview-popup[data-preview-kind="compact"] { padding: 8px 12px 10px; background: radial-gradient(circle at 92% 0, rgba(239, 71, 118, .12), transparent 30%), linear-gradient(180deg, var(--surface) 0, var(--surface-soft) 165px); }
.preview-popup[data-preview-kind="compact"] .preview-header { margin-bottom: 5px; }
.preview-popup[data-preview-kind="compact"] .preview-brand { gap: 7px; }
.preview-popup[data-preview-kind="compact"] .preview-brand strong { font-size: 13px; }
.preview-popup[data-preview-kind="compact"] .preview-header-actions > span { height: 29px; padding: 0 7px; border-radius: 8px; font-size: 9.5px; }
.preview-popup[data-preview-kind="compact"] .preview-hero { gap: 6px; padding: 9px; border-radius: 15px; box-shadow: 0 6px 15px rgba(27, 36, 57, .06); }
.preview-popup[data-preview-kind="compact"] .preview-language-select { min-height: 32px; border-radius: 8px; }
.preview-popup[data-preview-kind="compact"] .preview-service { min-height: 34px; padding: 3px 8px; border-radius: 9px; }
.preview-popup[data-preview-kind="compact"] .preview-action { min-height: 36px; border-radius: 9px; box-shadow: none; }
.preview-popup[data-preview-kind="compact"] .preview-site-rules { min-height: 28px; padding: 3px 5px 3px 7px; border-radius: 8px; }

.preview-popup[data-preview-kind="palette"] { border-radius: min(var(--skin-panel-radius, 14px), 18px); background: var(--skin-page, var(--surface)); }
.preview-popup[data-preview-kind="palette"] .preview-header-actions > span { border: var(--skin-chip-border, 1px solid var(--line)); border-radius: var(--skin-chip-radius, var(--skin-control-radius, 10px)); color: var(--skin-chip-color, var(--ink)); background: var(--skin-chip-background, var(--surface)); box-shadow: var(--skin-chip-shadow, none); }
.preview-popup[data-preview-kind="palette"] .preview-hero { border: var(--skin-panel-border, 1px solid var(--line)); border-radius: var(--skin-panel-radius, 14px); background: var(--skin-panel-background, var(--surface)); box-shadow: var(--skin-panel-shadow, none); }
.preview-popup[data-preview-kind="palette"] .preview-language > small { color: var(--skin-label-color, var(--muted)); }
.preview-popup[data-preview-kind="palette"] :is(.preview-language-select, .preview-service, .preview-site-rules) { border: var(--skin-control-border, 1px solid var(--line)); border-radius: var(--skin-control-radius, 10px); background: var(--skin-control-background, var(--surface-soft)); box-shadow: var(--skin-control-shadow, none); }
.preview-popup[data-preview-kind="palette"] .preview-provider-avatar { border-color: var(--skin-avatar-ring, var(--surface)); background: var(--skin-avatar-background, var(--surface-soft)); }
.preview-popup[data-preview-kind="palette"] .preview-site-rule-button { border-radius: var(--skin-tag-radius, min(8px, var(--skin-control-radius, 8px))); background: var(--skin-tag-background, var(--surface)); }
.preview-popup[data-preview-kind="palette"] .preview-action { border: var(--skin-action-border, 0); border-radius: var(--skin-action-radius, var(--skin-control-radius, 10px)); color: var(--skin-action-text, #fff); background: var(--skin-action-background, var(--brand)); box-shadow: var(--skin-action-shadow, none); }
</style>
