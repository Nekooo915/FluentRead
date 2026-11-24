/**
 * @file src/features/video-subtitle/content/playerMenu.ts
 * 文件职责：组装播放器字幕菜单，提供显示方式、双语顺序、字幕时间偏移、来源状态与字幕导出入口。
 * 主要内容：保留常驻标题与可滚动正文分离、键盘方向键导航、折叠式下载区和桌面/触屏自适应布局，移除本地 AI 转录、读音注音和逐句学习入口。
 * 模块边界：只操作 FluentRead 自己的菜单节点，运行时负责配置、请求、全局事件与清理。
 */
import type {VideoSubtitleAppearance} from '@/src/core/config/videoSubtitleAppearance';
import type {VideoSubtitleDisplayMode} from '@/src/core/config/model';
import {
    createTextElement, markVideoUi, translateVideoUi, localizeVideoUiText,
    VIDEO_TRANSLATION_MENU_ID, type UiLanguage,
} from './ui';

/** 菜单里的“关闭”与三种显示方式同属一个选择。 */
export type VideoMenuMode = VideoSubtitleDisplayMode | 'off';
export const VIDEO_MENU_MODES: readonly VideoMenuMode[] = ['bilingual', 'translation-only', 'original-only', 'off'];
const VIDEO_MENU_MODE_KEYS: Record<VideoMenuMode, string> = {
    bilingual: 'video.modeBilingual',
    'translation-only': 'video.modeTranslation',
    'original-only': 'video.modeOriginal',
    off: 'video.modeOff',
};

const MENU_BOTTOM_OFFSET_PX = 40;
const MENU_TOP_GAP_PX = 8;
const WIDE_LAYOUT_MIN_PLAYER_WIDTH_PX = 300;
const VIEWPORT_MENU_WIDE_MIN_WIDTH_PX = 380;
const VIEWPORT_MENU_CLOSE_ONLY_HEIGHT_PX = 128;
const STACK_LAYOUT_MAX_HEIGHT_RATIO = 0.8;

type IconName = 'settings' | 'minus' | 'plus' | 'reset' | 'download' | 'close' | 'back' | 'next';
const ICON_PATHS: Record<IconName, string[]> = {
    settings: ['M4 7h9', 'M17 7h3', 'M4 17h3', 'M11 17h9', 'M15 5v4', 'M9 15v4'],
    minus: ['M6 12h12'],
    plus: ['M12 6v12', 'M6 12h12'],
    reset: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4.5V9h4.5'],
    download: ['M12 4v10.5', 'M7.5 10.5 12 15l4.5-4.5', 'M5 19.5h14'],
    close: ['M7 7l10 10', 'M17 7 7 17'],
    back: ['M14 6l-6 6 6 6'],
    next: ['M10 6l6 6-6 6'],
};

function createIcon(name: IconName): SVGSVGElement {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', `fluent-read-video-menu-icon fluent-read-video-menu-icon-${name}`);
    for (const d of ICON_PATHS[name]) {
        const path = document.createElementNS(namespace, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
    }
    return svg;
}

function keyedText<K extends keyof HTMLElementTagNameMap>(
    tagName: K, className: string, key: string, language: UiLanguage, params?: Record<string, string | number>,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    element.className = className;
    element.dataset.i18nKey = key;
    if (params) element.dataset.i18nParams = JSON.stringify(params);
    element.textContent = translateVideoUi(key, language, params);
    return element;
}

function createButton(className: string, attributes: Record<string, string>): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value);
    return button;
}

function setAccessibleName(element: HTMLElement, label: string): void {
    if (element.getAttribute('aria-label') !== label) element.setAttribute('aria-label', label);
    if (element.title !== label) element.title = label;
}

