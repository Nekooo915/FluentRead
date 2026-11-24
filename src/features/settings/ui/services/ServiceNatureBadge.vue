<!--
 * @file src/features/settings/ui/services/ServiceNatureBadge.vue
 * 文件职责：为精简版服务目录保留接口性质徽章占位组件，维持目录项和标题布局一致。
 * 主要内容：保留 5 个核心服务均无需特殊性质标签，不渲染多余徽章。
 * 模块边界：无状态展示组件，不判断连接状态或修改配置。
 -->
<template>
  <span v-if="false" class="service-badge service-nature-badge" :data-service-nature-badge="service" />
</template>
<script setup lang="ts">
import './service-badges.css'
defineProps<{ service: string }>()
</script>
