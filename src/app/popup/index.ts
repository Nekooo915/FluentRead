/**
 * @file src/app/popup/index.ts
 * 文件职责：连接 Popup HTML 的无框架预唤醒与配置就绪后的应用组装入口。
 * 主要内容：加载尺寸和皮肤样式，提前预取 PopupApp；页内 iframe 先完成授权，再动态载入配置与挂载模块。
 * 模块边界：只负责启动与预取，不直接读写配置或承载菜单业务。
 */
import './popup.css';
import {createPopupStartupFeedback} from './startupFeedback';
import 'element-plus/es/components/base/style/css';
import 'element-plus/es/components/tooltip/style/css';
import '@/src/ui/styles/interface-skins.css';
import {isEmbeddedPopup, isPopupSurfaceActive, observeEmbeddedPopupSize, preparePopupSurface} from './embedded';

type PopupRuntime = {
  sendMessage(message: unknown, callback?: (response: unknown) => void): Promise<unknown> | void;
  lastError?: unknown;
};

function wakePopupWorker(): void {
  const globals = globalThis as typeof globalThis & {
    browser?: {runtime?: PopupRuntime};
    chrome?: {runtime?: PopupRuntime};
    __fluentReadPopupWarmup?: Promise<unknown>;
  };
  const message = {type: 'popupStartup'};
  void import('./PopupApp.vue').catch(() => {});
  try {
    if (globals.__fluentReadPopupWarmup) {
      void globals.__fluentReadPopupWarmup.catch(() => {});
    } else if (globals.browser?.runtime) {
      void Promise.resolve(globals.browser.runtime.sendMessage(message)).catch(() => {});
    } else if (globals.chrome?.runtime) {
      const runtime = globals.chrome.runtime;
      runtime.sendMessage(message, () => { void runtime.lastError; });
    }
  } catch {
    // 预唤醒失败不阻断挂载。
  }
}

export async function mountPopupApp(selector: string): Promise<void> {
  if (!await preparePopupSurface() || !isPopupSurfaceActive()) return;
  wakePopupWorker();
  const feedback = createPopupStartupFeedback(selector);
  try {
    const {mountPreparedPopupApp} = await import('./mount');
    if (!isPopupSurfaceActive()) {feedback.dispose(); return;}
    await mountPreparedPopupApp(selector);
    feedback.dispose();
    if (isEmbeddedPopup()) observeEmbeddedPopupSize();
  } catch {feedback.fail();}
}
