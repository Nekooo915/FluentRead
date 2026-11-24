/**
 * @file src/core/config/catalog.ts
 *
 * 文件职责：维护精简版 FluentRead Lite 的翻译语言、服务与模型领域目录，作为设置、校验与运行时的单一来源。
 * 主要内容：仅保留微软翻译、谷歌翻译、DeepSeek、OpenRouter 与自定义接口（含多个自定义 OpenAI 兼容服务）；提供 services、servicesType、模型列表、默认模型、目标语言中文标签与默认提示词。
 * 模块边界：本文件属于 core 领域层，只定义纯数据规则与解析函数；不访问浏览器存储、不发起网络请求、不挂载 UI。
 */

import {translationLanguageOptions} from '@/src/core/language/catalog';
import {normalizeChineseLanguageCode} from '@/src/core/language/chinese';
import {CUSTOM_OPENAI_RESERVED_MODEL_ID, isCustomOpenAIProviderId} from './customOpenAI';
import {buildTranslationStyleOptions} from './translationAppearance';

export const services = {
    // 机器翻译
    microsoft: 'microsoft',
    google: 'google',
    // 大模型翻译
    deepseek: 'deepseek',
    openrouter: 'openrouter',
    custom: 'custom',
} as const;

export type BuiltinServiceId = typeof services[keyof typeof services];

export const cloudCredentialLabels = {} as const satisfies Record<string, {token: string; secret?: string}>;
export type CloudCredentialLabels = {token: string; secret?: string};

export function getCloudCredentialLabels(_service: string): CloudCredentialLabels {
    return {token: 'API Key'};
}

export const cloudVendorServices = Object.freeze([] as string[]);
export const referenceAiPlatformServices = Object.freeze([] as string[]);

export const servicesType = {
    machine: new Set<string>([
        services.microsoft,
        services.google,
    ]),
    cloudVendor: new Set<string>(),
    AI: new Set<string>([
        services.deepseek,
        services.openrouter,
        services.custom,
    ]),
    aiSdk: new Set<string>([
        services.openrouter,
        services.custom,
    ]),
    useToken: new Set<string>([
        services.deepseek,
        services.openrouter,
        services.custom,
    ]),
    useModel: new Set<string>([
        services.deepseek,
        services.openrouter,
        services.custom,
    ]),
    useSecret: new Set<string>(),
    useRegion: new Set<string>(),
    useProxy: new Set<string>([
        services.deepseek,
        services.openrouter,
    ]),
    isMachine: (service: string) => servicesType.machine.has(service),
    isCloudVendor: (service: string) => servicesType.cloudVendor.has(service),
    isUseSecret: (service: string) => servicesType.useSecret.has(service),
    isUseRegion: (service: string) => servicesType.useRegion.has(service),
    isAI: (service: string) => servicesType.AI.has(service) || isCustomOpenAIProviderId(service),
    isAiSdk: (service: string) => servicesType.aiSdk.has(service) || isCustomOpenAIProviderId(service),
    isUseAIContext: (service: string, _model = '') => servicesType.isAI(service),
    isUseToken: (service: string) => servicesType.useToken.has(service) || isCustomOpenAIProviderId(service),
    isUseProxy: (service: string) => servicesType.useProxy.has(service) || isCustomOpenAIProviderId(service),
    isUseModel: (service: string) => servicesType.useModel.has(service) || isCustomOpenAIProviderId(service),
    isUseCustomBody: (service: string) => servicesType.isAI(service),
    isCustom: (service: string) => isCustomOpenAIProviderId(service),
    isNewApi: (_service: string) => false,
    isYoudao: (_service: string) => false,
    isTencent: (_service: string) => false,
    isAzureOpenai: (_service: string) => false,
};

export const customModelString = CUSTOM_OPENAI_RESERVED_MODEL_ID;

export const cloudRegionOptions: Record<string, ReadonlyArray<{value: string; label: string}>> = {};

export function getDefaultCloudRegion(_service: string): string {
    return '';
}

export function resolveCloudRegion(_service: string, _region?: string): string {
    return '';
}

/** 解析实际发送给 provider 的模型。 */
export function resolveConfiguredModel(selectedModel?: string, customModel?: string): string {
    return selectedModel === customModelString ? customModel || '' : selectedModel || '';
}

export const currentModelIds = {
    openai: 'gpt-5.6-luna',
    claude: 'claude-fable-5',
    claudeSonnet: 'claude-sonnet-5',
    claudeOpus: 'claude-opus-5',
    deepseek: 'deepseek-flash',
    grok: 'grok-4.5',
    moonshot: 'kimi-k3',
} as const;

