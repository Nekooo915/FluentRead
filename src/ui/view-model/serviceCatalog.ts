/**
 * @file src/ui/view-model/serviceCatalog.ts
 * 文件职责：为精简版服务与模型选择界面提供无框架的视图模型转换，把保留的 5 类翻译服务与用户自定义接口整理成可搜索、可分层和可稳定展示的数据。
 * 主要内容：定义 5 个保留服务的官网入口、分组与搜索转换，并把弹窗选择面板拆成常用区与更多区。
 * 模块边界：这些函数不读取 Vue 状态、不修改 Config，也不发起连接测试；原始目录由 core/config 提供。
 */
import {resolveConfiguredModel, services} from '@/src/core/config/catalog'
import {isCustomOpenAIProviderId} from '@/src/core/config/customOpenAI'

export interface ServiceWebsite {
  url: string
  kind: 'website' | 'documentation'
}

const serviceGuide = 'https://read.thinkstu.com/config/translation-engines'

const serviceWebsites = {
  microsoft: 'https://www.bing.com/translator',
  google: 'https://translate.google.com/',
  deepseek: 'https://platform.deepseek.com/',
  openrouter: 'https://openrouter.ai/',
  custom: serviceGuide,
} satisfies Record<keyof typeof services, string>

export interface ServiceCredentialGuide {
  freeQuota: string
  consoleUrl: string
  consoleLabel: string
  docsUrl: string
  docsLabel: string
  steps: readonly string[]
}

export function getServiceCredentialGuide(_service: string): ServiceCredentialGuide | undefined {
  return undefined
}

export function getServiceWebsite(
  service: string,
  context: { endpoint?: string } = {},
): ServiceWebsite | undefined {
  if (isCustomOpenAIProviderId(service) || service === services.custom) {
    try {
      const endpoint = new URL(context.endpoint || '')
      if (endpoint.protocol === 'https:' || endpoint.protocol === 'http:') {
        return {url: `${endpoint.origin}/`, kind: 'website'}
      }
    } catch {
      // 未配置或无效地址回退到说明入口。
    }
    return {url: serviceGuide, kind: 'documentation'}
  }

  if (!Object.hasOwn(serviceWebsites, service)) return undefined
  return {
    url: serviceWebsites[service as keyof typeof serviceWebsites],
    kind: 'website',
  }
}

export interface ServiceOption {
  value: string
  label: string
  description?: string
  searchTerms?: string[]
  disabled?: boolean
  catalogKind?: string
}

export function serviceDirectorySearchText(item: ServiceOption): string {
  return [item.label, item.value, item.description, ...(item.searchTerms || [])].join(' ').normalize('NFKC').toLocaleLowerCase()
}

export interface ServiceGroup {
  id: string
  label: string
  items: ServiceOption[]
}

export interface ServiceSubgroup extends ServiceGroup {
  itemKind: string
}

export interface ServiceSection {
  id: string
  label: string
  collapsible: boolean
  groups: ServiceSubgroup[]
}

export interface ServiceSearchOption extends ServiceOption {
  matchingModels: string[]
}

export function cleanServiceLabel(label: string) {
  return label.replace(/[⭐️★]+/gu, '').trim()
}

export function buildServiceGroups(options: ServiceOption[]): ServiceGroup[] {
  const groups: ServiceGroup[] = []
  let current: ServiceGroup = {id: 'other', label: '其他服务', items: []}

  for (const option of options) {
    if (option.disabled && (option.value === 'machine' || option.value === 'ai')) {
      if (current.items.length) groups.push(current)
      current = {
        id: option.value,
        label: cleanServiceLabel(option.label),
        items: [],
      }
      continue
    }
    current.items.push({...option, label: cleanServiceLabel(option.label)})
  }

  if (current.items.length) groups.push(current)
  return groups
}

export function buildServiceSections(options: ServiceOption[]): ServiceSection[] {
  return buildServiceGroups(options).map((group) => {
    if (group.id === 'ai') {
      const providers = group.items.filter((item) => item.catalogKind !== 'platform')
      const platforms = group.items.filter((item) => item.catalogKind === 'platform')
      return {
        id: group.id,
        label: group.label,
        collapsible: false,
        groups: [
          {id: 'ai-providers', label: '模型服务商', itemKind: '模型服务商', items: providers},
          {id: 'ai-platforms', label: '聚合平台与接口', itemKind: '聚合平台', items: platforms},
        ].filter((subgroup) => subgroup.items.length > 0),
      }
    }

    return {
      id: group.id,
      label: group.label,
      collapsible: false,
      groups: [{
        id: `${group.id}-services`,
        label: '',
        itemKind: group.id === 'machine' ? '机器翻译' : group.label,
        items: group.items,
      }],
    }
  })
}

function searchTextMatches(value: string, rawKeyword: string, compactKeyword: string) {
  const normalizedValue = value.normalize('NFKC').toLocaleLowerCase()
  if (normalizedValue.includes(rawKeyword)) return true
  if (!compactKeyword) return false
  return normalizedValue.replace(/[\s._/()-]+/gu, '').includes(compactKeyword)
}

export function searchServiceOptions(
  serviceOptions: ServiceOption[],
  query: string,
  modelOptions: ReadonlyMap<string, readonly string[]>,
  selectedModels: Record<string, string> = {},
  activeCustomModels: Record<string, string> = {},
): ServiceSearchOption[] {
  const rawKeyword = query.trim().normalize('NFKC').toLocaleLowerCase()
  if (!rawKeyword) return serviceOptions.map((item) => ({...item, matchingModels: []}))

  const compactKeyword = rawKeyword.replace(/[\s._/()-]+/gu, '')
  return serviceOptions.flatMap((item) => {
    const selectedModel = selectedModels[item.value]
    const configuredModel = resolveConfiguredModel(selectedModel, activeCustomModels[item.value])
    const searchableModels = Array.from(new Set([
      ...(modelOptions.get(item.value) || []),
      selectedModel,
      configuredModel,
    ].filter((model): model is string => Boolean(model))))
    const matchingModels = searchableModels.filter((model) => searchTextMatches(model, rawKeyword, compactKeyword))
    const serviceMatches = searchTextMatches(
      `${item.label} ${item.value} ${item.description || ''} ${item.searchTerms?.join(' ') || ''}`,
      rawKeyword,
      compactKeyword,
    )

    return serviceMatches || matchingModels.length > 0
      ? [{...item, matchingModels}]
      : []
  })
}

export const COMMON_SERVICE_LIMIT = 8

const keylessCommonServices: readonly string[] = [services.microsoft, services.google]
const popularFallbackServices: readonly string[] = [services.deepseek, services.openrouter, services.custom]

export function splitServiceChoices<T extends ServiceOption>(
  options: readonly T[],
  context: { configured: ReadonlySet<string>; needsSetup?: ReadonlySet<string>; selected?: string; limit?: number },
): { common: T[]; more: T[] } {
  const limit = context.limit ?? COMMON_SERVICE_LIMIT
  const byValue = new Map(options.map((option) => [option.value, option]))
  const common = new Map<string, T>()
  const add = (value: string | undefined) => {
    const option = value ? byValue.get(value) : undefined
    if (option && (value === context.selected || !context.needsSetup?.has(option.value))) common.set(option.value, option)
  }

  for (const option of options) if (context.configured.has(option.value)) add(option.value)
  keylessCommonServices.forEach(add)
  add(context.selected)
  for (const value of popularFallbackServices) {
    if (common.size >= limit) break
    add(value)
  }

  return {
    common: [...common.values()],
    more: options.filter((option) => !common.has(option.value)),
  }
}
