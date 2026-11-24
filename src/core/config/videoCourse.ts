/**
 * @file src/core/config/videoCourse.ts
 * 文件职责：定义课程视频平台（B 站、Udemy、edX）自动开启双语字幕偏好的兼容归一化规则。
 * 主要内容：精简版已默认关闭并移除设置页与播放器内的“打开视频就翻译”开关，normalizeVideoCourseAutoStart 始终把三个平台归一化为关闭，防止旧配置自动启动字幕翻译。
 * 模块边界：本文件属于 core 配置领域层纯函数，不探测网页播放器 DOM、不读写浏览器存储，也不发起网络请求。
 */
export const VIDEO_COURSE_PLATFORMS = ['bilibili', 'udemy', 'edx'] as const;
export type VideoCoursePlatform = typeof VIDEO_COURSE_PLATFORMS[number];
export type VideoCourseAutoStart = Record<VideoCoursePlatform, boolean>;

export function normalizeVideoCourseAutoStart(_value: unknown): VideoCourseAutoStart {
    return {
        bilibili: false,
        udemy: false,
        edx: false,
    };
}
