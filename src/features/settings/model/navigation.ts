/**
 * @file src/features/settings/model/navigation.ts
 * 文件职责：定义精简版设置中心侧边栏的导航信息模型，并提供默认分区、哈希解析与搜索过滤规则。
 * 主要内容：保留通用设置、翻译服务、翻译设置、界面风格、网站规则与高级选项 6 个分区；已彻底移除视频字幕翻译、备份与恢复、按功能分配服务入口、菜单栏布局自定义、设置历史与多语言切换搜索。
 * 模块边界：只描述导航元数据，不切换 DOM、不写 location.hash 也不保存配置。
 */
export type NavigationItem = {
  id: string
  icon: string
  label: string
  description: string
  group: string
  heading: string
  summary: string
  kicker: string
  title: string
  detail: string
  searchDescription: string
}

export type NavigationGroup = {
  label: string
  items: readonly NavigationItem[]
}

export type SettingsSearchTarget = {
  id: string
  sectionId: string
  targetId: string
  label: string
  description: string
  searchTerms: string
}

export const settingsSearchTargets: readonly SettingsSearchTarget[] = [
  {id: 'privacy-protection', sectionId: 'settings-advanced', targetId: 'privacy-protection-settings',
    label: '翻译隐私防护', description: '高级选项', searchTerms: '脱敏 隐私 安全 敏感信息 邮箱 电话 身份证 密钥 隐私防护 privacy redaction PII'},
  {
    id: 'floating-ball-toggle', sectionId: 'settings-general', targetId: 'floating-ball-toggle',
    label: '全文翻译悬浮球', description: '通用设置', searchTerms: '悬浮球、显示悬浮球、开启悬浮球',
  },
  {
    id: 'floating-ball-settings', sectionId: 'settings-translation', targetId: 'floating-ball-settings',
    label: '悬浮球进阶设置', description: '翻译设置', searchTerms: '悬浮球配置、悬浮球设置、悬浮球位置',
  },
  {
    id: 'translation-sentence-highlight', sectionId: 'settings-translation', targetId: 'translation-sentence-highlight',
    label: '双语逐句高亮', description: '翻译设置', searchTerms: '阅读辅助、原文译文、句子对应',
  },
  {
    id: 'translation-sentence-highlight-style', sectionId: 'settings-interface', targetId: 'translation-sentence-highlight-style',
    label: '逐句高亮样式', description: '界面风格', searchTerms: '阅读辅助、高亮颜色、柔光粉、薄荷清风、晴空蓝、雾紫柔光、石墨轻衬',
  },
  {
    id: 'translation-appearance', sectionId: 'settings-interface', targetId: 'translation-appearance-panel',
    label: '译文外观', description: '界面风格', searchTerms: '译文颜色、线条颜色、标记底色、译文字号、译文字重、译文字体、译文不透明度',
  },
]

