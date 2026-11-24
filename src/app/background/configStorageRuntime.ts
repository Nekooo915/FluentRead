/**
 * @file src/app/background/configStorageRuntime.ts
 * 文件职责：把后台配置存储端口连接到浏览器标签页广播与变化通知。
 * 主要内容：装配标签页广播运行时与配置变更广播监听。
 * 模块边界：本文件是后台 composition glue，不实现加密、迁移或授权规则。
 */
import {configStorage} from '@/src/platform/storage/configStorageRuntime';
import {installConfigStorageBroadcast} from './configStorageBroadcast';
import {createTabBroadcastRuntime, TAB_BROADCAST_SESSION_KEY, type TabBroadcastRuntime} from './tabBroadcast';

export function installBrowserTabBroadcastRuntime(browserName: string): TabBroadcastRuntime {
    const tabBroadcast = createTabBroadcastRuntime({
        browserName,
        extensionId: browser.runtime.id,
        isExtensionUrl: url => url.startsWith(browser.runtime.getURL('/')),
        queryTabs: () => browser.tabs.query({}) as Promise<Array<{id?: number}>>,
        sendTabMessage: (tabId, message) => browser.tabs.sendMessage(tabId, message),
        readSessionRecipients: async () => (await browser.storage.session.get(TAB_BROADCAST_SESSION_KEY))[TAB_BROADCAST_SESSION_KEY],
        writeSessionRecipients: tabIds => browser.storage.session.set({[TAB_BROADCAST_SESSION_KEY]: tabIds}),
        warn: message => console.warn(message),
    });
    browser.tabs.onRemoved.addListener((tabId: number) => {void tabBroadcast.removeTab(tabId);});
    return tabBroadcast;
}

export function installBrowserConfigStorageBroadcast(tabBroadcast: TabBroadcastRuntime): () => void {
    return installConfigStorageBroadcast(configStorage, {
        sendRuntimeMessage: message => browser.runtime.sendMessage(message),
        queryTabs: tabBroadcast.queryTabs,
        sendTabMessage: tabBroadcast.sendTabMessage,
        broadcastTabMessage: tabBroadcast.broadcastTabMessage,
        warn: (message, error) => console.warn(message, error),
    });
}