function createHeader(language: UiLanguage, compact = false): HTMLElement {
    const title = createTextElement('div', 'fluent-read-video-menu-title', '');
    if (compact) {
        const back = createButton('fluent-read-video-menu-back', {'data-action': 'close-subtitle-tools', role: 'menuitem'});
        back.dataset.i18nAriaKey = 'video.back';
        setAccessibleName(back, translateVideoUi('video.back', language));
        back.hidden = true;
        back.appendChild(createIcon('back'));
        title.append(back, keyedText('span', 'fluent-read-video-menu-brand', 'video.subtitleTitle', language));
    } else title.appendChild(keyedText('span', 'fluent-read-video-menu-brand', 'common.brand', language));
    const settings = createButton('fluent-read-video-menu-item fluent-read-video-menu-settings', {
        'data-action': 'open-settings', role: 'menuitem',
    });
    settings.dataset.i18nAriaKey = 'video.openSettings';
    setAccessibleName(settings, translateVideoUi('video.openSettings', language));
    const service = createTextElement('span', 'fluent-read-video-menu-service', '');
    service.dataset.serviceLabel = 'true';
    settings.append(service, createIcon('settings'));
    const close = createButton('fluent-read-video-menu-close', {'data-action': 'close-menu', role: 'menuitem'});
    close.dataset.i18nAriaKey = 'video.closeMenu';
    setAccessibleName(close, translateVideoUi('video.closeMenu', language));
    close.appendChild(createIcon('close'));
    title.append(settings, close);
    return title;
}

function createModeGroup(language: UiLanguage): HTMLElement {
    const group = createTextElement('div', 'fluent-read-video-menu-mode-group', '');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', translateVideoUi('video.displayMode', language));
    for (const mode of VIDEO_MENU_MODES) {
        const item = keyedText('button', 'fluent-read-video-menu-mode', VIDEO_MENU_MODE_KEYS[mode], language);
        item.type = 'button';
        item.dataset.mode = mode;
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', 'false');
        if (mode === 'off') {
            item.dataset.i18nTitleKey = 'video.modeOffHint';
            item.title = translateVideoUi('video.modeOffHint', language);
        }
        group.appendChild(item);
    }
    return group;
}

function createSubtitleOrderRow(language: UiLanguage): HTMLElement {
    const setting = createTextElement('div', 'fluent-read-video-menu-order-setting', '');
    const row = createTextElement('div', 'fluent-read-video-menu-row', '');
    row.appendChild(keyedText('span', 'fluent-read-video-menu-row-label', 'video.bilingualOrder', language));
    const group = createTextElement('div', 'fluent-read-video-menu-order-controls', '');
    group.setAttribute('role', 'group');
    group.dataset.i18nAriaKey = 'video.bilingualOrder';
    group.setAttribute('aria-label', translateVideoUi('video.bilingualOrder', language));
    for (const [order, key] of [['original-first', 'video.originalFirst'], ['translation-first', 'video.translationFirst']]) {
        const button = createButton('fluent-read-video-menu-mode fluent-read-video-menu-order-choice', {});
        button.type = 'button'; button.dataset.subtitleOrder = order;
        button.setAttribute('role', 'menuitemradio'); button.setAttribute('aria-checked', 'false');
        const diagram = createTextElement('span', 'fluent-read-video-menu-order-diagram', '');
        diagram.setAttribute('aria-hidden', 'true');
        const original = createTextElement('span', 'fluent-read-video-menu-order-original', '');
        const translation = createTextElement('span', 'fluent-read-video-menu-order-translation', '');
        diagram.append(...(order === 'original-first' ? [original, translation] : [translation, original]));
        button.append(diagram, keyedText('span', '', key, language));
        group.appendChild(button);
    }
    row.appendChild(group);
    const hint = keyedText('p', 'fluent-read-video-menu-source-hint', 'video.bilingualOrderHint', language);
    hint.dataset.subtitleOrderHint = 'true';
    hint.hidden = true;
    setting.append(row, hint);
    return setting;
}

export function renderVideoSubtitleOrder(menu: HTMLElement, order: VideoSubtitleAppearance['bilingualOrder'], disabled: boolean, bilingual = true): void {
    const setting = menu.querySelector<HTMLElement>('.fluent-read-video-menu-order-setting');
    const active = String(!disabled && bilingual);
    if (setting && setting.dataset.active !== active) setting.dataset.active = active;
    const hint = menu.querySelector<HTMLElement>('[data-subtitle-order-hint]');
    if (hint && hint.hidden !== (bilingual || disabled)) hint.hidden = bilingual || disabled;
    menu.querySelectorAll<HTMLButtonElement>('[data-subtitle-order]').forEach(button => {
        const checked = String(button.dataset.subtitleOrder === order);
        if (button.getAttribute('aria-checked') !== checked) button.setAttribute('aria-checked', checked);
        if (button.disabled !== (disabled || !bilingual)) button.disabled = disabled || !bilingual;
    });
}

