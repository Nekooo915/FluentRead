/**
 * @file src/app/content/hotkeyRuntime.ts
 * 文件职责：在宿主页面统一接管全文翻译快捷键手势，并按配置和站点禁用状态触发全文翻译或恢复原文。
 * 主要内容：维护当前文档隔离的按键集合，解析全文翻译/悬浮球快捷键并在失焦或中止时清理键盘状态。
 * 模块边界：仅负责手势识别与分发，不实现翻译请求、UI 挂载或配置持久化。
 */
import {config} from '@/src/services/config/store';
import {
    addPressedHotkeyEventKey,
    deletePressedHotkeyEventKey,
    normalizeHotkeyEventKey,
    parseHotkey,
    resolveConfiguredHotkey,
} from '@/src/core/hotkey';
import {
    autoTranslateEnglishPage,
    isFullPageTranslationActive,
    restoreOriginalContent,
} from '@/src/features/full-page-translation/public';

export interface ContentHotkeyRuntime {
    installFloatingBallHotkey(signal: AbortSignal): () => void;
}

/** 为单个 document 创建隔离的键盘状态，避免页面失效后残留按键组合。 */
export function createContentHotkeyRuntime(
    isSiteDisabled: () => boolean,
    options: {toggleFullPage?: () => void} = {},
): ContentHotkeyRuntime {
    const toggleFullPageTranslation = options.toggleFullPage ?? (() => {
        if (isFullPageTranslationActive()) restoreOriginalContent();
        else autoTranslateEnglishPage();
    });

    const installFloatingBallHotkey = (signal: AbortSignal): (() => void) => {
        const hotkeysPressed = new Set<string>();
        const hotkeyByCode = new Map<string, string>();
        const resetKeyboardGesture = () => {
            hotkeysPressed.clear();
            hotkeyByCode.clear();
        };

        const configuredParts = (): string[] => {
            const parsed = parseHotkey(resolveConfiguredHotkey(config.floatingBallHotkey, config.customFloatingBallHotkey));
            if (!parsed.isValid) return [];
            return [...parsed.modifiers.map((key) => key === 'ctrl' ? 'control' : key), parsed.key];
        };

        document.addEventListener('keydown', (event) => {
            if (!event.isTrusted) return;
            if (!config.on || isSiteDisabled() || event.metaKey || normalizeHotkeyEventKey(event) === 'meta') {
                resetKeyboardGesture();
                return;
            }
            if (event.repeat) return;

            if (event.altKey) hotkeysPressed.add('alt');
            if (event.ctrlKey) hotkeysPressed.add('control');
            if (event.shiftKey) hotkeysPressed.add('shift');
            addPressedHotkeyEventKey(event, hotkeysPressed, hotkeyByCode);

            const parts = configuredParts();
            if (parts.length === 0
                || !parts.every((key) => hotkeysPressed.has(key))
                || parts.length !== hotkeysPressed.size) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            toggleFullPageTranslation();
        }, {signal, capture: true});

        document.addEventListener('keyup', (event) => {
            if (!event.isTrusted) return;
            deletePressedHotkeyEventKey(event, hotkeysPressed, hotkeyByCode);
            if (!event.altKey) hotkeysPressed.delete('alt');
            if (!event.ctrlKey) hotkeysPressed.delete('control');
            if (!event.shiftKey) hotkeysPressed.delete('shift');
        }, {signal, capture: true});

        window.addEventListener('blur', resetKeyboardGesture, {signal});
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) resetKeyboardGesture();
        }, {signal});
        signal.addEventListener('abort', resetKeyboardGesture, {once: true});

        return resetKeyboardGesture;
    };

    return {installFloatingBallHotkey};
}
