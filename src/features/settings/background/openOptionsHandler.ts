/**
 * @file src/features/settings/background/openOptionsHandler.ts
 * 文件职责：处理来自页面通知和扩展 UI 的打开设置请求，在后台校验目标分区并将导航委托给 Options 页面适配器。
 * 主要内容：从设置导航注册表派生允许的分区与锚点，校验保留服务及自定义 OpenAI 服务编辑目标。
 * 模块边界：本文件不直接绑定 browser.runtime、不渲染设置页也不持久化配置。
 */
import {services} from '@/src/core/config/catalog';
import {isCustomOpenAIProviderId} from '@/src/core/config/customOpenAI';
import {NAVIGATION_SECTION_ALIASES, NAVIGATION_SECTION_IDS, settingsSearchTargets, type NavigationSectionId} from '@/src/features/settings/model/navigation';

export const OPEN_OPTIONS_PAGE_MESSAGE_TYPE = 'openOptionsPage' as const;
export const OPTIONS_SECTION_IDS = NAVIGATION_SECTION_IDS;
export type OptionsSectionId = NavigationSectionId;

export interface OpenOptionsPageMessage {
    type: typeof OPEN_OPTIONS_PAGE_MESSAGE_TYPE;
    section?: unknown;
    learningTab?: unknown;
    service?: unknown;
    target?: unknown;
}

export interface OpenOptionsPageResponse {
    success: true;
}

export interface OpenOptionsPageDependencies {
    readonly openDefaultPage: () => Promise<void>;
    readonly openSection: (section: OptionsSectionId, destination?: string, target?: string) => Promise<void>;
}

export interface OpenOptionsPageHandler {
    readonly type: typeof OPEN_OPTIONS_PAGE_MESSAGE_TYPE;
    handle(message: OpenOptionsPageMessage): Promise<OpenOptionsPageResponse>;
}

const OPTIONS_SECTIONS = new Set<string>(OPTIONS_SECTION_IDS);

function parseSection(value: unknown): OptionsSectionId | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new TypeError('无效的设置页面');
    const resolvedSection = NAVIGATION_SECTION_ALIASES.get(value) ?? value;
    if (!OPTIONS_SECTIONS.has(resolvedSection)) throw new TypeError('无效的设置页面');
    return resolvedSection as OptionsSectionId;
}

export function createOpenOptionsPageHandler(
    dependencies: OpenOptionsPageDependencies,
): OpenOptionsPageHandler {
    return {
        type: OPEN_OPTIONS_PAGE_MESSAGE_TYPE,
        async handle(message) {
            const section = parseSection(message.section);
            const service = message.service;
            if (service !== undefined && (section !== 'settings-services' || typeof service !== 'string'
                || !(Object.values(services).some(value => value === service)
                    || isCustomOpenAIProviderId(service)))) throw new TypeError('无效的翻译服务设置');
            const target = message.target;
            if (target !== undefined && (typeof target !== 'string'
                || !settingsSearchTargets.some(item => item.sectionId === section && item.targetId === target))) throw new TypeError('无效的设置目标');
            if (section === undefined) {
                await dependencies.openDefaultPage();
            } else {
                const destination = typeof service === 'string' ? service : undefined;
                if (typeof target === 'string') await dependencies.openSection(section, destination, target);
                else if (typeof destination === 'string') await dependencies.openSection(section, destination);
                else await dependencies.openSection(section);
            }
            return {success: true};
        },
    };
}