function createTimingRow(language: UiLanguage): HTMLElement {
    const timing = createTextElement('div', 'fluent-read-video-menu-row fluent-read-video-menu-timing', '');
    timing.dataset.timingRow = 'true';
    timing.appendChild(keyedText('span', 'fluent-read-video-menu-row-label', 'video.timingShort', language));
    const controls = createTextElement('div', 'fluent-read-video-menu-timing-controls', '');
    const stepper = (action: string, icon: IconName) => {
        const button = createButton('fluent-read-video-menu-step', {'data-action': action, role: 'menuitem'});
        button.appendChild(createIcon(icon));
        return button;
    };
    const value = createTextElement('output', 'fluent-read-video-menu-timing-value', '0.0 s');
    value.dataset.subtitleOffset = 'true';
    value.setAttribute('aria-live', 'polite');
    const reset = stepper('reset-subtitle-timing', 'reset');
    reset.classList.add('fluent-read-video-menu-step-reset');
    controls.append(reset, stepper('subtitle-earlier', 'minus'), value, stepper('subtitle-later', 'plus'));
    timing.appendChild(controls);
    return timing;
}

function createDownloadActions(language: UiLanguage): HTMLElement {
    const actions = createTextElement('div', 'fluent-read-video-menu-downloads', '');
    const format = document.createElement('select');
    format.dataset.subtitleFormat = 'true';
    format.setAttribute('aria-label', translateVideoUi('video.exportFormat', language));
    format.style.cssText = 'margin:4px 8px 8px;padding:5px 8px;max-width:160px;color:inherit;background:#27272a;border:1px solid #52525b;border-radius:6px;';
    for (const [value, label] of [['srt', 'SRT'], ['vtt', 'WebVTT'], ['md', 'Markdown']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = label; format.appendChild(option);
    }
    actions.appendChild(format);
    for (const [action, key, ariaKey] of [
        ['download-subtitles', 'video.downloadOriginalShort', 'video.downloadOriginal'],
        ['download-translated-subtitles', 'video.downloadTranslatedShort', 'video.downloadTranslated'],
        ['download-bilingual-subtitles', 'video.downloadBilingualShort', 'video.downloadBilingual'],
    ]) {
        const button = createButton('fluent-read-video-menu-item fluent-read-video-menu-download', {'data-action': action, role: 'menuitem'});
        button.dataset.i18nAriaKey = ariaKey;
        setAccessibleName(button, translateVideoUi(ariaKey, language));
        button.append(createIcon('download'), keyedText('span', 'fluent-read-video-menu-label', key, language));
        actions.appendChild(button);
    }
    return actions;
}

function createDownloadToggle(language: UiLanguage): HTMLButtonElement {
    const button = createButton('fluent-read-video-menu-download-toggle', {
        'data-action': 'toggle-subtitle-downloads', role: 'menuitem',
        'aria-expanded': 'false', 'aria-controls': 'fluent-read-video-subtitle-downloads',
    });
    button.dataset.i18nAriaKey = 'video.downloadGroup';
    setAccessibleName(button, translateVideoUi('video.downloadGroup', language));
    button.appendChild(createIcon('download'));
    return button;
}

function createDownloadDisclosure(language: UiLanguage): HTMLElement {
    const group = createTextElement('div', 'fluent-read-video-menu-export', '');
    group.dataset.downloadGroup = 'true';
    group.hidden = true;
    const actions = createDownloadActions(language);
    actions.id = 'fluent-read-video-subtitle-downloads';
    actions.dataset.subtitleDownloads = 'true';
    actions.hidden = true;
    group.append(actions, createDownloadStatus());
    return group;
}

function createDownloadStatus(): HTMLElement {
    const status = createTextElement('p', 'fluent-read-video-menu-download-status', '');
    status.dataset.downloadStatus = 'true';
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    return status;
}

export function handleVideoMenuDisclosure(menu: HTMLElement, action: string | undefined): boolean {
    if (action !== 'toggle-subtitle-downloads') return false;
    const button = menu.querySelector<HTMLButtonElement>('[data-action="toggle-subtitle-downloads"]')!;
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    menu.querySelector<HTMLElement>('[data-subtitle-downloads]')!.hidden = !open;
    syncDownloadGroupVisibility(menu);
    syncVideoPlayerMenuLayout(menu);
    return true;
}

export function closeVideoMenuDisclosure(menu: HTMLElement): boolean {
    const downloads = menu.querySelector<HTMLElement>('[data-subtitle-downloads]');
    if (downloads && !downloads.closest('[hidden], [inert]')) {
        handleVideoMenuDisclosure(menu, 'toggle-subtitle-downloads');
        menu.querySelector<HTMLButtonElement>('[data-action="toggle-subtitle-downloads"]')!.focus({preventScroll: true});
        return true;
    }
    return false;
}

export function resetVideoMenuDisclosures(menu: HTMLElement): void {
    menu.querySelector<HTMLElement>('[data-subtitle-downloads]')!.hidden = true;
    menu.querySelector('[data-action="toggle-subtitle-downloads"]')!.setAttribute('aria-expanded', 'false');
    syncDownloadGroupVisibility(menu);
}

function syncDownloadGroupVisibility(menu: HTMLElement): void {
    const group = menu.querySelector<HTMLElement>('[data-download-group]');
    if (group) group.hidden = menu.querySelector('[data-action="toggle-subtitle-downloads"]')?.getAttribute('aria-expanded') !== 'true'
        && !menu.querySelector('[data-download-status]')?.textContent;
}

export function createVideoPlayerMenu(language: UiLanguage, compact: boolean): HTMLElement {
    const menu = document.createElement('div');
    menu.id = VIDEO_TRANSLATION_MENU_ID;
    menu.className = 'fluent-read-video-subtitle-menu fluent-read-video-ui notranslate';
    menu.hidden = true;
    menu.dataset.layout = 'stack';
    menu.dataset.view = 'main';
    menu.dataset.compact = String(compact);
    menu.dataset.panel = 'watch';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', translateVideoUi('video.menuAriaLabel', language));
    markVideoUi(menu);

    const header = createHeader(language, compact);
    header.insertBefore(createDownloadToggle(language), header.querySelector('[data-action="close-menu"]'));
    menu.appendChild(header);
    const main = createTextElement('div', 'fluent-read-video-menu-main', '');
    const body = createTextElement('div', 'fluent-read-video-menu-body', '');
    main.appendChild(body);

    if (compact) {
        const watch = createTextElement('div', 'fluent-read-video-menu-watch', '');
        const more = keyedText('button', 'fluent-read-video-menu-more', 'video.subtitleTools', language);
        more.type = 'button';
        more.dataset.action = 'open-subtitle-tools';
        more.setAttribute('role', 'menuitem');
        more.setAttribute('aria-expanded', 'false');
        more.setAttribute('aria-controls', 'fluent-read-video-menu-tools');
        const label = keyedText('span', '', 'video.subtitleTools', language);
        delete more.dataset.i18nKey;
        more.replaceChildren(label, createIcon('next'));
        watch.append(createModeGroup(language), createSubtitleOrderRow(language), createSourceStatus(language), more);

        const tools = createTextElement('div', 'fluent-read-video-menu-tools', '');
        tools.id = 'fluent-read-video-menu-tools';
        tools.hidden = true;
        const downloads = createDownloadDisclosure(language);
        tools.append(createTimingRow(language));
        body.append(watch, tools, downloads);
        menu.append(main);
        return menu;
    }

    const display = createTextElement('div', 'fluent-read-video-menu-section fluent-read-video-menu-display', '');
    display.append(createModeGroup(language), createSubtitleOrderRow(language), createTimingRow(language));
    const actions = createDownloadDisclosure(language);
    actions.classList.add('fluent-read-video-menu-actions');
    const nativeHint = keyedText('p', 'fluent-read-video-menu-source-hint fluent-read-video-native-fullscreen-hint', 'video.nativeFullscreenHint', language);
    nativeHint.dataset.nativeFullscreenHint = 'true';
    nativeHint.hidden = true;
    body.append(display, actions, nativeHint);
    menu.appendChild(main);
    return menu;
}

export function setVideoMenuToolsOpen(menu: HTMLElement, open: boolean): void {
    const watch = menu.querySelector<HTMLElement>('.fluent-read-video-menu-watch');
    const tools = menu.querySelector<HTMLElement>('.fluent-read-video-menu-tools');
    if (!watch || !tools) return;
    if (!open) resetVideoMenuDisclosures(menu);
    watch.hidden = open;
    tools.hidden = !open;
    menu.dataset.panel = open ? 'tools' : 'watch';
    menu.querySelector<HTMLElement>('[data-action="close-subtitle-tools"]')!.hidden = !open;
    menu.querySelector<HTMLElement>('[data-action="open-subtitle-tools"]')!.setAttribute('aria-expanded', String(open));
    syncVideoPlayerMenuLayout(menu);
}

function createSourceStatus(language: UiLanguage): HTMLElement {
    const group = createTextElement('div', 'fluent-read-video-menu-source', '');
    const status = createTextElement('div', 'fluent-read-video-menu-source-status', '');
    status.dataset.sourceStatus = 'true';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    const hint = createTextElement('p', 'fluent-read-video-menu-source-hint', '');
    hint.dataset.sourceHint = 'true';
    const actions = createTextElement('div', 'fluent-read-video-menu-source-actions', '');
    const retry = keyedText('button', 'fluent-read-video-menu-secondary', 'video.retryTranslation', language);
    retry.type = 'button';
    retry.dataset.action = 'retry-subtitle-translation';
    retry.setAttribute('role', 'menuitem');
    retry.hidden = true;
    actions.appendChild(retry);
    group.append(status, hint, actions);
    return group;
}

export interface VideoSourceStatus {
    enabled: boolean;
    source: 'none' | 'native';
    cueCount: number;
    translationFailed: boolean;
}

export function renderVideoSourceStatus(menu: HTMLElement, state: VideoSourceStatus, language: UiLanguage): void {
    const group = menu.querySelector<HTMLElement>('.fluent-read-video-menu-source');
    if (!group) return;
    const key = !state.enabled ? 'video.sourceOff'
        : state.source !== 'none' ? `video.source.${state.source}`
            : 'video.sourceMissing';
    const status = group.querySelector<HTMLElement>('[data-source-status]')!;
    const label = translateVideoUi(key, language, {count: state.cueCount});
    if (status.textContent !== label) status.textContent = label;
    const hintKey = !state.enabled ? ''
        : state.translationFailed ? 'video.translationFailedHint'
            : state.source === 'none' ? 'video.sourceMissingHint' : '';
    const hint = group.querySelector<HTMLElement>('[data-source-hint]')!;
    const hintText = hintKey ? translateVideoUi(hintKey, language) : '';
    if (hint.textContent !== hintText) hint.textContent = hintText;
    hint.hidden = !hintText;
    group.dataset.error = String(state.translationFailed && state.enabled);
    group.querySelector<HTMLButtonElement>('[data-action="retry-subtitle-translation"]')!.hidden = !state.enabled || !state.translationFailed;
    group.querySelector<HTMLElement>('.fluent-read-video-menu-source-actions')!.hidden = !state.enabled || !state.translationFailed;
    const canResetTiming = menu.querySelector<HTMLElement>('[data-timing-row]')?.hidden === false;
    menu.querySelector<HTMLElement>('[data-action="open-subtitle-tools"]')!.hidden = !state.enabled || (state.source === 'none' && !canResetTiming);
    for (const button of menu.querySelectorAll<HTMLButtonElement>('.fluent-read-video-menu-download')) {
        if (button.getAttribute('aria-busy') === 'true') continue;
        button.disabled = !state.enabled || state.cueCount === 0;
    }
}

export function handleVideoMenuNavigation(event: KeyboardEvent): void {
    if (!event.isTrusted) return;
    const menu = event.currentTarget as HTMLElement;
    if (!(event.target instanceof HTMLElement) || !menu.contains(event.target)) return;
    event.stopPropagation();
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const scope = horizontal ? event.target.closest('.fluent-read-video-menu-mode-group, .fluent-read-video-menu-order-controls') : menu;
    if (!scope) return;
    const buttons = Array.from(scope.querySelectorAll<HTMLButtonElement>('button'))
        .filter(button => !button.disabled && !button.closest('[hidden], [inert]')
            && (button.dataset.action !== 'close-subtitle-tools' || menu.dataset.view === 'main'));
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (current + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
    const target = buttons[next];
    const ownsBodyTarget = menu.querySelector('.fluent-read-video-menu-body')?.contains(target);
    if (menu.dataset.presentation === 'viewport' && (ownsBodyTarget || menu.dataset.viewportState === 'close-only')) {
        target.focus({preventScroll: true});
        revealVideoMenuBodyControl(menu, target);
    } else target.focus();
}

export function renderVideoMenuMode(menu: HTMLElement, selected: VideoMenuMode, disabled: boolean, disabledReason: string): void {
    menu.querySelectorAll<HTMLButtonElement>('.fluent-read-video-menu-mode-group [data-mode]').forEach((item) => {
        const checked = String(item.dataset.mode === selected);
        if (item.getAttribute('aria-checked') !== checked) item.setAttribute('aria-checked', checked);
        if (item.disabled !== disabled) item.disabled = disabled;
    });
    const group = menu.querySelector<HTMLElement>('.fluent-read-video-menu-mode-group');
    const title = disabled ? disabledReason : '';
    if (group && group.title !== title) group.title = title;
}

export function renderVideoSubtitleTiming(menu: HTMLElement, offsetMs: number, available: boolean, language: UiLanguage): void {
    const row = menu.querySelector<HTMLElement>('[data-timing-row]')!;
    row.hidden = !available && offsetMs === 0;
    const title = available ? '' : localizeVideoUiText('当前字幕暂不支持时间调整', language);
    if (row.title !== title) row.title = title;
    const value = menu.querySelector<HTMLOutputElement>('[data-subtitle-offset]')!;
    const text = `${offsetMs > 0 ? '+' : ''}${(offsetMs / 1000).toFixed(1)} s`;
    if (value.textContent !== text) value.textContent = text;
    const label = localizeVideoUiText('字幕时间偏移', language);
    if (value.getAttribute('aria-label') !== label) value.setAttribute('aria-label', label);
    const earlier = menu.querySelector<HTMLButtonElement>('[data-action="subtitle-earlier"]')!;
    const later = menu.querySelector<HTMLButtonElement>('[data-action="subtitle-later"]')!;
    const reset = menu.querySelector<HTMLButtonElement>('[data-action="reset-subtitle-timing"]')!;
    earlier.disabled = !available || offsetMs <= -10_000;
    later.disabled = !available || offsetMs >= 10_000;
    reset.disabled = offsetMs === 0;
    setAccessibleName(earlier, localizeVideoUiText('提前 0.5 秒', language));
    setAccessibleName(later, localizeVideoUiText('延后 0.5 秒', language));
    setAccessibleName(reset, localizeVideoUiText('重置字幕时间', language));
}

const downloadStatusTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function setVideoMenuDownloadStatus(menu: HTMLElement, text: string, clearAfterMs?: number): void {
    const timer = downloadStatusTimers.get(menu);
    if (timer !== undefined) { clearTimeout(timer); downloadStatusTimers.delete(menu); }
    const status = menu.querySelector<HTMLElement>('[data-download-status]');
    if (status && status.textContent !== text) status.textContent = text;
    syncDownloadGroupVisibility(menu);
    if (text && clearAfterMs) {
        downloadStatusTimers.set(menu, setTimeout(() => {
            downloadStatusTimers.delete(menu);
            if (status && status.textContent === text) { status.textContent = ''; syncDownloadGroupVisibility(menu); }
        }, clearAfterMs));
    }
}

function syncVideoMenuCloseOnly(menu: HTMLElement, closeOnly: boolean): void {
    const next = closeOnly ? 'close-only' : 'normal';
    if (menu.dataset.viewportState === next) return;
    menu.dataset.viewportState = next;
    const targets = [menu.querySelector<HTMLElement>('.fluent-read-video-menu-main'), menu.querySelector<HTMLElement>('[data-action="open-settings"]')]
        .filter((node): node is HTMLElement => Boolean(node));
    const heldFoldedFocus = closeOnly && targets.some(node => node.contains(menu.ownerDocument.activeElement));
    for (const node of targets) {
        if (closeOnly && !node.hasAttribute('inert')) {
            node.setAttribute('inert', '');
            node.dataset.viewportInert = 'true';
        } else if (!closeOnly && node.dataset.viewportInert === 'true') {
            node.removeAttribute('inert');
            delete node.dataset.viewportInert;
        }
    }
    if (heldFoldedFocus) menu.querySelector<HTMLButtonElement>('[data-action="close-menu"]')!.focus({preventScroll: true});
}

export function revealVideoMenuBodyControl(menu: HTMLElement, control: HTMLElement | null): void {
    if (menu.hidden || menu.dataset.presentation !== 'viewport' || menu.dataset.viewportState === 'close-only'
        || !control || control.closest('[hidden], [inert]')) return;
    const body = menu.querySelector<HTMLElement>('.fluent-read-video-menu-body');
    if (!body?.contains(control)) return;
    const bounds = body.getBoundingClientRect(), target = control.getBoundingClientRect();
    if (!(bounds.height > 0 && body.clientHeight > 0 && target.height > 0)) return;
    const scale = bounds.height / (body.offsetHeight || bounds.height);
    const top = bounds.top + body.clientTop * scale, bottom = top + body.clientHeight * scale;
    if (!(scale > 0) || ![scale, top, bottom, target.top, target.bottom].every(Number.isFinite)) return;
    const delta = target.top < top ? target.top - top : target.bottom > bottom ? target.bottom - bottom : 0;
    if (delta) body.scrollTop += delta / scale;
}

const viewportMenuSizes = new WeakMap<HTMLElement, {width: number; height: number}>();

export function syncVideoPlayerMenuLayout(menu: HTMLElement): void {
    const hideTools = menu.dataset.view !== 'main';
    for (const tool of menu.querySelectorAll<HTMLElement>('[data-action="toggle-subtitle-downloads"]')) {
        if (tool.hidden !== hideTools) tool.hidden = hideTools;
    }
    const player = menu.parentElement;
    if (menu.hidden || !player) return;
    const width = player.clientWidth;
    const height = player.clientHeight;
    if (!width || !height) return;
    syncVideoMenuCloseOnly(menu, menu.dataset.presentation === 'viewport' && height < VIEWPORT_MENU_CLOSE_ONLY_HEIGHT_PX);
    if (menu.dataset.presentation === 'viewport') {
        const layout = width >= VIEWPORT_MENU_WIDE_MIN_WIDTH_PX ? 'wide' : 'stack';
        if (menu.dataset.layout !== layout) menu.dataset.layout = layout;
        const previous = viewportMenuSizes.get(menu);
        viewportMenuSizes.set(menu, {width, height});
        if (!previous || previous.width !== width || previous.height !== height) {
            revealVideoMenuBodyControl(menu, menu.ownerDocument.activeElement as HTMLElement | null);
        }
        return;
    }
    viewportMenuSizes.delete(menu);
    if (width < WIDE_LAYOUT_MIN_PLAYER_WIDTH_PX
        || (menu.dataset.compact === 'true' && menu.dataset.panel === 'watch' && menu.dataset.view === 'main')) {
        if (menu.dataset.layout !== 'stack') menu.dataset.layout = 'stack';
        return;
    }
    if (menu.dataset.layout !== 'stack') menu.dataset.layout = 'stack';
    const hasDownloadStatus = Boolean(menu.querySelector('[data-download-status]')?.textContent);
    if (hasDownloadStatus) menu.dataset.measuring = 'true';
    const needed = menu.scrollHeight;
    if (hasDownloadStatus) delete menu.dataset.measuring;
    const available = height - MENU_BOTTOM_OFFSET_PX - MENU_TOP_GAP_PX;
    if (needed > available * STACK_LAYOUT_MAX_HEIGHT_RATIO) menu.dataset.layout = 'wide';
}
