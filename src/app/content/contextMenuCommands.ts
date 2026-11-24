/**
 * @file src/app/content/contextMenuCommands.ts
 * 文件职责：将右键菜单的全文翻译、恢复原文与通知命令转给对应内容页功能。
 * 主要内容：处理 contextMenuNotice 与 contextMenuTranslate（仅 fullPage / restore），回传文档实例标识、工具栏状态和诊断信息。
 * 模块边界：只适配生产消息和 feature 公共入口，不执行供应商请求、不读写菜单；停用与页面挂起门禁由消息组合根统一执行。
 */
import type {ContentScriptContext} from 'wxt/utils/content-script-context';
import {config} from '@/src/services/config/store';
import {isContextMenuFailureReason} from '@/src/core/context-menu/feedback';
import {normalizeUiLanguage, translate} from '@/src/core/i18n';
import {dismissPageNotice, showPageNotice} from '@/src/features/page-notice/public';
import type {BrowserCapabilities} from '@/src/platform/browser/capabilities';
import {
    autoTranslateEnglishPage,
    isFullPageTranslationActive,
    restoreOriginalContent,
    getTranslationToolbarStatus,
    getFullPageTranslationDiagnostic,
    getFullPageTranslationDocumentToken,
} from './features';

type Respond = (response?: unknown) => void;
interface PageState {isSiteDisabled(): boolean; isPageSuspended?(): boolean;}

/** 反馈允许在停用站点显示，以便解释操作为什么不可用。 */
export function handleContextMenuNotice(payload: Record<string, unknown>, ctx: ContentScriptContext,
    state: PageState, sendResponse: Respond): boolean | undefined {
    if (payload.type === 'contextMenuNotice') {
        if (!isContextMenuFailureReason(payload.reason)) return false;
        if (ctx.isInvalid || state.isPageSuspended?.()) {
            sendResponse({status: 'failed'});
            return true;
        }
        showPageNotice(translate(`contextMenu.notice.${payload.reason}`, normalizeUiLanguage(config.uiLanguage)),
            'error', {key: 'context-menu', signal: ctx.signal, durationMs: 6000});
        sendResponse({status: 'success'});
        return true;
    }
    return undefined;
}

/** undefined 表示不是本模块可识别的命令，组合根继续分发。 */
export function handleContextMenuTranslation(payload: Record<string, unknown>, state: PageState,
    _capabilities: BrowserCapabilities, sendResponse: Respond): boolean | undefined {
    const respond = (response: {
        status: string;
        action?: string;
        isTranslated?: boolean;
        documentToken?: string;
        toolbarStatus?: ReturnType<typeof getTranslationToolbarStatus>;
        diagnostic?: ReturnType<typeof getFullPageTranslationDiagnostic>;
    }): void => {
        if (response.status === 'success') dismissPageNotice('context-menu');
        sendResponse(response);
    };
    if (payload.type === 'contextMenuTranslate') {
        if (config.on === false || state.isSiteDisabled()) {
            respond({status: 'disabled'});
            return true;
        }
        if (payload.action === 'fullPage' || payload.action === 'restore') {
            const restoring = payload.action === 'restore';
            if (restoring) restoreOriginalContent();
            else autoTranslateEnglishPage();
            const isTranslated = isFullPageTranslationActive();
            const changed = isTranslated !== restoring;
            const diagnostic = getFullPageTranslationDiagnostic();
            respond({
                status: changed ? 'success' : 'failed',
                action: changed ? (restoring ? 'restored' : 'translated') : 'unchanged',
                isTranslated,
                documentToken: getFullPageTranslationDocumentToken(),
                toolbarStatus: getTranslationToolbarStatus(),
                ...(diagnostic ? {diagnostic} : {}),
            });
            return true;
        }
    }
    return undefined;
}
