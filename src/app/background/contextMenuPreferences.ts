/**
 * @file src/app/background/contextMenuPreferences.ts
 * 文件职责：把共享配置读成右键菜单需要的一份快照，仅保留全文翻译与当前站点开关入口。
 * 主要内容：从共享配置读取总开关、页面/站点菜单偏好、工具栏面板和界面语言，并计算用于重建比较的签名。
 * 模块边界：本文件只读配置，不创建菜单、不发送消息、不渲染标题。
 */
import {
    resolveContextMenuEntryToggles,
    type ContextMenuDisplayOptions,
    type ContextMenuEntryToggles,
} from '@/src/core/context-menu/domain';
import {config} from '@/src/services/config/store';
import {type ContextMenuTitleContext} from '@/src/core/context-menu/presentation';
import {normalizeUiLanguage} from '@/src/core/i18n';

export interface ContextMenuSettingsSnapshot {
    readonly enabled: boolean;
    readonly toolbarQuickPanel: boolean;
    readonly toggles: ContextMenuEntryToggles;
    readonly display: ContextMenuDisplayOptions;
    readonly titleContext: ContextMenuTitleContext;
    readonly signature: string;
}

type ContextMenuConfigSource = typeof config;

/** 读取当前配置下右键菜单应有的样子；调用方只比较 signature，不需要逐字段比对。 */
export function readContextMenuSettings(source: ContextMenuConfigSource = config): ContextMenuSettingsSnapshot {
    const pluginOn = source.on !== false;
    const language = normalizeUiLanguage(source.uiLanguage);
    const toggles = resolveContextMenuEntryToggles(source.contextMenuEntries, {
        selectionTranslation: false,
        imageTranslation: false,
        areaTranslation: false,
    });
    const display: ContextMenuDisplayOptions = {
        showTargetLanguage: source.contextMenuShowTargetLanguage !== false,
        showShortcut: source.contextMenuShowShortcut !== false,
    };
    const titleContext: ContextMenuTitleContext = {
        language,
        targetLanguage: '',
        shortcut: '',
    };
    const enabled = pluginOn && source.contextMenuEnabled !== false;
    const toolbarQuickPanel = source.toolbarClickAction === 'translate';
    return {
        enabled,
        toolbarQuickPanel,
        toggles,
        display,
        titleContext,
        signature: JSON.stringify([enabled, toggles, language, toolbarQuickPanel]),
    };
}
