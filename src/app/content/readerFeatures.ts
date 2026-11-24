/**
 * @file src/app/content/readerFeatures.ts
 * 文件职责：为内容脚本组装阅读翻译界面的静态功能定义。
 * 主要内容：接入悬浮球与翻译进度面板的配置判定和公开挂载端口。
 * 模块边界：仅声明注册表输入；启停和挂载所有权由注册表负责，界面与翻译行为仍由各自功能实现。
 */
import type {ContentScriptContext} from 'wxt/utils/content-script-context';
import type {Config} from '@/src/core/config/model';
import type {ContentFeatureDefinition} from './featureRegistry';
import {
    isFloatingBallAllowedOnPage,
    mountFloatingBall,
    mountTranslationProgressPanel,
    unmountFloatingBall,
    unmountTranslationProgressPanel,
} from './features';

export function createReaderContentFeatures(ctx: ContentScriptContext, config: Config): ContentFeatureDefinition[] {
    return [
        {
            id: 'floating-ball',
            isEnabled: () => config.on && config.disableFloatingBall !== true && isFloatingBallAllowedOnPage(),
            mount: () => mountFloatingBall(ctx),
            unmount: unmountFloatingBall,
            isMounted: () => Boolean(document.getElementById('fluent-read-floating-ball-container')),
        },
        {
            id: 'translation-progress-panel',
            isEnabled: () => config.on && config.translationProgressPanelEnabled === true,
            mount: () => mountTranslationProgressPanel(ctx),
            unmount: unmountTranslationProgressPanel,
            isMounted: () => Boolean(document.getElementById('fluent-read-translation-status-container')),
        },
    ];
}
