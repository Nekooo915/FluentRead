<!--
@file src/features/settings/ui/ContextMenuSettings.vue
文件职责：提供右键菜单的设置界面，保留全文翻译与当前网站开关两个核心入口的开关与实时预览。
主要内容：总开关与入口开关绑定活跃配置，左侧预览可用菜单项，右侧切换开启状态。
模块边界：只编辑父级响应式配置并展示预览，不创建原生菜单、不发送运行时消息。
-->
<template>
  <SettingsGroup class="context-menu-settings" :title="t('contextMenuSettings.title')" :description="t('contextMenuSettings.description')">
    <SettingsItem :label="t('contextMenuSettings.master')" :description="t('contextMenuSettings.masterDescription')">
      <el-switch :model-value="config.contextMenuEnabled" :onUpdate:modelValue="masterChange" :disabled="!active" class="settings-toggle" :aria-label="t('contextMenuSettings.master')" />
    </SettingsItem>

    <div class="context-menu-workspace">
      <section class="context-menu-preview" data-testid="context-menu-preview" :aria-label="t('contextMenuSettings.preview')">
        <div class="context-menu-preview-heading">
          <h3>{{ t('contextMenuSettings.preview') }}</h3>
          <p>{{ t('contextMenuSettings.previewDescription') }}</p>
        </div>
        <div class="context-menu-preview-menu" aria-live="polite">
          <ul v-if="previewEntries.length" class="context-menu-preview-list">
            <li v-for="item in previewEntries" :key="item.id" :data-context-menu-action="item.id" :class="{'is-site-action': item.id === 'toggleSite'}">
              <img :src="iconUrl" width="16" height="16" alt="" aria-hidden="true" />
              <span>{{ item.title }}</span>
            </li>
          </ul>
          <p v-else class="context-menu-preview-empty" role="status">{{ t('contextMenuSettings.sceneEmpty') }}</p>
        </div>
      </section>
      <div class="context-menu-entry-grid">
        <SettingsItem
          v-for="entry in entryRows"
          :key="entry.id"
          class="context-menu-entry"
          :data-context-menu-entry="entry.id"
          :label="entry.label"
          :description="entry.description"
          :disabled="!active || !config.contextMenuEnabled"
        >
          <el-switch
            :model-value="entry.enabled"
            class="settings-toggle"
            :aria-label="entry.label"
            :disabled="!active || !config.contextMenuEnabled"
            :onUpdate:modelValue="entry.update"
          />
        </SettingsItem>
      </div>
    </div>
  </SettingsGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {useSettingsActionContext} from '../model/useSettingsActionContext';
import SettingsGroup from './components/SettingsGroup.vue';
import SettingsItem from './components/SettingsItem.vue';
import {
  CONTEXT_MENU_ENTRIES,
  type ContextMenuActionId,
} from '@/src/core/context-menu/domain';
import type { Config } from '@/src/core/config/model';
import { useUiI18n } from '@/src/ui/i18n';

const props = withDefaults(defineProps<{config: Config; active?: boolean}>(), {active: true});
const {active, capture} = useSettingsActionContext(() => props.active, () => [props.config, props.config.contextMenuEnabled]);
const masterChange = computed(() => {const current = capture();return (value: unknown) => {if (current() && typeof value === 'boolean') props.config.contextMenuEnabled = value};});
const config = computed(() => props.config);
const { t } = useUiI18n();
const iconUrl = '/icon/16.png';

const SUPPORTED_IDS = new Set<ContextMenuActionId>(['translatePage', 'toggleSite']);
const ENTRY_COPY: Partial<Record<ContextMenuActionId, {label: string; description: string; preview: string}>> = {
  translatePage: {label: 'contextMenu.translatePage', description: 'contextMenuSettings.pageDescription', preview: 'contextMenu.translatePage'},
  toggleSite: {label: 'contextMenuSettings.siteToggle', description: 'contextMenuSettings.siteToggleDescription', preview: 'contextMenu.disableSite'},
};

function readEntryPreference(id: ContextMenuActionId, defaultEnabled: boolean): boolean {
  return config.value.contextMenuEntries?.[id] ?? defaultEnabled;
}

function writeEntryPreference(id: ContextMenuActionId, value: unknown): void {
  if (!active.value || !config.value.contextMenuEnabled || typeof value !== 'boolean' || !SUPPORTED_IDS.has(id)) return;
  config.value.contextMenuEntries = {...config.value.contextMenuEntries, [id]: value};
}

const entryRows = computed(() => CONTEXT_MENU_ENTRIES
  .filter((entry) => SUPPORTED_IDS.has(entry.id))
  .map((entry) => {
    const current = capture();
    const copy = ENTRY_COPY[entry.id]!;
    const enabled = readEntryPreference(entry.id, entry.defaultEnabled);
    return {
      id: entry.id,
      label: t(copy.label),
      title: t(copy.preview),
      enabled,
      description: t(copy.description),
      update: (value: unknown) => {if (current() && readEntryPreference(entry.id, entry.defaultEnabled) === enabled) writeEntryPreference(entry.id, value)},
    };
  }));

const previewEntries = computed(() => config.value.contextMenuEnabled === false ? [] : entryRows.value.filter((entry) => entry.enabled));
</script>

<style scoped>
.context-menu-workspace { display: grid; grid-template-columns: minmax(220px, 0.85fr) minmax(0, 1.35fr); gap: 16px; padding: 14px 20px 18px; }
.context-menu-preview { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
.context-menu-preview-heading h3 { margin: 0; font-size: 13px; color: var(--ink); }
.context-menu-preview-heading p { margin: 4px 0 0; font-size: 12px; color: var(--muted); }
.context-menu-preview-menu { padding: 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.context-menu-preview-list { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.context-menu-preview-list li { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 7px; font-size: 12.5px; color: var(--ink); }
.context-menu-preview-list li.is-site-action { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 10px; }
.context-menu-preview-empty { margin: 0; padding: 10px 8px; font-size: 12px; color: var(--muted); }
.context-menu-entry-grid { display: grid; gap: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface); }
@media (max-width: 780px) { .context-menu-workspace { grid-template-columns: 1fr; } }
</style>
