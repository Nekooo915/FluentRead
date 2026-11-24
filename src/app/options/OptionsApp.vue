<!--
 @file src/app/options/OptionsApp.vue
 文件职责：实现扩展 Options 页的顶层布局，组织设置导航、全局搜索结果与分区切换，并把选中分区交给 SettingsSections。
 主要内容：页面名称由 main 辅助技术标签提供，内容直接从统一的紧凑页内导航或表单开始；侧栏展示自定义品牌与多语言宣传语、分组侧栏、窄屏分类选择和全局搜索，语言恢复查询优先展示软件语言入口并定位选择控件；同步 URL hash 深链接与前进后退导航；界面根节点注册在卸载时只释放本页面句柄。
 模块边界：组件负责页面壳、导航状态和主题、界面皮肤根属性同步，不定义具体配置字段、不直接写 browser.storage；具体设置表单由 SettingsSections 及其子组件拥有。
-->
<template>
  <div class="settings-app" :class="{'has-overlay-close': Boolean(props.onClose)}" @click="dismissSearchOutside">
    <aside class="sidebar">
      <div class="brand">
        <img :src="iconUrl" alt="" />
        <div class="brand-copy">
          <strong data-i18n-ignore>{{ t('common.brand') }}</strong>
          <p class="sidebar-tagline" data-testid="brand-tagline" data-i18n-ignore>v{{ version }}</p>
        </div>
      </div>

      <label class="search-box">
        <UiIcon name="search" :size="16" />
        <input
          ref="searchInput"
          v-model.trim="query"
          type="search"
          :placeholder="t('options.search')"
          :aria-label="t('options.search')"
          @keydown.esc="query = ''"
          @keydown.down="focusSearchResult"
        />
      </label>

      <nav ref="navigationElement" :aria-label="t('options.navLabel')">
        <section v-for="(group, index) in localizedNavigationGroups" :key="group.label" class="nav-group">
          <button type="button" class="nav-group-toggle" :aria-expanded="isGroupOpen(index)" :aria-controls="`settings-nav-group-${index}`" @click="toggleGroup(index)">
            <span>{{ group.label }}</span><span class="nav-chevron" :class="{open: isGroupOpen(index)}" aria-hidden="true">›</span>
          </button>
          <div v-show="isGroupOpen(index)" :id="`settings-nav-group-${index}`" class="nav-group-items">
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            :data-section="item.id"
            :class="{ active: activeSection === item.id }"
            :aria-current="activeSection === item.id ? 'page' : undefined"
            @click="selectSection(item.id)"
          >
            <span class="nav-icon"><SettingsNavigationIcon :section="item.id" /></span>
            <strong>{{ item.label }}</strong>
          </button>
          </div>
        </section>
      </nav>
      <select class="mobile-settings-navigation" :value="activeSection" :aria-label="t('options.navLabel')" @change="selectSection(($event.target as HTMLSelectElement).value)">
        <optgroup v-for="group in localizedNavigationGroups" :key="group.label" :label="group.label">
          <option v-for="item in group.items" :key="item.id" :value="item.id">{{ item.label }}</option>
        </optgroup>
      </select>
    </aside>

    <main class="workspace" :aria-label="activeItem.title">
      <header v-show="activePanels.length || hasSectionAnchors || props.onClose" class="topbar">
        <nav v-if="activePanels.length" class="settings-page-tabs settings-subnavigation" :aria-label="t('options.categories')">
          <button v-for="panel in activePanels" :key="panel.id" type="button" :data-settings-category="panel.id" :aria-current="activePanel === panel.id ? 'true' : undefined" @click="selectPanel(panel.id)">{{ t(panel.labelKey) }}</button>
        </nav>
        <SettingsSectionNavigation
          v-else
          ref="sectionNavigationElement"
          :container="settingsContentElement"
          :section-id="activeSection"
          :panels="sectionPanels"
          @availability-change="hasSectionAnchors = $event"
          @navigate="cancelPendingSearchReveal?.()"
        />
        <button v-if="props.onClose" type="button" class="userscript-settings-close" :aria-label="t('common.close')" :title="t('common.close')" @click="props.onClose()">
          <UiIcon name="close" :size="18" />
        </button>
      </header>

      <div v-if="query && filteredResults.length" ref="searchResultsElement" class="search-results" @keydown.esc.stop.prevent="closeSearchResults">
        <button v-for="result in filteredResults" :key="result.id" type="button" @click="selectResult(result)">
          <span><strong>{{ result.label }}</strong><small>{{ result.searchDescription }}</small></span>
          <UiIcon name="arrow-right" :size="14" />
        </button>
      </div>
      <div v-else-if="query" class="search-empty">{{ t('options.searchEmpty', {query}) }}</div>

      <section ref="settingsContentElement" class="settings-card" :class="{ 'services-view': activeSection === 'settings-services' }" :aria-label="activeItem.heading">
        <KeepAlive>
          <SettingsSections
            key="settings"
            :active-section="activeSection"
            :active-panel="activePanels.length ? activePanel : undefined"
            :appearance-root="props.appearanceRoot"
            :query-root="props.queryRoot"
            :settings-hash-prefix="props.settingsHashPrefix"
            :on-navigate-section="selectSection"
          />
        </KeepAlive>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import '@/src/features/settings/ui/components/settings-navigation.css'
