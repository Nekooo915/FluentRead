/**
 * @file src/core/config/featureServices.ts
 * 文件职责：定义留存功能与翻译服务的对应关系，供设置中心统一展示与修改独立翻译服务。
 * 主要内容：仅保留视频字幕的独立服务分配与模型解析。
 * 模块边界：只操作调用方传入的配置草稿，不保存数据、不调用供应商。
 */
import type {Config} from './model';
import {resolveConfiguredModel} from './catalog';
import type {CustomOpenAIProvider} from './customOpenAI';

export const featureServiceDefinitions = [
    {id: 'video', field: 'videoService', inherit: true, aiOnly: false},
] as const;
export type FeatureServiceDefinition = typeof featureServiceDefinitions[number];

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
