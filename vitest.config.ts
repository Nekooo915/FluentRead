import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import {realpathSync} from 'node:fs';
import {searchForWorkspaceRoot} from 'vite';
import vue from '@vitejs/plugin-vue';

const configuredMaxWorkers = Number(process.env.FLUENTREAD_TEST_MAX_WORKERS);
const maxWorkers = Number.isInteger(configuredMaxWorkers) && configuredMaxWorkers > 0 ? configuredMaxWorkers : 2;

/** 测试在 Node 里提供自己的 DOM。保留客户端 SFC 模板，模块加载仍由 Vitest 管理。 */
function clientVue(options: Parameters<typeof vue>[0]) {
    const plugin = vue(options);
    const load = plugin.load;
    const transform = plugin.transform;
    if (load && typeof load !== 'function') {
        plugin.load = {...load, handler(id, context) {
            return load.handler.call(this, id, {...context, ssr: false});
        }};
    }
    if (transform && typeof transform !== 'function') {
        plugin.transform = {...transform, handler(code, id, context) {
            return transform.handler.call(this, code, id, {...context, moduleType: context?.moduleType ?? 'js', ssr: false});
        }};
    }
    return plugin;
}

// 独立的 Vitest 配置（与 wxt 构建配置互不影响）
export default defineConfig({
    server: {fs: {allow: [searchForWorkspaceRoot(__dirname), realpathSync(resolve(__dirname, 'node_modules'))]}},
    plugins: [clientVue({include: [
        /\/src\/(?:features\/settings\/ui\/services\/RequestLimit(?:Settings|Fields)|ui\/components\/(?:CustomHotkeyInput|UiSelect|ServiceIcon|TranslationLoadingPreview|UiIcon|FeatureEnableCard)|features\/settings\/ui\/components\/(?:FieldHelp|InterfaceSkinPreview|SettingsGroup|SettingsItem|TranslationColorField|TranslationStylePreview|SegmentedControl|ToolbarClickSetting|SettingsDisclosure|SettingsNumberInput|SettingsPanel|SettingsPreviewLayout|PopupPreview))\.vue$/,
        resolve(__dirname, 'src/features/settings/ui/services/RequestHeaderSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/services/ServiceCatalog.vue'),
        resolve(__dirname, 'src/features/settings/ui/services/ModelPicker.vue'),
        resolve(__dirname, 'src/features/settings/ui/services/ApiKeyList.vue'),
        resolve(__dirname, 'src/features/settings/ui/services/ServiceNatureBadge.vue'),
        resolve(__dirname, 'src/features/settings/ui/services/PromptTemplateEditor.vue'),
        resolve(__dirname, 'src/features/settings/ui/services/CustomOpenAIProviderDialog.vue'),
        resolve(__dirname, 'src/features/settings/ui/services/ServiceConfiguration.vue'),
        resolve(__dirname, 'src/features/settings/ui/services/ServiceRepairReturn.vue'),
        resolve(__dirname, 'src/features/settings/ui/InterfaceSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/TranslationStyleSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/SiteAdaptationSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/SitePreferencesSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/SiteRulePreview.vue'),
        resolve(__dirname, 'src/features/settings/ui/SettingsSections.vue'),
        resolve(__dirname, 'src/features/settings/ui/PrivacyProtectionSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/ParagraphHandlingSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/AiMultiSegmentSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/ReadingAssistanceSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/ExcludedLanguageSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/SentenceHighlightStyleSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/TranslationCacheSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/FloatingBallSettings.vue'),
        resolve(__dirname, 'src/features/settings/ui/ContextMenuSettings.vue'),
        resolve(__dirname, 'src/app/popup/PopupServices.vue'),
        resolve(__dirname, 'src/app/popup/PopupLanguageSelect.vue'),
        resolve(__dirname, 'src/app/popup/PopupSiteRule.vue'),
        resolve(__dirname, 'src/app/popup/PopupApp.vue'),
        resolve(__dirname, 'src/app/options/OptionsApp.vue'),
        resolve(__dirname, 'src/features/self-help/ui/DiagnosticNotice.vue'),
        resolve(__dirname, 'src/features/floating-ball/ui/FloatingBall.vue'),
    ]})],
    resolve: {
        alias: [
            {find: '@', replacement: resolve(__dirname, '.')},
        ],
    },
    test: {
        environment: 'node',
        server: {deps: {inline: ['@deeplx/core']}},
        include: ['tests/**/*.test.ts'],
        globalSetup: ['./scripts/testing/vitest-resource-lock.mjs'],
        maxWorkers,
        clearMocks: false,
        fileParallelism: false,
        css: {include: [/(?:src\/app\/content\/page|src\/ui\/styles\/(?:translation-display|translation-loading-indicator|bilingual-sentence-highlight))\.css(?:\?|$)/]},
    },
});
