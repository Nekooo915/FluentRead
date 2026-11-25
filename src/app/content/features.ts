/**
 * @file src/app/content/features.ts
 * 文件职责：定义 content composition root 可使用的 feature 公共面，集中汇总全文翻译、进度面板与悬浮球能力。
 * 主要内容：重导出全文翻译、翻译进度条与悬浮球的 mount/unmount、状态查询、路由重置及显示模式同步契约。
 * 模块边界：该 barrel 不创建实例、不执行翻译，也不越过 public.ts 读取 feature 内部实现。
 */
export {
    autoTranslateEnglishPage,
    invalidateFullPageTranslationSessionCache,
    isFullPageTranslationActive,
    getTranslationToolbarStatus,
    getFullPageTranslationDiagnostic,
    getFullPageTranslationDocumentToken,
    readFullPageUnchangedCompletion,
    getFullPageTranslationFrameState,
    resetFullPageTranslationRouteState,
    createPageTranslationDisplayModeSync,
    restoreOriginalContent,
} from '@/src/features/full-page-translation/public';
export {
    mountTranslationProgressPanel,
    unmountTranslationProgressPanel,
} from '@/src/features/full-page-translation/ui/public';
export {
    isFloatingBallAllowedOnPage,
    mountFloatingBall,
    toggleFloatingBallTranslation,
    unmountFloatingBall,
} from '@/src/features/floating-ball/public';
