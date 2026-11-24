/**
 * @file src/app/background/maintenanceRuntime.ts
 * 文件职责：把浏览器运行时能力接入后台维护任务，统一安装翻译缓存清理与官方站点规则维护。
 * 主要内容：清理退役动态内容脚本，注册后台 24 小时自动缓存过期清理和官方站点适配规则维护；已移除自动设置快照任务。
 * 模块边界：本文件是后台组合层，不实现缓存清理算法或站点规则解析。
 */
import {installTranslationCacheCleanup} from './cacheCleanup';
import {installOfficialSiteRuleMaintenance} from './officialSiteRuleRuntime';
import {
    unregisterRetiredContentScripts,
    type RetiredContentScriptsPort,
} from './retiredContentScripts';

export function installBackgroundMaintenance(): void {
    const scripting = (browser as unknown as {scripting?: RetiredContentScriptsPort}).scripting;
    if (scripting) {
        void unregisterRetiredContentScripts(scripting).catch((error) => {
            console.warn('[FluentRead] 清理退役动态内容脚本失败', error);
        });
    }
    installTranslationCacheCleanup();
    installOfficialSiteRuleMaintenance();
}
