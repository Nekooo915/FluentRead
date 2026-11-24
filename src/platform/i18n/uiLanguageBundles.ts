/**
 * @file src/platform/i18n/uiLanguageBundles.ts
 *
 * 文件职责：提供固定简体中文的语言资源就绪兼容接口，避免扩展运行时发起多余的语言包加载请求。
 * 主要内容：ensureUiLanguageBundle 立即解析为 true，renderWithUiLanguageBundle 同步渲染一次即可。
 * 模块边界：不发起 fetch、不操作存储或修改 DOM。
 */

import type {UiLanguageBundle} from '@/src/core/i18n';

export type EnsureUiLanguageBundle = (language: unknown) => Promise<boolean>;

export function isUiLanguageBundle(_value: unknown): _value is UiLanguageBundle {
    return false;
}

export function createUiLanguageBundleLoader(): EnsureUiLanguageBundle {
    return () => Promise.resolve(true);
}

export const ensureUiLanguageBundle: EnsureUiLanguageBundle = () => Promise.resolve(true);

export function renderWithUiLanguageBundle(
    _language: unknown,
    render: () => void,
    _ensure: EnsureUiLanguageBundle = ensureUiLanguageBundle,
): void {
    render();
}
