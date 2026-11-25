import {defineConfig, type ConfigEnv, type UserManifest} from 'wxt';
import vue from '@vitejs/plugin-vue';
import {resolve} from 'path';
import fs from 'fs';
import {checkExtensionSize} from './scripts/testing/extension-size-budget';
import {createExtensionMetadataLocaleFiles} from './src/core/i18n/bundles';
import {extensionCspBuildPlugin} from './scripts/testing/extension-csp-build';
import {defuddleEntityBuildPlugin} from './scripts/testing/defuddle-entity-build';
import {francRuntimeBuildPlugin} from './scripts/testing/franc-runtime-build';
import type {InlineConfig} from 'vite';

const packageJson = JSON.parse(fs.readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

/**
 * Chromium 重载扩展会更换动态资源 UUID，旧页面保存的 CSS/图标地址因此失效。
 * WXT 在生成清单时才追加 Shadow UI CSS，故在 manifestGenerated 阶段
 * 仅将这几项已公开的界面资源改为稳定地址。
 */
export function configureStableContentUiResources(
    env: Pick<ConfigEnv, 'browser' | 'manifestVersion'>,
    manifest: Pick<UserManifest, 'web_accessible_resources'>,
): void {
    if (env.manifestVersion !== 3 || !['chrome', 'edge'].includes(env.browser)) return;
    const rules = manifest.web_accessible_resources;
    if (!rules || rules.some(rule => typeof rule === 'string')) return;
    const stableResources = new Set([
        'icon/32.png', 'icon/48.png', 'icon/128.png',
        'content-scripts/content.css',
        'content-scripts/neteaseMailFrame.css',
    ]);
    manifest.web_accessible_resources = rules.flatMap(rule => {
        if (typeof rule === 'string') return [];
        const stable = rule.resources.filter(resource => stableResources.has(resource));
        if (stable.length === 0) return [rule];
        const remaining = rule.resources.filter(resource => !stableResources.has(resource));
        return [
            {...rule, resources: stable, use_dynamic_url: false},
            ...(remaining.length ? [{...rule, resources: remaining}] : []),
        ];
    });
}

function escapeExtensionNoncharacters() {
    const escapeActualNoncharacters = (code: string) => code.replace(/[\uFFFE\uFFFF]/g, (character) => {
        const codePoint = character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
        return `\\u${codePoint}`;
    });

    return {
        name: 'escape-extension-noncharacters',
        generateBundle(_options: unknown, bundle: Record<string, {type: string; code?: string}>) {
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== 'chunk' || chunk.code === undefined) continue;
                const escaped = escapeActualNoncharacters(chunk.code);
                if (escaped !== chunk.code) chunk.code = escaped;
            }
        },
    };
}

export function remoteConfigStorageBuildPlugin() {
    const runtimeModule = /\/src\/platform\/storage\/configStorageRuntime(?:\.ts)?$/u;
    const remoteRuntime = resolve(__dirname, 'src/platform/storage/remoteConfigStorageRuntime.ts');
    return {
        name: 'fluentread-remote-config-storage',
        enforce: 'pre' as const,
        resolveId(source: string) {
            return runtimeModule.test(source) ? remoteRuntime : null;
        },
    };
}

export function extendRemoteConfigBuildConfig(
    entrypoints: readonly {type: string}[],
    viteConfig: {plugins?: unknown[]},
): void {
    const remoteOnlyTypes = new Set(['content-script', 'popup', 'options', 'unlisted-page']);
    if (entrypoints.length === 0 || !entrypoints.every((entrypoint) => remoteOnlyTypes.has(entrypoint.type))) return;
    viteConfig.plugins = [...(viteConfig.plugins ?? []), remoteConfigStorageBuildPlugin()];
}

export function configureExtensionUiChunks(entrypoints: readonly {type: string}[], config: InlineConfig): void {
    const pages = new Set(['popup', 'options', 'unlisted-page']);
    if (entrypoints.length === 0 || !entrypoints.every(entrypoint => pages.has(entrypoint.type)) || config.build?.lib) return;
    const build = config.build ??= {};
    const rolldown = build.rolldownOptions ??= {};
    const output = rolldown.output ??= {};
    for (const target of Array.isArray(output) ? output : [output]) {
        if (target.codeSplitting !== undefined || target.manualChunks !== undefined) continue;
        target.codeSplitting = {groups: [
            {name: 'vue-runtime', test: /[\\/]node_modules[\\/](?:@vue[\\/](?:reactivity|runtime-core|runtime-dom|shared)|vue)[\\/]/u},
            {name: 'domain-parser', test: /[\\/]node_modules[\\/](?:tldts|tldts-core)[\\/]/u},
        ]};
    }
}

