/**
 * @file src/features/video-subtitle/content/serviceProfile.ts
 * 文件职责：为视频字幕内容运行时提供翻译服务标签与预翻译窗口的纯判定。
 * 主要内容：识别内置服务与自定义 OpenAI 兼容服务，为 AI 服务选择较长预取窗口，并生成用户可读的服务标签。
 * 模块边界：本文件只读取传入的服务配置快照，不访问 DOM、播放器、网络或持久化。
 */
import {options, servicesType} from '@/src/core/config/catalog';
import {
  getCustomOpenAIProviderLabel,
  isConfiguredCustomOpenAIProvider,
  type CustomOpenAIProvider,
} from '@/src/core/config/customOpenAI';
import {config} from '@/src/services/config/store';

export const VIDEO_PRETRANSLATION_MACHINE_WINDOW_MS = 10_000;
export const VIDEO_PRETRANSLATION_AI_WINDOW_MS = 30_000;

export function getVideoPretranslationWindowMs(
  service: string,
  providers: readonly CustomOpenAIProvider[] = config.customOpenAIProviders,
): number {
  return servicesType.isAI(service) || isConfiguredCustomOpenAIProvider(providers, service)
    ? VIDEO_PRETRANSLATION_AI_WINDOW_MS
    : VIDEO_PRETRANSLATION_MACHINE_WINDOW_MS;
}

export function getVideoServiceLabel(
  service: string,
  providers: readonly CustomOpenAIProvider[] = config.customOpenAIProviders,
): string {
  const item = options.services.find((candidate: any) => candidate.value === service);
  return item?.label || getCustomOpenAIProviderLabel(providers, service);
}
