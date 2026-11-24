/**
 * @file src/core/i18n/language.ts
 *
 * 文件职责：定义精简版固定简体中文（zh-CN）界面语言领域规则与兼容导出契约。
 * 主要内容：已移除其余六国界面语言切换与异步语言包支持，所有语言归一化、浏览器语言解析和可用语言列表均统一收敛为 zh-CN。
 * 模块边界：本文件属于 core 领域层，只处理界面语言标识常量与无副作用纯函数，不读写浏览器存储、不发起请求也不访问 DOM。
 */

import type {RegisteredUiLanguage, UiLanguage} from './types';

export type {UiLanguage} from './types';

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'zh-CN';
export const UI_LANGUAGE_BUNDLE_DIRECTORY = 'i18n';

export function getUiLanguageBundlePath(language: RegisteredUiLanguage): string {
    return `${UI_LANGUAGE_BUNDLE_DIRECTORY}/${language}.json`;
}

export const UI_LANGUAGE_OPTIONS = [
    {value: 'zh-CN', labelKey: 'language.zhCN'},
] as const satisfies ReadonlyArray<{value: UiLanguage; labelKey: string}>;

export function normalizeUiLanguage(_value: unknown): UiLanguage {
    return DEFAULT_UI_LANGUAGE;
}

export function resolveUiLanguageFromLocale(_value: unknown): UiLanguage {
    return DEFAULT_UI_LANGUAGE;
}

export function getUiLanguageDisplayLabel(_language: UiLanguage, _interfaceLanguage: UiLanguage = DEFAULT_UI_LANGUAGE): string {
    return '简体中文';
}