import UiIcon from '@/src/ui/components/UiIcon.vue'
import {
  SETTINGS_TABBED_SECTION_IDS,
  settingsPagePanels,
  resolveSettingsPanel,
  filterNavigationItems,
  filterSettingsSearchTargets,
  settingsSearchTargets,
  navigationGroups,
  navigationItems,
  resolveNavigationItem,
  resolveRequestedSection,
} from '@/src/features/settings/model/navigation'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SettingsNavigationIcon from '@/src/features/settings/ui/SettingsNavigationIcon.vue'
import SettingsSectionNavigation from '@/src/features/settings/ui/components/SettingsSectionNavigation.vue'
const SettingsSections = defineAsyncComponent(() => import('@/src/features/settings/ui/SettingsSections.vue'))
import {useUiI18n} from '@/src/ui/i18n'
import {
  config as runtimeConfig,
  configReady,
  subscribeConfig,
} from '@/src/services/config/store'
import {applyInterfaceFont, applyInterfaceSkin, applyInterfaceTheme, registerInterfaceAppearanceRoot} from '@/src/ui/interfaceAppearance'

const props = defineProps<{
  appearanceRoot?: HTMLElement | null
  queryRoot?: ParentNode | null
  settingsHashPrefix?: string
  initialSection?: string
  locationRouting?: 'internal'
  onClose?: () => void
}>()

let disposed = false
const version = process.env.VUE_APP_VERSION
const iconUrl = '/icon/128.png'
const {t, translateLegacy} = useUiI18n()
const query = ref('')
const searchInput = ref<HTMLInputElement>()
const searchResultsElement = ref<HTMLElement>()

function dismissSearchOutside(event: MouseEvent) {
  if (query.value && event.target instanceof Element && !event.target.closest('.search-box, .search-results, .search-empty')) {
    query.value = ''
  }
}

function focusSearchResult(event: KeyboardEvent) {
  const result = searchResultsElement.value?.querySelector('button')
  if (event.isComposing || !result) return
  event.preventDefault()
  result.focus()
}

function closeSearchResults() {
  query.value = ''
  searchInput.value?.focus()
}

