/**
 * @file src/core/config/serviceAvailability.ts
 * 文件职责：规范化用户关闭的翻译服务，并把关闭状态投影到服务选择项。
 * 主要内容：去重、限制服务标识长度，保留内置与自定义服务的统一开关状态；选择列表保留已关闭项并标为不可选，供设置页恢复或切换。
 * 模块边界：只处理配置值和选项，不读取存储、不修改配置、不判断浏览器能力或发起翻译。
 */

export interface TranslationServiceAvailabilityOption {
  value: string
  disabled?: boolean
}

export const DEFAULT_DISABLED_AI_PLATFORM_SERVICES = [] as const

export const TRANSLATION_SERVICE_DISABLED_MESSAGE = '所选翻译服务已关闭。请在翻译服务设置的「自定义服务」中恢复，或选择其他服务。'

export function normalizeDisabledTranslationServices(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const service = item.trim()
    if (!service || service.length > 128 || seen.has(service)) continue
    seen.add(service)
    result.push(service)
  }
  return result
}

export function isTranslationServiceDisabled(disabledServices: unknown, service: string): boolean {
  return Array.isArray(disabledServices) && disabledServices.some(item => item === service)
}

export function markDisabledTranslationServices<T extends TranslationServiceAvailabilityOption>(
  options: readonly T[],
  disabledServices: unknown,
): Array<T & TranslationServiceAvailabilityOption> {
  const disabled = new Set(normalizeDisabledTranslationServices(disabledServices))
  if (!disabled.size) return [...options] as Array<T & TranslationServiceAvailabilityOption>
  return options.map(option => disabled.has(option.value) && !option.disabled
    ? {...option, disabled: true}
    : option) as Array<T & TranslationServiceAvailabilityOption>
}

export function filterEnabledTranslationServices<T extends TranslationServiceAvailabilityOption>(
  options: readonly T[],
  disabledServices: unknown,
): T[] {
  const disabled = new Set(normalizeDisabledTranslationServices(disabledServices))
  return options.filter(option => !option.disabled && !disabled.has(option.value))
}
