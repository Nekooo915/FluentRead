/**
 * @file src/app/background/requestHeaderRuntime.ts
 * 文件职责：在扩展后台装配按域名移除请求头的动态规则配置与网络同步屏障。
 * 主要内容：启动及配置变化时同步用户配置的 declarativeNetRequest 规则，每个 provider 的真实 HTTP 请求等待最新名单落地。
 * 模块边界：仅在后台启动时调用；沿用 runtimeFetch 端口，不在 JS 层伪造 forbidden headers。
 */
import {config, configReady, subscribeConfig} from '@/src/services/config/store';
import {createRequestHeaderRulesSynchronizer, type RequestHeaderRulesPort} from '@/src/platform/browser/requestHeaderRules';
import {setRuntimeFetch} from '@/src/platform/http/runtime';

export function installRequestHeaderRuntime(): void {
    const extensionDomain = new URL(browser.runtime.getURL('')).hostname;
    const dnr = browser.declarativeNetRequest as unknown as RequestHeaderRulesPort | undefined;
    const sync = createRequestHeaderRulesSynchronizer(dnr, extensionDomain);
    const refresh = () => sync.sync([...config.requestHeaderRules]);
    void configReady.then(() => {
        subscribeConfig(() => { void refresh().catch(() => console.warn('[FluentRead] 请求头规则更新失败；下次请求将重试。')); });
        return refresh();
    }).catch(() => console.warn('[FluentRead] 请求头规则更新失败；下次请求将重试。'));
    setRuntimeFetch(async (input, init) => {
        await configReady;
        await refresh();
        return globalThis.fetch(input, init);
    });
}
