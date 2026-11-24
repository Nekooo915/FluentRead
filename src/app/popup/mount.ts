/**
 * @file src/app/popup/mount.ts
 * 文件职责：在轻量启动入口唤醒后台后，等待配置和字体就绪并创建精简版 Popup Vue 应用。
 * 主要内容：固定简体中文直接加载 PopupApp，无需首启语言引导页或异步多语言资源包，页面退出后停止挂载并释放容器标记。
 * 模块边界：不读取网页内容、不保存配置；业务交互由 PopupApp 完成。
 */
import {createApp} from 'vue';
import browser from 'webextension-polyfill';
import {createUiI18nPlugin} from '@/src/ui/i18n';
import {config, configReady, getConfigHydrationStatus} from '@/src/services/config/store';
import {prepareInterfaceFont} from '@/src/ui/interfaceAppearance';

export async function mountPreparedPopupApp(selector: string): Promise<void> {
  const target = typeof window === 'undefined' ? undefined : window;
  const root = document.documentElement;
  let exited = false;
  let mounted = false;
  let disposed = false;
  let persistedHidden = false;
  let tabHosted = false;
  let ownsTabWidth = false;

  const releaseLayoutMarkers = () => {
    if (ownsTabWidth && root.getAttribute('data-fluentread-tab-popup') === '') root.removeAttribute('data-fluentread-tab-popup');
    ownsTabWidth = false;
  };
  const releaseContainer = () => {
    exited = true;
    disposed = true;
    target?.removeEventListener('pagehide', onPageHide);
    target?.removeEventListener('pageshow', onPageShow);
    releaseLayoutMarkers();
  };
  const onPageHide = (event: PageTransitionEvent) => {
    if (event.persisted && mounted && !disposed) {
      persistedHidden = true;
      releaseLayoutMarkers();
    } else releaseContainer();
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted || !persistedHidden || disposed || !mounted) return;
    persistedHidden = false;
    applyLayoutMarkers();
  };
  target?.addEventListener('pagehide', onPageHide);
  target?.addEventListener('pageshow', onPageShow);

  function applyLayoutMarkers() {
    if (disposed || persistedHidden) return;
    if (tabHosted && !root.hasAttribute('data-fluentread-tab-popup')) {
      root.setAttribute('data-fluentread-tab-popup', '');
      ownsTabWidth = true;
    }
  }
  applyLayoutMarkers();
  void (async () => {
    try {
      const tab = await browser.tabs.getCurrent();
      if (disposed) return;
      const id = tab?.id;
      tabHosted = typeof id === 'number' && Number.isSafeInteger(id) && id >= 0;
      if (tabHosted) applyLayoutMarkers();
    } catch {
      // 沿用工具栏固有尺寸。
    }
  })();

  try {
    await configReady;
    if (exited) return;
    if (getConfigHydrationStatus() !== 'ready') throw new Error('Popup configuration is not ready');
    let preparedFont: typeof config.interfaceFont | undefined;
    let AppModule: typeof import('./PopupApp.vue');
    do {
      const font = config.interfaceFont;
      const [loaded] = await Promise.all([
        import('./PopupApp.vue'),
        font === preparedFont ? undefined : prepareInterfaceFont(font),
      ]);
      if (exited) return;
      if (getConfigHydrationStatus() !== 'ready') throw new Error('Popup configuration is not ready');
      AppModule = loaded;
      preparedFont = font;
    } while (preparedFont !== config.interfaceFont);
    const app = createApp(AppModule.default);
    app.use(createUiI18nPlugin({documentRoot: document.body, documentTitleKey: 'metadata.popupTitle'}));
    app.onUnmount(releaseContainer);
    app.mount(selector);
    mounted = true;
  } finally {
    if (!mounted) releaseContainer();
  }
}
