/**
 * @file src/app/background/runtime.ts
 * 文件职责：作为扩展后台应用的顶层启动函数，按顺序组装标签页状态、请求头规则、右键菜单、工具栏操作、角标、消息监听和后台维护任务。
 * 主要内容：创建共享 TabTranslationStateStore 并安装 Chrome / Edge 所需的后台运行时子系统。
 * 模块边界：本文件只负责后台生命周期启动，不实现消息分派、菜单规则、配置历史或缓存算法。
 */
import {installBackgroundMaintenance} from './maintenanceRuntime';
import {installRequestHeaderRuntime} from './requestHeaderRuntime';
import {installBackgroundContextMenus} from './contextMenuRuntime';
import {installBackgroundBadge} from './badgeRuntime';
import {installToolbarActionRuntime} from './toolbarActionRuntime';
import {installBackgroundMessageRuntime} from './messageRuntime';
import {TabTranslationStateStore} from './tabTranslationState';

const tabTranslationStates = new TabTranslationStateStore();

/** 启动一次 MV3 service worker 实例。 */
export function startBackgroundApp(): void {
    installRequestHeaderRuntime();
    const contextMenus = installBackgroundContextMenus(tabTranslationStates);
    installToolbarActionRuntime(tabTranslationStates);
    const badge = installBackgroundBadge(tabTranslationStates);
    installBackgroundMessageRuntime({
        tabTranslationStates,
        onFullPageStateChanged: (tabId) => {
            if (contextMenus.isSupported) void contextMenus.update(tabId);
            if (badge.isSupported) void badge.update(tabId);
        },
    });
    installBackgroundMaintenance();
}
