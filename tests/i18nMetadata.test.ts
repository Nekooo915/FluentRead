import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {describe, expect, it} from 'vitest';
import {UI_LANGUAGE_OPTIONS} from '@/src/core/i18n/language';
import {createExtensionMetadataLocaleFiles} from '@/src/core/i18n/bundles';
import productDescriptions from '@/src/core/i18n/messages/product-descriptions.json';
import brandTaglines from '@/src/core/i18n/messages/brand-taglines.json';

const root = resolve(__dirname, '..');
const metadataManifest = {
    manifest_version: 3,
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    action: {default_title: '__MSG_extensionToolbarTitle__'},
};

async function metadataVerifier() {
    return import(/* @vite-ignore */ pathToFileURL(resolve(root, 'scripts/testing/verify-extension-manifests.mjs')).href) as Promise<{
        verifyLocalizedExtensionMetadata(directory: string, manifest: Record<string, unknown>): Promise<string[]>;
    }>;
}

function createMetadataFixture() {
    const directory = mkdtempSync(resolve(tmpdir(), 'fluentread-i18n-metadata-'));
    for (const {relativeDest, contents} of createExtensionMetadataLocaleFiles()) {
        const file = resolve(directory, relativeDest);
        mkdirSync(dirname(file), {recursive: true});
        writeFileSync(file, contents);
    }
    return directory;
}

describe('localized installation and publication descriptions', () => {
    it('uses one seven-language functional catalog with a native manifest length budget', () => {
        expect(Object.keys(productDescriptions).sort()).toEqual(UI_LANGUAGE_OPTIONS.map(({value}) => value).sort());
        for (const [language, description] of Object.entries(productDescriptions)) {
            expect(description).toBe(description.trim());
            expect(description.length).toBeGreaterThan(20);
            expect(description.length).toBeLessThanOrEqual(132);
            expect(description).not.toMatch(/[\r\n]|__MSG_|\{\w+\}/u);
            expect(description).not.toBe(brandTaglines[language as keyof typeof brandTaglines]);
        }
    });

    it('accepts generated locale artifacts and rejects unlocalized manifest fields', async () => {
        const directory = createMetadataFixture();
        try {
            const {verifyLocalizedExtensionMetadata} = await metadataVerifier();
            const expectedLocales = ['en', 'es', 'fr', 'ja', 'ko', 'ru', 'zh_CN'];
            const {action, ...metadataFields} = metadataManifest;
            expect(await verifyLocalizedExtensionMetadata(directory, metadataManifest)).toEqual(expectedLocales);
            expect(await verifyLocalizedExtensionMetadata(directory, {...metadataFields, manifest_version: 2, browser_action: action})).toEqual(expectedLocales);
            await expect(verifyLocalizedExtensionMetadata(directory, {...metadataManifest, description: productDescriptions['en-US']})).rejects.toThrow('浏览器本地化');
            await expect(verifyLocalizedExtensionMetadata(directory, {...metadataManifest, default_locale: 'zh_CN'})).rejects.toThrow('英文默认语言');
            await expect(verifyLocalizedExtensionMetadata(directory, {...metadataManifest, action: {default_title: '__MSG_extensionName__'}})).rejects.toThrow('工具栏提示');
        } finally {rmSync(directory, {recursive: true, force: true});}
    });

    it('rejects missing locales, missing names and tooltips, and outdated descriptions', async () => {
        const directory = createMetadataFixture();
        try {
            const {verifyLocalizedExtensionMetadata} = await metadataVerifier();
            const japaneseFile = resolve(directory, '_locales/ja/messages.json');
            writeFileSync(japaneseFile, JSON.stringify({extensionDescription: {message: productDescriptions['ja-JP']}}));
            await expect(verifyLocalizedExtensionMetadata(directory, metadataManifest)).rejects.toThrow('缺少本地化扩展名称');
            writeFileSync(japaneseFile, JSON.stringify({extensionName: {message: 'FluentRead Lite'}, extensionDescription: {message: 'Old slogan'}}));
            await expect(verifyLocalizedExtensionMetadata(directory, metadataManifest)).rejects.toThrow('扩展说明缺失、漂移');
            writeFileSync(japaneseFile, JSON.stringify({extensionName: {message: 'FluentRead Lite'}, extensionDescription: {message: productDescriptions['ja-JP']}}));
            await expect(verifyLocalizedExtensionMetadata(directory, metadataManifest)).rejects.toThrow('工具栏提示缺失');
            rmSync(resolve(directory, '_locales/ja'), {recursive: true});
            await expect(verifyLocalizedExtensionMetadata(directory, metadataManifest)).rejects.toThrow('语言集合');
        } finally {rmSync(directory, {recursive: true, force: true});}
    });
});