export const defaultModelIds = {
    [services.deepseek]: currentModelIds.deepseek,
    [services.openrouter]: 'google/gemini-3.5-flash-lite',
    [services.custom]: 'gpt-5.4-mini',
} as const;

export const models = new Map<string, Array<string>>([
    [services.deepseek, [currentModelIds.deepseek, 'deepseek-v4-pro', 'deepseek-v4-flash', customModelString]],
    [services.openrouter, [
        defaultModelIds[services.openrouter],
        'qwen/qwen3.8-flash',
        'google/gemini-4-argon',
        'openai/gpt-6-luna',
        'openai/gpt-6.1-sol',
        'anthropic/claude-haiku-5.5',
        'anthropic/claude-sonnet-5.5',
        'anthropic/claude-opus-5.5',
        'stepfun/step-3.7-flash',
        'google/gemini-3.6-flash',
        'deepseek/deepseek-v4.1-flash',
        'openai/gpt-5.4-mini',
        'openai/gpt-6-astra',
        'x-ai/grok-4.6',
        'openrouter/auto',
        'openai/gpt-5.6-luna',
        'openai/gpt-5.6-sol',
        'anthropic/claude-fable-5',
        'anthropic/claude-opus-5',
        'x-ai/grok-4.5',
        'deepseek/deepseek-v4-pro',
        'moonshotai/kimi-k3',
        'z-ai/glm-5.2',
        customModelString,
    ]],
    [services.custom, [
        defaultModelIds[services.custom],
        currentModelIds.openai,
        'gpt-5.6-sol',
        'gemini-3.6-flash',
        currentModelIds.claude,
        currentModelIds.deepseek,
        'gemma:7b',
        'llama2:7b',
        'mistral:7b',
        customModelString,
    ]],
]);

export function firstConfiguredModel(modelOptions: readonly string[]): string {
    return modelOptions[0] || '';
}

export const defaultModels = new Map<string, string>(
    Array.from(models.entries())
        .map(([service, modelOptions]) => [service, firstConfiguredModel(modelOptions)] as [string, string])
        .filter(([, model]) => Boolean(model)),
);

export const options = {
    on: [
        {value: true, label: '开启'},
        {value: false, label: '已关闭'},
    ],
    autoTranslate: [
        {value: true, label: '开启'},
        {value: false, label: '已关闭'},
    ],
    useCache: [
        {value: true, label: '开启'},
        {value: false, label: '已关闭'},
    ],
    from: [{value: 'auto', label: '自动检测'}, ...translationLanguageOptions],
    deepseekApiType: [
        {value: 'auto', label: '自动（Chat Completion）'},
        {value: 'responses', label: 'Responses API'},
        {value: 'chat', label: 'Chat Completion'},
    ],
    deepseekThinkingMode: [
        {value: 'disabled', label: '关闭（推荐）'},
        {value: 'enabled', label: '开启'},
    ],
    to: translationLanguageOptions,
    services: [
        // 机器翻译
        {value: 'machine', label: '机器翻译', disabled: true},
        {value: services.microsoft, label: '微软翻译'},
        {value: services.google, label: '谷歌翻译'},
        // 大模型翻译
        {value: 'ai', label: 'AI翻译', disabled: true},
        {value: services.deepseek, label: 'DeepSeek', catalogKind: 'provider'},
        {value: services.openrouter, label: 'OpenRouter', catalogKind: 'platform'},
        {value: services.custom, label: '自定义接口', catalogKind: 'platform'},
    ],
    display: [
        {value: 0, label: '仅译文模式'},
        {value: 1, label: '双语对照模式'},
    ],
    styles: buildTranslationStyleOptions(),
    floatingBallHotkeys: [
        {value: 'none', label: '禁用快捷键'},
        {value: 'Alt+T', label: 'Alt+T / Option+T'},
        {value: 'Alt+A', label: 'Alt+A / Option+A'},
        {value: 'Alt+S', label: 'Alt+S / Option+S'},
        {value: 'Alt+D', label: 'Alt+D / Option+D'},
        {value: 'Alt+Q', label: 'Alt+Q / Option+Q'},
        {value: 'Ctrl+Shift+T', label: 'Ctrl+Shift+T / Control+Shift+T'},
        {value: 'Ctrl+Shift+A', label: 'Ctrl+Shift+A / Control+Shift+A'},
        {value: 'F9', label: 'F9'},
        {value: 'F10', label: 'F10'},
        {value: 'F11', label: 'F11'},
        {value: 'F12', label: 'F12'},
        {value: 'custom', label: '自定义快捷键'},
    ],
    theme: [
        {value: 'auto', label: '跟随操作系统'},
        {value: 'light', label: '亮色主题'},
        {value: 'dark', label: '暗色主题'},
    ],
};

