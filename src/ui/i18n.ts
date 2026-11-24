/**
 * @file src/ui/i18n.ts
 *
 * 文件职责：把固定简体中文的 core i18n 翻译函数接入 Vue，并设置扩展页面的中文语言标记与标题。
 * 主要内容：提供 createUiI18nContext、createUiI18nPlugin、useUiI18n 与 localizeServiceOptions；已移除七国语言切换、异步语言包加载与 DOM 文本扫描改写。
 * 模块边界：只负责 Vue 插件注入与基础文档语言/标题设置，不读写浏览器存储。
 */

import {inject, readonly, ref, type App, type InjectionKey, type Plugin} from 'vue';
import {DEFAULT_UI_LANGUAGE, translate, type TranslationParams, type UiLanguage} from '@/src/core/i18n';
import type {UiI18nContext} from './i18n/types';

export type {UiI18nContext} from './i18n/types';

interface LocalizableServiceOption {
    value: string;
    label: string;
    description?: string;
    searchTerms?: string[];
}

interface ServiceProfileSummary {
    id: string;
    name?: string;
    endpoint?: string;
    models?: string[];
    services?: string[];
}

export function localizeServiceOptions<T extends LocalizableServiceOption>(
    options: readonly T[],
    profiles: readonly ServiceProfileSummary[],
    translateLegacy: (value: string) => string,
): Array<T & {searchTerms: string[]}> {
    const profileIndex = options.length > 1 && profiles.length > 1
        ? new Map<string, ServiceProfileSummary>() : undefined;
    let profileCursor = 0;
    return options.map((option) => {
        let profile = profileIndex ? profileIndex.get(option.value) : profiles.find((item) => item.id === option.value);
        while (profileIndex && !profile && profileCursor < profiles.length) {
            const next = profiles[profileCursor++], id = next.id;
            if (!profileIndex.has(id)) profileIndex.set(id, next);
            if (id === option.value) profile = profileIndex.get(id);
        }
        const label = profile?.name || translateLegacy(option.label);
        return {
            ...option,
            label,
            description: profile?.services ? undefined : option.description ? translateLegacy(option.description) : option.description,
            searchTerms: [...(option.searchTerms || []), option.label, label, ...(profile ? [...(profile.endpoint ? [profile.endpoint] : []), ...(profile.models || [])] : [])],
        };
    });
}

export const UI_I18N_KEY: InjectionKey<UiI18nContext> = Symbol('fluentread-ui-i18n');

export function createUiI18nContext(): UiI18nContext {
    const languageState = ref<UiLanguage>(DEFAULT_UI_LANGUAGE);
    const bundleRevisionState = ref(0);
    return {
        language: readonly(languageState),
        bundleRevision: readonly(bundleRevisionState),
        t: (key: string, params?: TranslationParams) => translate(key, DEFAULT_UI_LANGUAGE, params),
        translateLegacy: (value: string) => value,
        setLanguage: async () => true,
        dispose: () => {},
    };
}

export interface UiI18nPluginOptions {
    documentRoot?: Element | null;
    uiRoot?: Element | null;
    documentTitleKey?: string;
}

export function createUiI18nPlugin(options: UiI18nPluginOptions = {}): Plugin {
    return {
        install(app: App) {
            const context = createUiI18nContext();
            app.provide(UI_I18N_KEY, context);
            app.directive('ui-i18n', {});
            const targetDocument = options.documentRoot?.ownerDocument
                ?? (typeof document !== 'undefined' ? document : undefined);
            if (targetDocument) {
                targetDocument.documentElement.lang = DEFAULT_UI_LANGUAGE;
                if (options.documentTitleKey) {
                    targetDocument.title = context.t(options.documentTitleKey);
                }
            }
        },
    };
}

export function useUiI18n(): UiI18nContext {
    return inject(UI_I18N_KEY, () => createUiI18nContext(), true);
}
