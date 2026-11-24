/**
 * @file src/features/video-subtitle/content/courseSubtitleTools.ts
 * 文件职责：把完整课程字幕轨接入双语/原文/译文导出工具。
 * 主要内容：复用字幕导出与用户确认补译流程，并在切换视频、字幕轨或配置时取消过期导出。
 * 模块边界：不探测课程接口、不挂载逐句学习面板；稳定字幕轨、翻译服务和文件保存由课程运行时提供。
 */
import type {Config} from '@/src/core/config/model';
import type {CourseCaptionPlatform} from './courseCaptionData';
import {createVideoSubtitleDownloads} from './downloads';
import {confirmVideoSubtitleExport} from './exportPrompt';
import {setVideoMenuDownloadStatus} from './playerMenu';
import {getVideoUiLanguage, translateVideoUi} from './ui';
import {createVideoSubtitleAbortError} from './subtitleLogic';
import type {SubtitleExportFormat} from './subtitleExport';
import type {VideoSubtitleCue} from './youtubeSubtitleData';

interface CourseTrack {cues: VideoSubtitleCue[]; languageCode: string; sourceLanguage: string}
interface CourseSubtitleToolsPorts {
    platform: CourseCaptionPlatform;
    config: Config;
    location: Location;
    readCompleteTrack(): CourseTrack | null;
    readIdentity(): string;
    translate(text: string, signal: AbortSignal, sourceLanguage: string): Promise<string>;
    peek(source: string): string | undefined;
    save(srt: string, label: string, cues: readonly VideoSubtitleCue[], format: SubtitleExportFormat): void;
    updateMenu(): void;
}

export function createCourseSubtitleTools(ports: CourseSubtitleToolsPorts) {
    const {config, location} = ports;
    let disposed = false;
    let exportMenu: HTMLElement | undefined;
    let exportFormat: SubtitleExportFormat = 'srt';
    let identity = ports.readIdentity();
    const ui = (key: string, params?: Record<string, string | number>) =>
        translateVideoUi(key, getVideoUiLanguage(config.uiLanguage), params);
    const currentTrack = () => !disposed && config.on && config.videoTranslationEnabled ? ports.readCompleteTrack() : null;
    const canOpen = () => Boolean(currentTrack()?.cues.length);
    const translate = (text: string, signal: AbortSignal) => {
        const track = currentTrack();
        return track ? ports.translate(text, signal, track.sourceLanguage) : Promise.reject(createVideoSubtitleAbortError());
    };
    const downloads = createVideoSubtitleDownloads({
        config, location, readCompleteTrack: ports.readCompleteTrack, isDisposed: () => disposed,
        human: {ready: async () => undefined, at: () => ''},
        translate, peek: ports.peek, contextKey: ports.readIdentity, ui,
        confirm: (menu, preview, bilingual, signal) => confirmVideoSubtitleExport(menu, preview, bilingual, signal, ui),
        status: setVideoMenuDownloadStatus,
        save: (srt, label, cues) => ports.save(srt, label, cues, exportFormat),
        refreshButtons: ports.updateMenu,
    });
    const cancelExports = () => {
        downloads.cancel();
        if (exportMenu) setVideoMenuDownloadStatus(exportMenu, '');
        exportMenu = undefined;
    };
    function sync() {
        const current = ports.readIdentity();
        const track = currentTrack();
        if (identity !== current || !track?.cues.length) {
            identity = current;
            cancelExports();
        }
    }
    return {
        sync,
        canOpen,
        cancelExports,
        async startDownload(menu: HTMLElement, button: HTMLButtonElement, action: 'original' | 'translated' | 'bilingual') {
            const format = menu.querySelector<HTMLSelectElement>('[data-subtitle-format]')?.value;
            exportMenu = menu;
            exportFormat = format === 'vtt' || format === 'md' ? format : 'srt';
            if (action === 'original') await downloads.original(menu, button, error =>
                ui(error instanceof Error && error.name === 'AbortError' ? 'video.cancelled' : 'video.downloadFailed'));
            else await downloads.translated(menu, button, action === 'bilingual');
        },
        destroy() {
            disposed = true;
            cancelExports();
            downloads.destroy();
        },
    };
}