function sectionFromHash(hash: string): string {
  if (!props.settingsHashPrefix) return hash.replace(/^#/, '')
  const prefix = `${props.settingsHashPrefix}/`
  return hash.startsWith(prefix) ? hash.slice(prefix.length) : ''
}

function hashForSection(section: string): string {
  return props.settingsHashPrefix ? `${props.settingsHashPrefix}/${section}` : `#${section}`
}

const initialDestination = props.initialSection || sectionFromHash(window.location.hash)
const activeSection = ref(resolveRequestedSection(initialDestination))
const expandedGroups = ref(new Set<number>(navigationGroups.map((_, index) => index)))
function isGroupOpen(index: number): boolean {
  return expandedGroups.value.has(index)
}
function toggleGroup(index: number): void {
  const next = new Set(expandedGroups.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  expandedGroups.value = next
}
const selectedPanels = ref<Record<string, string>>({[activeSection.value]: resolveSettingsPanel(initialDestination)})
const sectionPanels = computed(() => settingsPagePanels[activeSection.value] || [])
const activePanels = computed(() => SETTINGS_TABBED_SECTION_IDS.has(activeSection.value) ? settingsPagePanels[activeSection.value] : [])
const activePanel = computed(() => resolveSettingsPanel(activeSection.value, selectedPanels.value[activeSection.value]))
function selectPanel(id: string): void {
  selectSection(activeSection.value, id)
}
const navigationElement = ref<HTMLElement | null>(null)
const settingsContentElement = ref<HTMLElement | null>(null)
const hasSectionAnchors = ref(false)
const sectionNavigationElement = ref<{cancelPendingAnchor: () => void; highlightAnchor: (id: string) => void} | null>(null)
const mobileNavigationMedia = window.matchMedia('(max-width: 700px)')
const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
function syncInterfaceTheme(theme: string | undefined): void {
  if (disposed) return
  applyInterfaceTheme(theme === 'dark' || ((!theme || theme === 'auto') && systemThemeMedia.matches), props.appearanceRoot)
}
function handleSystemThemeChange(): void {
  syncInterfaceTheme(runtimeConfig.theme)
}
let searchRevealGeneration = 0
let cancelPendingSearchReveal: (() => void) | null = null

const releaseInterfaceAppearanceRoot = props.appearanceRoot ? registerInterfaceAppearanceRoot(props.appearanceRoot) : () => {}

const navigation = navigationItems
const localizedNavigationGroups = computed(() => navigationGroups.map((group) => ({
  ...group,
  label: translateLegacy(group.label),
  items: group.items.map((item) => ({
    ...item,
    label: translateLegacy(item.label),
    description: translateLegacy(item.description),
    heading: translateLegacy(item.heading).replace('FluentRead', t('common.brand')),
    summary: translateLegacy(item.summary),
    kicker: translateLegacy(item.kicker),
    title: translateLegacy(item.title),
    detail: translateLegacy(item.detail),
    searchDescription: item.id === 'settings-interface'
      ? `${translateLegacy(item.searchDescription)} ${t('settings.interface.font.label')} Inter Noto Sans SC Roboto Source Sans 3 IBM Plex Sans Manrope Nunito Sans LXGW WenKai Noto Serif SC`
      : translateLegacy(item.searchDescription),
  })),
})))
const localizedNavigationItems = computed(() => localizedNavigationGroups.value.flatMap((group) => group.items))
const localizedSearchTargets = computed(() => settingsSearchTargets.map((target) => ({
  ...target,
  label: translateLegacy(target.label),
  description: translateLegacy(target.description),
  searchTerms: `${target.label} ${target.searchTerms}`,
})))
const activeItem = computed(() => localizedNavigationItems.value.find((item) => item.id === resolveNavigationItem(activeSection.value).id)
  || localizedNavigationItems.value[0])
const unsubscribeInterfaceConfig = subscribeConfig((nextConfig) => {
  if (disposed) return
  syncInterfaceTheme(nextConfig.theme)
  applyInterfaceSkin(nextConfig.interfaceSkin, props.appearanceRoot)
  applyInterfaceFont(nextConfig.interfaceFont, props.appearanceRoot)
})

void configReady
  .then(() => {
    if (disposed) return
    syncInterfaceTheme(runtimeConfig.theme)
    applyInterfaceSkin(runtimeConfig.interfaceSkin, props.appearanceRoot)
    applyInterfaceFont(runtimeConfig.interfaceFont, props.appearanceRoot)
  })
  .catch(() => {
    if (disposed) return
    syncInterfaceTheme('auto')
    applyInterfaceSkin('default', props.appearanceRoot)
    applyInterfaceFont('system', props.appearanceRoot)
  })

type SearchResult = {id: string; sectionId: string; targetId?: string; panelId?: string; label: string; searchDescription: string}
const filteredResults = computed<SearchResult[]>(() => {
  const searchQuery = query.value
  const keyword = searchQuery ? searchQuery.toLocaleLowerCase() : ''
  return [
    ...Object.entries(settingsPagePanels).flatMap(([sectionId, panels]) => panels
      .filter(panel => searchQuery && `${t(panel.labelKey)} ${panel.searchTerms}`.toLocaleLowerCase().includes(keyword))
      .map(panel => ({id: `${sectionId}/${panel.id}`, sectionId, panelId: panel.id, label: t(panel.labelKey), searchDescription: localizedNavigationItems.value.find(item => item.id === sectionId)?.label ?? ''}))),
    ...filterSettingsSearchTargets(searchQuery, localizedSearchTargets.value).map(target => ({
      id: target.id,
      sectionId: target.sectionId,
      targetId: target.targetId,
      label: target.label,
      searchDescription: target.description,
    })),
    ...filterNavigationItems(searchQuery, localizedNavigationItems.value).map(item => ({
      id: item.id,
      sectionId: item.id,
      label: item.label,
      searchDescription: item.description,
    })),
  ]
})

function selectSection(requestedId: string, panelOrTargetId?: string) {
  if (disposed) return
  const id = resolveRequestedSection(requestedId)
  if (!navigation.some((item) => item.id === id)) return
  sectionNavigationElement.value?.cancelPendingAnchor()
  searchRevealGeneration += 1
  cancelPendingSearchReveal?.()
  selectedPanels.value[id] = resolveSettingsPanel(id, panelOrTargetId)
  expandedGroups.value = new Set([...expandedGroups.value, navigationGroups.findIndex(group => group.items.some(item => item.id === id))])
  activeSection.value = id
  query.value = ''
  if (props.locationRouting !== 'internal') {
    const nextHash = hashForSection(id)
    if (window.location.hash !== nextHash) {
      history.replaceState(null, '', nextHash)
    }
  }
  const generation = searchRevealGeneration
  void nextTick(() => {
    if (!disposed && generation === searchRevealGeneration) settingsContentElement.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  })
  if (panelOrTargetId && !SETTINGS_TABBED_SECTION_IDS.has(id)) {
    void revealSettingsTarget({id, sectionId: id, targetId: settingsPagePanels[id]?.some(panel => panel.id === panelOrTargetId) ? undefined : panelOrTargetId, panelId: selectedPanels.value[id], label: '', searchDescription: ''})
  }
}

async function revealSettingsTarget(result: SearchResult) {
  if (result.targetId || result.panelId) {
    const generation = searchRevealGeneration
    await nextTick()
    if (disposed || generation !== searchRevealGeneration) return
    const content = settingsContentElement.value
    if (!content) return
    let timeoutId: number | undefined
    const stop = () => {
      observer.disconnect()
      sizeObserver.disconnect()
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
        content.removeEventListener(event, stop, true)
      }
      if (cancelPendingSearchReveal === stop) cancelPendingSearchReveal = null
    }
    const revealTarget = () => {
      if (disposed || generation !== searchRevealGeneration || query.value || activeSection.value !== result.sectionId) {
        stop()
        return
      }
      const selector = result.targetId ? `#${result.targetId}` : `[data-settings-panel="${result.panelId}"]`
      const target = Array.from(content.querySelectorAll<HTMLElement>(selector)).find(element => element.getClientRects().length)
      if (!target?.getClientRects().length) return
      if (target.tagName === 'DETAILS' && !target.hasAttribute('open')) target.setAttribute('open', '')
      const targetRect = target.getBoundingClientRect()
      const contentTop = content.getBoundingClientRect().top
      const centerOffset = result.targetId && !target.matches('.settings-section, .settings-page-panel') && targetRect.height < content.clientHeight
        ? (content.clientHeight - targetRect.height) / 2
        : 0
      content.scrollTo({
        top: Math.max(0, content.scrollTop + targetRect.top - contentTop - centerOffset),
        behavior: 'instant',
      })
      if (result.panelId) sectionNavigationElement.value?.highlightAnchor(result.panelId)
      target.querySelector<HTMLElement>('[role="switch"]')?.focus({preventScroll: true})
    }
    const observer = new MutationObserver(revealTarget)
    const sizeObserver = new ResizeObserver(revealTarget)
    observer.observe(content, {subtree: true, childList: true, attributes: true, attributeFilter: ['style']})
    sizeObserver.observe(content.firstElementChild ?? content)
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
      content.addEventListener(event, stop, {capture: true, passive: true})
    }
    cancelPendingSearchReveal = stop
    timeoutId = window.setTimeout(stop, 3000)
    revealTarget()
  }
}