export const navigationGroups = [
  {
    label: '基础配置',
    items: [
      {
        id: 'settings-general', icon: '⌂', label: '通用设置', description: '日常翻译、网页辅助与主题偏好', group: '基础配置',
        heading: '通用设置', summary: '设置默认翻译服务、目标语言、显示模式和网页阅读偏好',
        kicker: '基础配置', title: '通用设置', detail: '设置默认翻译服务、目标语言、显示模式和网页阅读偏好',
        searchDescription: '日常翻译、选择翻译服务、默认服务、配置服务、译文显示、译文外观、翻译模式、网页辅助、AI 智能上下文、默认目标语言、基本偏好、插件状态、主题',
      },
      {
        id: 'settings-services', icon: '译', label: '翻译服务', description: '微软、谷歌、DeepSeek、OpenRouter 与自定义', group: '基础配置',
        heading: '配置翻译服务与模型', summary: '选择翻译服务，配置所需的模型、连接地址和凭据',
        kicker: '基础配置', title: '翻译服务', detail: '配置可用的翻译服务、模型、连接和凭据',
        searchDescription: '机器翻译、微软、谷歌、DeepSeek、OpenRouter、自定义接口、模型与令牌',
      },
      {
        id: 'settings-translation', icon: '译', label: '翻译设置', description: '阅读辅助、全文、悬浮球与排除语言', group: '基础配置',
        heading: '翻译设置', summary: '设置双语阅读辅助、全文翻译触发方式、右键菜单、悬浮球与不翻译语言',
        kicker: '基础配置', title: '翻译设置', detail: '设置双语阅读辅助、全文翻译与悬浮球偏好',
        searchDescription: '阅读辅助、双语逐句高亮、不翻译的语言、跳过语言、排除语言、全文翻译、AI 多段翻译、自定义快捷键、右键菜单、悬浮球、翻译进度',
      },
      {
        id: 'settings-interface', icon: '▦', label: '界面风格', description: '译文样式、弹窗风格、动画与字体', group: '基础配置',
        heading: '界面风格', summary: '调整译文样式、逐句高亮、弹窗皮肤、加载动画与界面字体',
        kicker: '基础配置', title: '界面风格', detail: '调整译文样式、弹窗风格、动画与界面字体',
        searchDescription: '译文样式、双语样式、加粗显示、优雅斜体、模糊遮罩、学习标记、逐句高亮样式、界面动画、翻译加载样式、弹窗风格、界面字体',
      },
    ],
  },
  {
    label: '规则与系统',
    items: [
      {
        id: 'settings-sites', icon: '站', label: '网站规则', description: '网站偏好、正文适配与生效预览', group: '规则与系统',
        heading: '网站规则', summary: '按网站调整翻译与显示偏好，扩展正文适配，并检查规则为何生效',
        kicker: '规则与系统', title: '网站规则', detail: '网站偏好按主域名生效，正文适配可指定路径和内容区域',
        searchDescription: '网站、域名、主域名、自动翻译、始终翻译、禁用扩展、网站适配、隐藏悬浮球、生效预览、自定义规则、正文、保护区域',
      },
      {
        id: 'settings-advanced', icon: '◇', label: '高级选项', description: '隐私、识别、请求限流与缓存', group: '规则与系统',
        heading: '高级选项', summary: '管理隐私防护、页面识别、缓存、并发、限流和重试等运行策略',
        kicker: '规则与系统', title: '高级选项', detail: '调整页面识别、缓存、并发、限流和重试',
        searchDescription: '隐私、脱敏、页面识别、全部节点、缓存、缓存容量、清空缓存、并发、限流、重试、AI 请求、超时、timeout',
      },
    ],
  },
] as const satisfies readonly NavigationGroup[]

export type NavigationSectionId = (typeof navigationGroups)[number]['items'][number]['id']
export const navigationItems = navigationGroups.flatMap<NavigationItem>((group) => group.items)
export const NAVIGATION_SECTION_IDS = navigationGroups.flatMap<NavigationSectionId>((group) => group.items.map(item => item.id))

export const SETTINGS_TABBED_SECTION_IDS: ReadonlySet<string> = new Set()

export const NAVIGATION_SECTION_ALIASES: ReadonlyMap<string, string> = new Map([
  ['settings-webpage', 'settings-translation'],
  ['settings-shortcuts', 'settings-translation'],
])

export const DEFAULT_NAVIGATION_SECTION = navigationItems[0].id

export function resolveNavigationItem(sectionId: string): NavigationItem {
  const resolvedSection = NAVIGATION_SECTION_ALIASES.get(sectionId) ?? sectionId
  return navigationItems.find((item) => item.id === resolvedSection) ?? navigationItems[0]
}

export function resolveRequestedSection(hash: string): string {
  const requestedSection = hash.startsWith('#') ? hash.slice(1) : hash
  const resolvedSection = NAVIGATION_SECTION_ALIASES.get(requestedSection) ?? requestedSection
  return navigationItems.some((item) => item.id === resolvedSection)
    ? resolvedSection
    : DEFAULT_NAVIGATION_SECTION
}

export function filterNavigationItems(query: string, items: readonly NavigationItem[] = navigationItems): NavigationItem[] {
  const keyword = query.trim().toLocaleLowerCase()
  if (!keyword) return []
  return items.filter(item => `${item.label}${item.description}${item.heading}${item.summary}${item.searchDescription}`.toLocaleLowerCase().includes(keyword))
}