/** 生成 Chrome / Edge 自用精简版扩展清单（固定简体中文，仅保留 5 个翻译服务与核心功能）。 */
export function createExtensionManifest(
    env: Pick<ConfigEnv, 'browser' | 'manifestVersion'>,
): UserManifest {
    return {
        name: '__MSG_extensionName__',
        description: '__MSG_extensionDescription__',
        default_locale: 'zh_CN',
        permissions: [
            ...(env.manifestVersion === 3 ? ['scripting'] : []),
            'storage',
            'unlimitedStorage',
            'alarms',
            'contextMenus',
            'declarativeNetRequestWithHostAccess',
        ],
        content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self';",
        },
        host_permissions: [
            '<all_urls>',
            'https://translate.google.com/*',
            'https://translate.google.co.uk/*',
            'https://translate.googleapis.com/*',
            'https://dev.microsofttranslator.com/*',
            'http://localhost/*',
            'http://127.0.0.1/*',
            'http://*/*',
            'https://*/*',
        ],
        web_accessible_resources: [
            {
                resources: ['popup.html'],
                matches: ['<all_urls>'],
            },
            {
                resources: ['icon/32.png', 'icon/48.png', 'icon/128.png'],
                matches: ['<all_urls>'],
                use_dynamic_url: true,
            },
        ],
    } as UserManifest;
}

export default defineConfig({
    modules: ['@wxt-dev/webextension-polyfill'],
    webExt: {
        disabled: process.env.FLUENTREAD_DISABLE_BROWSER_RUNNER === '1',
    },
    imports: {
        addons: {
            vueTemplate: true,
        },
    },
    vite: (env) => {
        const isProductionBuild = env.command === 'build' && env.mode === 'production';
        const browserTargets: Readonly<Record<string, string>> = {chrome: 'chrome87', edge: 'edge88'};
        return {
            plugins: [
                extensionCspBuildPlugin(),
                defuddleEntityBuildPlugin(),
                francRuntimeBuildPlugin(),
                vue(),
                escapeExtensionNoncharacters(),
            ],
            build: {
                reportCompressedSize: false,
                target: browserTargets[env.browser] ?? ['es2020', 'edge88', 'chrome87'],
                ...(isProductionBuild ? {rolldownOptions: {output: {minify: {mangle: true, compress: {dropConsole: true, dropDebugger: true}}}}} : {}),
                ...(env.command === 'serve' ? {sourcemap: process.env.FLUENTREAD_DEV_SOURCEMAPS === '1' ? 'inline' as const : false} : {}),
            },
            define: {
                'process.env.VUE_APP_VERSION': JSON.stringify(packageJson.version),
            },
        };
    },
    manifest: createExtensionManifest,
    zip: {
        name: 'fluentread-lite',
        compressionLevel: 9,
    },
    hooks: {
        'build:manifestGenerated': (wxt, manifest) => {
            configureStableContentUiResources(wxt.config, manifest);
        },
        'build:done': async (wxt) => {
            const dev = wxt.config.command === 'serve';
            const budget = dev ? (process.env.FLUENTREAD_DEV_SOURCEMAPS === '1' ? 60_000_000 : 28_000_000) : 22_000_000;
            await checkExtensionSize(wxt.config.outDir, budget);
        },
        'vite:build:extendConfig': (entrypoints, viteConfig) => {
            extendRemoteConfigBuildConfig(entrypoints, viteConfig as {plugins?: unknown[]});
            configureExtensionUiChunks(entrypoints, viteConfig);
            if (entrypoints.every(entrypoint => entrypoint.type === 'unlisted-script')) {
                viteConfig.build = {...viteConfig.build, modulePreload: false};
            }
        },
        'build:publicAssets': (_wxt, files) => {
            files.push(...createExtensionMetadataLocaleFiles());
            files.push({absoluteSrc: resolve(__dirname, 'node_modules/@noble/hashes/LICENSE'), relativeDest: 'third-party-notices/noble-hashes-MIT.txt'});
        },
    },
});
