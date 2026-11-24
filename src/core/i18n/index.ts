/**
 * @file src/core/i18n/index.ts
 *
 * 文件职责：提供精简版固定简体中文的 UI 文案查找与参数插值函数。
 * 主要内容：直接读取内置简体中文目录 zhCNMessages，支持 `{param}` 插值；旧文案直通返回中文原文，不再携带六国翻译词典或正则模板。
 * 模块边界：纯函数模块，不读写 browser.storage、不发起网络请求、不依赖 Vue。
 */

import {zhCNMessages} from './messages/zh-CN';
import type {
    MessageCatalog,
    RegisteredUiLanguage,
    TranslationParams,
    UiLanguage,
    UiLanguageBundle,
} from './types';

export * from './types';
export * from './language';

const defaultMessages: MessageCatalog = zhCNMessages;

export function registerUiLanguageBundle(_language: RegisteredUiLanguage, _bundle: UiLanguageBundle): void {
    // 精简版固定简体中文，无需注册额外语言包。
}

export function hasUiLanguageBundle(_language: UiLanguage): boolean {
    return true;
}

function ownMessage(catalog: MessageCatalog | undefined, key: string): string | undefined {
    return catalog && Object.hasOwn(catalog, key) ? catalog[key] : undefined;
}

function formatMessage(template: string, params?: TranslationParams): string {
    if (!params) return template;
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) => {
        const value = Object.hasOwn(params, name) ? params[name] : undefined;
        return value === undefined || value === null ? placeholder : String(value);
    });
}

export function translate(key: string, _language: UiLanguage = 'zh-CN', params?: TranslationParams): string {
    const count = params && Object.hasOwn(params, 'count') ? params.count : undefined;
    const pluralTemplate = typeof count === 'number' && Number.isFinite(count)
        ? ownMessage(defaultMessages, `${key}.plural.other`)
        : undefined;
    const template = pluralTemplate ?? ownMessage(defaultMessages, key) ?? key;
    return formatMessage(template, params);
}

export function translateLegacyText(value: string, _language: UiLanguage = 'zh-CN'): string {
    return value;
}