async function selectResult(result: SearchResult) {
  selectSection(result.sectionId, result.targetId || result.panelId)
}

async function revealActiveNavigation() {
  const section = activeSection.value
  await nextTick()
  if (disposed || section !== activeSection.value) return
  navigationElement.value
    ?.querySelector<HTMLElement>(`button[data-section="${activeSection.value}"]`)
    ?.scrollIntoView({
      block: 'nearest',
      inline: mobileNavigationMedia.matches ? 'center' : 'nearest',
    })
}

watch(activeSection, () => {
  void revealActiveNavigation()
})

function handleMobileNavigationChange() {
  void revealActiveNavigation()
}

function syncSectionFromHash() {
  const requested = sectionFromHash(window.location.hash)
  const section = resolveRequestedSection(requested)
  const targetId = new URLSearchParams(window.location.search).get('target')
  const target = localizedSearchTargets.value.find(item => item.sectionId === section && item.targetId === targetId)
  const panel = settingsPagePanels[section]?.find(item => item.id === targetId)
  selectSection(requested, target?.targetId ?? panel?.id)
}

onMounted(() => {
  if (props.locationRouting !== 'internal') {
    syncSectionFromHash()
    window.addEventListener('hashchange', syncSectionFromHash)
  }
  mobileNavigationMedia.addEventListener('change', handleMobileNavigationChange)
  systemThemeMedia.addEventListener('change', handleSystemThemeChange)
  void revealActiveNavigation()
})

onBeforeUnmount(() => {
  disposed = true
  searchRevealGeneration += 1
  releaseInterfaceAppearanceRoot()
  cancelPendingSearchReveal?.()
  unsubscribeInterfaceConfig()
  window.removeEventListener('hashchange', syncSectionFromHash)
  mobileNavigationMedia.removeEventListener('change', handleMobileNavigationChange)
  systemThemeMedia.removeEventListener('change', handleSystemThemeChange)
})
</script>