export function filterSettingsSearchTargets(query: string, items: readonly SettingsSearchTarget[] = settingsSearchTargets): SettingsSearchTarget[] {
  const keyword = query.trim().toLocaleLowerCase()
  if (!keyword) return []
  return items.filter(item => `${item.label}${item.description}${item.searchTerms}`.toLocaleLowerCase().includes(keyword))
}

export type SettingsPagePanel = {
  id: string
  labelKey: string
  searchTerms: string
  targetIds: readonly string[]
}
export const settingsPagePanels: Readonly<Record<string, readonly SettingsPagePanel[]>> = {
  'settings-services': [
    {id: 'connections', labelKey: 'featureServices.connections', searchTerms: '连接 服务 密钥 API 模型', targetIds: []},
  ],
  'settings-translation': [
    {id: 'reading', labelKey: 'options.panel.reading', searchTerms: '阅读辅助 双语逐句高亮 原文译文 句子对应', targetIds: ['translation-sentence-highlight']},
    {id: 'page', labelKey: 'options.panel.page', searchTerms: '全文 快捷键 多段 范围', targetIds: []},
    {id: 'context-menu', labelKey: 'contextMenuSettings.title', searchTerms: '右键 菜单 全文 网站开关', targetIds: ['context-menu-settings']},
    {id: 'floating-ball', labelKey: 'options.panel.floatingBall', searchTerms: '悬浮球 进阶设置 按钮 位置 延迟', targetIds: ['floating-ball-settings']},
    {id: 'excluded-languages', labelKey: 'settings.excludedLanguages.title', searchTerms: '不翻译的语言 跳过语言 排除语言', targetIds: ['excluded-language-settings']},
  ],
  'settings-interface': [
    {id: 'translation', labelKey: 'options.panel.translation', searchTerms: '译文 样式 颜色 字号 高亮', targetIds: ['translation-appearance-panel', 'translation-sentence-highlight-style']},
    {id: 'skin', labelKey: 'options.panel.skin', searchTerms: '弹窗 皮肤 界面风格', targetIds: []},
    {id: 'motion', labelKey: 'options.panel.motion', searchTerms: '动画 加载', targetIds: []},
    {id: 'font', labelKey: 'options.panel.font', searchTerms: '字体 font Inter Noto Sans Roboto Manrope WenKai', targetIds: []},
  ],
  'settings-sites': [
    {id: 'rules', labelKey: 'options.panel.rules', searchTerms: '自动翻译 禁用网站 域名 隐藏悬浮球 网站偏好', targetIds: []},
    {id: 'adaptation', labelKey: 'options.panel.adaptation', searchTerms: '网站适配 JSON 正文 保护区域 自定义规则 可视化编辑 导入 导出', targetIds: []},
    {id: 'preview', labelKey: 'options.panel.sitePreview', searchTerms: '生效预览 网址匹配 检查规则 优先级', targetIds: []},
  ],
  'settings-advanced': [
    {id: 'privacy', labelKey: 'privacy.title', searchTerms: '隐私 脱敏 安全 敏感信息 privacy redaction PII', targetIds: ['privacy-protection-settings']},
    {id: 'recognition', labelKey: 'options.panel.recognition', searchTerms: '页面识别 节点 段落 标题 侧栏 双语上下顺序 原文在上 译文在上', targetIds: []},
    {id: 'requests', labelKey: 'options.panel.requests', searchTerms: '并发 限流 重试 性能 密钥 恢复 退避 AI 请求 超时 timeout 等待 慢模型', targetIds: []},
    {id: 'cache', labelKey: 'options.panel.cache', searchTerms: '缓存 容量 条数 存储 清除', targetIds: []},
  ],
}

export function resolveSettingsPanel(sectionId: string, panelOrTargetId?: string): string {
  const resolvedSection = NAVIGATION_SECTION_ALIASES.get(sectionId) ?? sectionId
  const panels = Object.hasOwn(settingsPagePanels, resolvedSection) ? settingsPagePanels[resolvedSection] : []
  if (sectionId === 'settings-translation' && panelOrTargetId === 'tools') return 'floating-ball'
  return (panels.find(panel => panel.id === panelOrTargetId || panel.targetIds.includes(panelOrTargetId ?? '')) ?? panels[0])?.id ?? ''
}
