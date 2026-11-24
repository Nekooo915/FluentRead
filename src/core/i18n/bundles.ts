/**
 * @file src/core/i18n/bundles.ts
 *
 * 文件职责：为构建期生成精简版固定简体中文的浏览器扩展元数据语言文件（_locales/zh_CN/messages.json）。
 * 主要内容：不再输出其余六国界面语言 JSON 资源包与多语言 _locales 目录。
 * 模块边界：仅在构建期及元数据验证脚本调用，不访问浏览器 API 或读写用户配置。
 */

import {translate} from './index';
import productDescriptions from './messages/product-descriptions.json';
import toolbarDescriptions from './messages/toolbar-descriptions.json';
import type {RegisteredUiLanguage, UiLanguageBundle} from './types';

export const UI_LANGUAGE_BUNDLES: Readonly<Partial<Record<RegisteredUiLanguage, UiLanguageBundle>>> = {};

export function createUiLanguageBundleFiles(): Array<{relativeDest: string; contents: string}> {
    return [];
}

export function createExtensionMetadataLocaleFiles(): Array<{relativeDest: string; contents: string}> {
    const name = translate('common.brand', 'zh-CN');
    return [{
        relativeDest: '_locales/zh_CN/messages.json',
        contents: JSON.stringify({
            extensionName: {message: name},
            extensionDescription: {message: productDescriptions['zh-CN']},
            extensionToolbarTitle: {message: `${name} · ${toolbarDescriptions['zh-CN']}`},
        }),
    }];
}
