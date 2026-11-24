<!--
 * @file src/features/settings/ui/ConfigManagement.vue
 * 文件职责：承载“备份与恢复”设置页，仅保留本机 JSON 配置导出与导入功能。
 * 主要内容：渲染 LocalDataManagement 组件；已移除设置历史与自动设置快照记录、差异预览及回滚逻辑。
 * 模块边界：仅转交页面活跃状态与配置引用，不直接读写存储或解析备份文件。
 -->
<template>
  <section class="config-management">
    <SettingsPanel name="backup" :active="props.activePanel">
      <LocalDataManagement :config="config" :active="props.active && (!props.activePanel || props.activePanel === 'backup')" />
    </SettingsPanel>
  </section>
</template>

<script setup lang="ts">
import type {Config} from '@/src/core/config/model';
import SettingsPanel from './components/SettingsPanel.vue';
import LocalDataManagement from './LocalDataManagement.vue';

const props = defineProps<{
  active: boolean;
  config: Config;
  activePanel?: string;
}>();
</script>

<style scoped>
.config-management { width: 100%; }
</style>
