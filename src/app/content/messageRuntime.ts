/**
 * @file src/app/content/messageRuntime.ts
 * 文件职责：创建 content 侧 runtime 消息处理函数，把 popup/background 的设置变化和功能命令映射为当前页面上的精确 mount、unmount 或状态响应。
 * 主要内容：处理译文字体、页面通知、悬浮球、翻译进度面板、站点禁用、缓存清理、全文状态查询及全文右键菜单命令。
 * 模块边界：本文件只做消息到 feature 生命周期的适配，不注册全局监听器、不执行供应商翻译，也不实现组件 UI。
 */
import type {ContentScriptContext} from 'wxt/utils/content-script-context';
import {config} from '@/src/services/config/store';
import {
    invalidateFullPageTranslationSessionCache,
    mountFloatingBall,
    mountTranslationProgressPanel,
    unmountFloatingBall,
    unmountTranslationProgressPanel,
} from './features';
import {handleFullPageCompletionQuery} from './fullPageCompletionQuery';
import {forwardLegacyCacheClear} from './cacheMessage';
import {handleContextMenuNotice, handleContextMenuTranslation} from './contextMenuCommands';
import {browserCapabilities, type BrowserCapabilities} from '@/src/platform/browser/capabilities';
import {handlePageTranslationFontMessage, type PageTranslationFontMessageState} from './pageTranslationFontMessage';

export interface ContentRuntimeMessageState extends PageTranslationFontMessageState {
    updateSiteDisabled(disabled: boolean): Promise<void>;
}
export type ContentRuntimeMessageHandler = (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => boolean;

/** 创建当前 document 私有的 runtime message handler，避免跨生命周期共享可变状态。 */
export function createContentRuntimeMessageHandler(ctx: ContentScriptContext, state: ContentRuntimeMessageState,
    capabilities: BrowserCapabilities = browserCapabilities): ContentRuntimeMessageHandler {
    return (message, _sender, sendResponse) => {
        if (!message || typeof message !== 'object') return false;
        const payload = message as Record<string, unknown>;
        const pageFont = handlePageTranslationFontMessage(payload, _sender, ctx, state, sendResponse);
        if (pageFont !== undefined) return pageFont;
        const notice = handleContextMenuNotice(payload, ctx, state, sendResponse);
        if (notice !== undefined) return notice;
        if (payload.type === 'qqMailFrameCommand' || payload.type === 'qqMailFrameRefresh' ||
            payload.type === 'embeddedFrameCommand' || payload.type === 'embeddedFrameRefresh') return false;
        if (payload.message === 'clearCache') {
            forwardLegacyCacheClear(
                (request) => browser.runtime.sendMessage(request),
                sendResponse,
            );
            return true;
        }
        if (payload.type === 'translationCacheCleared') {
            invalidateFullPageTranslationSessionCache();
            sendResponse({status: 'success'});
            return true;
        }
        if (payload.type === 'updateSiteExtensionDisabled') {
            if (typeof payload.isDisabled !== 'boolean') return false;
            void state.updateSiteDisabled(payload.isDisabled)
                .then(() => sendResponse({status: 'success'}))
                .catch(() => sendResponse({status: 'failed'}));
            return true;
        }
        if ((state.isSiteDisabled() || state.isPageSuspended?.()) && payload.type !== 'getFullPageTranslationState') {
            sendResponse({status: 'disabled'});
            return true;
        }
        if (payload.type === 'toggleFloatingBall') {
            const requestedEnabled = payload.isEnabled === true;
            config.disableFloatingBall = !requestedEnabled;
            if (requestedEnabled && config.on !== false) void mountFloatingBall(ctx);
            else unmountFloatingBall();
            sendResponse();
            return true;
        }
        if (payload.type === 'toggleTranslationProgressPanel') {
            const requestedEnabled = payload.isEnabled === true;
            config.translationProgressPanelEnabled = requestedEnabled;
            if (requestedEnabled && config.on !== false) void mountTranslationProgressPanel(ctx);
            else unmountTranslationProgressPanel();
            sendResponse();
            return true;
        }
        if (payload.type === 'getFullPageTranslationState') {
            return handleFullPageCompletionQuery(payload, _sender, ctx, state, sendResponse);
        }
        const contextMenu = handleContextMenuTranslation(payload, state, capabilities, sendResponse);
        if (contextMenu !== undefined) return contextMenu;
        return false;
    };
}
