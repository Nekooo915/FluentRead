/**
 * @file src/core/config/featureServices.ts
 * 文件职责：定义留存功能与翻译服务的对应关系，供快捷面板统一展示与修改独立翻译服务。
 * 主要内容：精简版已移除视频字幕等独立服务覆盖，当前保留空的功能服务分配清单与安全辅助函数，避免调用方散落硬编码判断。
 * 模块边界：只操作调用方传入的配置草稿，不保存数据、不调用供应商，也不挂载任何 UI 组件。
 */
import type {Config} from './model';
import {resolveConfiguredModel} from './catalog';
import type {CustomOpenAIProvider} from './customOpenAI';

export interface FeatureServiceDefinition {
    readonly id: string;
    readonly field: 'service';
    readonly inherit: boolean;
    readonly aiOnly: boolean;
}

export const featureServiceDefinitions: readonly FeatureServiceDefinition[] = [];

export function isFeatureServiceSupported(_feature: FeatureServiceDefinition, _service: string, _customProviders: readonly CustomOpenAIProvider[] = []): boolean {
    return true;
}

export function getFeatureService(config: Config, feature: FeatureServiceDefinition): string {
    return config[feature.field];
}

export function setFeatureService(config: Config, feature: FeatureServiceDefinition, service: string): void {
    if (config[feature.field] === service) return;
    config[feature.field] = service;
}

export function getFeatureModel(config: Config, feature: FeatureServiceDefinition): string {
    const service = getFeatureService(config, feature) || config.service;
    return resolveConfiguredModel(config.model[service], config.customModel[service]);
}