export const multilingualTargetLanguageLabels: Readonly<Record<string, string>> = {
    'zh-Hans': '简体中文 / Simplified Chinese',
    'zh-Hant': '繁體中文 / Traditional Chinese',
    en: 'English / 英语',
    ja: '日本語 / Japanese / 日语',
    ko: '한국어 / Korean / 韩语',
    fr: 'Français / French / 法语',
    ru: 'Русский / Russian / 俄语',
    es: 'Español / Spanish / 西班牙语',
    de: 'Deutsch / German / 德语',
    pt: 'Português / Portuguese / 葡萄牙语',
    it: 'Italiano / Italian / 意大利语',
    ar: 'العربية / Arabic / 阿拉伯语',
    hi: 'हिन्दी / Hindi / 印地语',
    bn: 'বাংলা / Bangla / 孟加拉语',
    ur: 'اردو / Urdu / 乌尔都语',
    fa: 'فارسی / Persian / 波斯语',
    he: 'עברית / Hebrew / 希伯来语',
    tr: 'Türkçe / Turkish / 土耳其语',
    vi: 'Tiếng Việt / Vietnamese / 越南语',
    th: 'ไทย / Thai / 泰语',
    id: 'Indonesia / Indonesian / 印度尼西亚语',
    ms: 'Melayu / Malay / 马来语',
    nl: 'Nederlands / Dutch / 荷兰语',
    pl: 'polski / Polish / 波兰语',
    uk: 'українська / Ukrainian / 乌克兰语',
    cs: 'čeština / Czech / 捷克语',
    sk: 'slovenčina / Slovak / 斯洛伐克语',
    da: 'dansk / Danish / 丹麦语',
    sv: 'svenska / Swedish / 瑞典语',
    nb: 'norsk bokmål / Norwegian Bokmål / 书面挪威语',
    fi: 'suomi / Finnish / 芬兰语',
    el: 'Ελληνικά / Greek / 希腊语',
    ro: 'română / Romanian / 罗马尼亚语',
    hu: 'magyar / Hungarian / 匈牙利语',
    bg: 'български / Bulgarian / 保加利亚语',
    hr: 'hrvatski / Croatian / 克罗地亚语',
    sr: 'српски / Serbian / 塞尔维亚语',
    sl: 'slovenščina / Slovenian / 斯洛文尼亚语',
    et: 'eesti / Estonian / 爱沙尼亚语',
    lv: 'latviešu / Latvian / 拉脱维亚语',
    lt: 'lietuvių / Lithuanian / 立陶宛语',
    ta: 'தமிழ் / Tamil / 泰米尔语',
    te: 'తెలుగు / Telugu / 泰卢固语',
    mr: 'मराठी / Marathi / 马拉地语',
    gu: 'ગુજરાતી / Gujarati / 古吉拉特语',
    kn: 'ಕನ್ನಡ / Kannada / 卡纳达语',
    ml: 'മലയാളം / Malayalam / 马拉雅拉姆语',
    pa: 'ਪੰਜਾਬੀ / Punjabi / 旁遮普语',
    ne: 'नेपाली / Nepali / 尼泊尔语',
    si: 'සිංහල / Sinhala / 僧伽罗语',
    sw: 'Kiswahili / Swahili / 斯瓦希里语',
    fil: 'Filipino / Filipino / 菲律宾语',
};

export function getMultilingualTargetLanguageLabel(value: string, fallback = value, _uiLanguage = 'zh-CN'): string {
    const language = normalizeChineseLanguageCode(value);
    return Object.hasOwn(multilingualTargetLanguageLabels, language)
        ? multilingualTargetLanguageLabels[language]
        : fallback;
}

export const LEGACY_DEFAULT_USER_ROLES: readonly string[] = Object.freeze([
    `Translate the following text into {{to}}, If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes:

{{origin}}`,
]);

export const defaultOption = {
    on: true,
    uiLanguage: 'zh-CN' as const,
    from: 'auto',
    to: 'zh-Hans',
    style: 1,
    display: 1,
    hotkey: 'Control',
    service: services.microsoft,
    custom: 'http://localhost:11434/v1/chat/completions',
    system_role: 'You are a professional, authentic machine translation engine.',
    user_role: `Translate the following text into {{to}}. Translate every sentence, clause and phrase in full; no part of the source text may stay in its original language. Keep only code, URLs, and proper nouns that have no established {{to}} form, and keep them inline inside the translated sentence. Return the translation only. NO explanations. NO notes:

{{origin}}`,
    count: 0,
    useCache: true,
    floatingBallHotkey: 'Alt+T',
    inputBoxTranslationTrigger: 'disabled',
    inputBoxTranslationTarget: 'en',
};
