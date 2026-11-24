/**
 * @file src/app/background/contextMenuActions.ts
 * 文件职责：执行右键菜单点击后的实际动作，把菜单语义映射为发往顶层 frame 的全文翻译/恢复消息或站点禁用配置写入。
 * 主要内容：支持 translatePage 与 toggleSite 两个核心右键动作并回传最新全文状态。
 * 模块边界：本文件只负责动作执行，不创建菜单、不计算标题、不缓存标签页状态。
 */
import type {ContextMenuActionId} from '@/src/core/context-menu/domain';
import {getSiteBaseDomain, normalizeDisabledExtensionDomains} from '@/src/core/site-rules/domain';
import {config} from '@/src/services/config/store';
import type {FullPageStateResponse} from './tabTranslationQuery';
import type {ContextMenuFailureReason} from '@/src/core/context-menu/feedback';

export interface ContextMenuClickInfo {
    readonly menuItemId?: unknown;
    readonly srcUrl?: string;
    readonly frameId?: number;
    readonly frameUrl?: string;
    readonly pageUrl?: string;
    readonly selectionText?: string;
}

export interface ContextMenuClickTab {
    readonly id?: number;
    readonly url?: string;
    readonly title?: string;
}

/** 点击结果：翻译类动作回传新的全文翻译状态，网站开关回传该网站之后的禁用状态。 */
export interface ContextMenuActionResult {
    readonly handled: boolean;
    readonly isTranslated?: boolean;
    readonly isSiteDisabled?: boolean;
    readonly reason?: ContextMenuFailureReason;
}

/** 切换当前网站的扩展开关，并回传切换之后的禁用状态。 */
export function toggleSiteExtensionDisabled(info: ContextMenuClickInfo, tab: ContextMenuClickTab): ContextMenuActionResult {
    const domain = getSiteBaseDomain(info.pageUrl || tab.url || '');
    if (!domain) return {handled: false};
    const domains = normalizeDisabledExtensionDomains(config.disabledExtensionDomains);
    const disabled = domains.includes(domain);
    config.disabledExtensionDomains = disabled
        ? domains.filter((item) => item !== domain)
        : [...domains, domain];
    return {handled: true, isSiteDisabled: !disabled, isTranslated: disabled ? undefined : false};
}

/** 执行一次菜单动作；isTranslated 表示页面在动作之后的全文翻译状态，未知时返回 undefined。 */
export async function runContextMenuAction(
    action: ContextMenuActionId,
    tabId: number,
    info: ContextMenuClickInfo,
    tab: ContextMenuClickTab,
    wasTranslated: boolean,
): Promise<ContextMenuActionResult> {
    if (action === 'toggleSite') return toggleSiteExtensionDisabled(info, tab);
    if (action !== 'translatePage') return {handled: false};
    const response = await browser.tabs.sendMessage(tabId, {
        type: 'contextMenuTranslate',
        action: wasTranslated ? 'restore' : 'fullPage',
    }, {frameId: 0}) as FullPageStateResponse | undefined;
    if (response?.status !== 'success') return {handled: false};
    return {
        handled: true,
        isTranslated: typeof response.isTranslated === 'boolean' ? response.isTranslated : !wasTranslated,
    };
}
