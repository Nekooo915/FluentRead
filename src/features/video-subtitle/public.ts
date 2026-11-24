/**
 * @file src/features/video-subtitle/public.ts
 * 文件职责：定义 YouTube、X、B 站、课程网站与 HTML 音视频双语字幕的公共入口。
 * 主要内容：导出支持页面判断与字幕运行时挂载函数。
 * 模块边界：不执行自动挂载，也不暴露内部 DOM 常量；应用层负责启停与清理。
 */
export {mountVideoSubtitleTranslation} from './content/runtime';
export {isSupportedVideoPage, isYouTubeEmbedPage} from './content/ui';
