/**
 * @file src/app/background/configMessageHandlers.ts
 * 文件职责：集中组装精简版后台配置消息处理器，使配置保存、读取与官方站点规则共享统一修改队列。
 * 主要内容：连接配置 store 与持久化/读取消息 handler；已移除设置历史、自动设置快照恢复与首次语言引导检查。
 * 模块边界：本文件属于后台 composition root，只负责依赖接线；消息校验位于 handlers，配置持久化位于 services/config。
 */
import {
    config,
    configReady,
    getConfigRevision,
    incrementConfigCount,
    prepareConfigPatchRequest,
    prepareConfigSaveRequest,
    saveConfig,
} from '@/src/services/config/store';
import {configStorage} from '@/src/platform/storage/configStorageRuntime';
import type {BackgroundMessageHandler} from '@/src/services/messaging/backgroundRouter';
import {createConfigStorageReadHandler, createPopupStartupHandler} from './handlers/configStorage';
import {createConfigCountIncrementHandler} from './handlers/configCount';
import {createOfficialSiteRuleHandlers} from './officialSiteRuleRuntime';
import {
    createConfigMutationCoordinator,
    createConfigPersistenceBatchHandler,
    createConfigPersistenceHandler,
    type ConfigPersistenceContext,
} from './handlers/configPersistence';

export function createConfigBackgroundHandlers<TContext extends ConfigPersistenceContext>(
    registerContentReceiver?: (sender: ConfigPersistenceContext['sender']) => Promise<void>,
): Array<BackgroundMessageHandler<TContext>> {
    const mutations = createConfigMutationCoordinator();
    const persistence = createConfigPersistenceHandler({
        ready: configReady,
        getCurrentConfig: () => config,
        prepareConfigPatchRequest,
        prepareConfigSaveRequest,
        saveConfig,
        getCurrentRevision: getConfigRevision,
        runMutation: mutations.run,
        isExtensionUrl: (url) => url.startsWith(browser.runtime.getURL('/')),
    });
    return [
        ...createOfficialSiteRuleHandlers<TContext>(),
        createPopupStartupHandler({
            ready: configReady,
            getSetupCompleted: () => true,
            isExtensionUrl: (url) => url.startsWith(browser.runtime.getURL('/')),
        }),
        createConfigStorageReadHandler({
            ready: configReady,
            registerContentReceiver,
            read: async key => configStorage.getItem(key),
            isExtensionUrl: (url) => url.startsWith(browser.runtime.getURL('/')),
        }),
        createConfigCountIncrementHandler((delta, operationId) => (
            mutations.run(() => incrementConfigCount(delta, operationId))
        )),
        persistence,
        createConfigPersistenceBatchHandler(persistence),
    ] as Array<BackgroundMessageHandler<TContext>>;
}
