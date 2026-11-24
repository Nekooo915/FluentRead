/**
 * @file src/services/config/application.ts
 * 文件职责：以明确端口组装每个运行上下文唯一的配置权威与客户端实例。
 * 主要内容：提供配置水合、订阅、保存与补丁队列；精简版已移除设置历史持久化，历史端口采用空实现以保持权威保存链路简洁。
 * 模块边界：无浏览器或全局配置依赖，不创建平行配置 store；默认运行时在 store.ts 绑定平台端口。
 */
import type {ConfigStoragePort} from '@/src/platform/storage/configStorage';
import {createConfigAuthority} from './authority';
import {createConfigMutationClient} from './mutationClient';
import type {ConfigHistoryRuntime} from './historyRuntime';
import {CONFIG_HISTORY_SCHEMA_VERSION, type ConfigHistoryState} from './history';

export type ConfigHydrationStatus = 'loading' | 'ready' | 'blocked';

function createNoopConfigHistoryRuntime(): ConfigHistoryRuntime {
    const empty: ConfigHistoryState = {
        schemaVersion: CONFIG_HISTORY_SCHEMA_VERSION,
        entries: [],
        cursor: -1,
        nextVersion: 1,
    };
    return {
        ready: Promise.resolve(),
        getSnapshot: () => empty,
        subscribe: () => () => {},
        schedule: () => {},
        flush: async () => {},
        flushSnapshot: async () => {},
        applyAction: async () => empty,
    };
}

export function createConfigApplication(ports: {storage: ConfigStoragePort; trustedContext: boolean}) {
    const history = createNoopConfigHistoryRuntime();
    const authority = createConfigAuthority({...ports, client: () => client, history: () => history});
    const client = createConfigMutationClient({authority: authority.clientPort, applyHistoryAction: history.applyAction});
    const getConfigHydrationStatus = (): ConfigHydrationStatus => authority.clientPort.writesBlocked
        ? 'blocked' : authority.clientPort.initialized ? 'ready' : 'loading';
    return {
        getConfigHydrationStatus,
        config: authority.config, configReady: authority.configReady, start: authority.start,
        subscribeConfig: authority.subscribeConfig, getConfigRevision: authority.getConfigRevision,
        prepareHydratedConfigForExport: authority.prepareHydratedConfigForExport,
        prepareConfigSaveRequest: authority.prepareConfigSaveRequest, prepareConfigPatchRequest: authority.prepareConfigPatchRequest,
        saveConfig: authority.saveConfig, incrementConfigCount: authority.incrementConfigCount,
        waitForConfigPersistenceQueue: authority.waitForConfigPersistenceQueue,
        configHistoryReady: history.ready, getConfigHistorySnapshot: history.getSnapshot,
        subscribeConfigHistory: history.subscribe, flushConfigHistory: history.flush, applyConfigHistoryAction: history.applyAction,
        requestConfigSave: client.requestConfigSave, requestConfigPatch: client.requestConfigPatch,
        requestConfigCountIncrement: client.requestConfigCountIncrement, requestConfigHistoryAction: client.requestConfigHistoryAction,
        handoffPendingConfigPatches: client.handoffPendingConfigPatches,
    };
}
export type ConfigApplication = ReturnType<typeof createConfigApplication>;
