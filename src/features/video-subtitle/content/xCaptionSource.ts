/**
 * @file src/features/video-subtitle/content/xCaptionSource.ts
 * 文件职责：把 X 与 HTML 音视频中的原生 TextTrack 轨道和 sidecar 字幕映射到统一字幕容器。
 * 主要内容：清理原生 cue 文本标记后按播放时间选择当前正文；在隐藏宿主原生轨道的同时保留模式快照，并在媒体离开或禁用时恢复。
 * 模块边界：不读取配置存储、不执行音频识别或翻译，也不发起网络请求。
 */
import {VIDEO_AI_CAPTION_CONTAINER_ID, VIDEO_CAPTION_SEGMENT_SELECTOR, VIDEO_PLAYER_SELECTOR, findVideoPlayer, isXVideoPage, isHtmlMediaPage} from './ui';
import {normalizeVideoCaptionText} from './subtitleLogic';
import type {VideoSubtitleCue} from './youtubeSubtitleData';
import {cleanSubtitleText, selectXSubtitleLanguageResources} from './xVideoSubtitleData';

export class XCaptionSource {
  private readonly changedTracks = new Map<TextTrack, TextTrackMode>();
  constructor(private readonly read: () => {video: HTMLMediaElement | null; player?: HTMLElement; enabled: boolean; sidecarCues: VideoSubtitleCue[]; language: string}) {}
  restoreTracks(): void {
    for (const [track, mode] of this.changedTracks) {
      try { if (track.mode === 'hidden') track.mode = mode; } catch { /* 页面可能已经销毁原生轨道。 */ }
    }
    this.changedTracks.clear();
  }
  private getOrCreateContainer(video: HTMLMediaElement | null, boundPlayer?: HTMLElement): HTMLElement | null {
    const player = boundPlayer || video?.closest<HTMLElement>(VIDEO_PLAYER_SELECTOR) || video?.parentElement || findVideoPlayer();
    if (!player) return null;
    let container = document.getElementById(VIDEO_AI_CAPTION_CONTAINER_ID);
    if (!(container instanceof HTMLElement)) {
      container = document.createElement('div');
      container.id = VIDEO_AI_CAPTION_CONTAINER_ID;
      container.className = 'fluent-read-video-ai-caption-container fluent-read-video-ui notranslate';
      container.setAttribute('data-fluent-read-ui', 'video-subtitle');
      container.setAttribute('translate', 'no');
      const segment = document.createElement('span');
      segment.className = 'ytp-caption-segment';
      container.appendChild(segment);
    }
    if (container.parentElement !== player) player.appendChild(container);
    return container;
  }

  private getActiveCueAtTime(cues: VideoSubtitleCue[], currentMs: number): VideoSubtitleCue | null {
    if (!Number.isFinite(currentMs)) return null;
    let active: VideoSubtitleCue | null = null;
    for (const cue of cues) {
      const endMs = cue.startMs + Math.max(cue.durationMs, 1);
      if (currentMs < cue.startMs || currentMs >= endMs) continue;
      if (!active || cue.startMs > active.startMs) active = cue;
    }
    return active;
  }

  private selectedNativeTracks(): TextTrack[] {
    const {video, language} = this.read();
    const tracks = Array.from(video?.textTracks || [])
      .filter(track => track.kind === 'captions' || track.kind === 'subtitles');
    tracks.sort((left, right) => Number((this.changedTracks.get(right) || right.mode) === 'showing')
      - Number((this.changedTracks.get(left) || left.mode) === 'showing'));
    return selectXSubtitleLanguageResources(tracks.map(track => ({track, languageCode: track.language})), language)
      .map(({track}) => track);
  }

  /** 可直接导出原生完整轨道，避免把正在播放的一句误当成完整字幕。 */
  readNativeTrack(): {languageCode: string; cues: VideoSubtitleCue[]} | null {
    for (const track of this.selectedNativeTracks()) {
      const cues = Array.from(track.cues || []).map(cue => ({
        startMs: cue.startTime * 1000, durationMs: (cue.endTime - cue.startTime) * 1000,
        text: cleanSubtitleText(String((cue as TextTrackCue & {text?: string}).text || '')),
      })).filter(cue => cue.text && Number.isFinite(cue.startMs) && cue.durationMs > 0);
      if (cues.length) return {languageCode: track.language || 'original', cues};
    }
    return null;
  }

  /** 映射 TextTrack 或 sidecar 字幕，并在帧回调中复用本轮已同步的容器。 */
  sync(onTextChange?: (container: HTMLElement) => void): HTMLElement | null {
    if (!isXVideoPage() && !isHtmlMediaPage()) return null;
    const {video, player, enabled, sidecarCues} = this.read();
    const container = this.getOrCreateContainer(video, player);
    if (!container) return null;
    if (!enabled) {
      this.restoreTracks();
      container.querySelector<HTMLElement>(VIDEO_CAPTION_SEGMENT_SELECTOR)!.textContent = '';
      container.dataset.fluentReadCaptionSource = 'none';
      return container;
    }
    const tracks = Array.from(video?.textTracks || []).filter(track => track.kind === 'captions' || track.kind === 'subtitles');
    for (const track of tracks) {
      try {
        if (track.mode !== 'hidden') {
          this.changedTracks.set(track, track.mode);
          track.mode = 'hidden';
        }
      } catch { /* 页面包装的只读轨道仍可继续尝试读取。 */ }
    }

    const currentMs = video && Number.isFinite(video.currentTime) ? video.currentTime * 1000 : Number.NaN;
    const selectedTracks = this.selectedNativeTracks();
    const hasNativeTimeline = selectedTracks.some(track => (track.cues?.length || 0) > 0);
    let text = '';
    let sourceKind = 'none';

    if (video) {
      for (const track of selectedTracks) {
        const activeText = Array.from(track.activeCues || [])
          .map((cue) => cleanSubtitleText(String((cue as TextTrackCue & { text?: string }).text || '')))
          .filter(Boolean)
          .join('\n');
        if (activeText) {
          text = activeText;
          sourceKind = 'native';
          break;
        }
      }
    }

    if (!hasNativeTimeline && sidecarCues.length > 0) {
      const activeCue = this.getActiveCueAtTime(sidecarCues, currentMs);
      if (activeCue) {
        text = activeCue.text;
        sourceKind = 'sidecar';
      }
    }

    const segment = container.querySelector<HTMLElement>(VIDEO_CAPTION_SEGMENT_SELECTOR);
    if (!segment) return container;
    const previousText = segment.textContent || '';
    if (previousText !== text) segment.textContent = text;
    const display = text ? 'block' : 'none';
    if (segment.style.display !== display) segment.style.display = display;
    if (container.dataset.fluentReadCaptionSource !== sourceKind) {
      container.dataset.fluentReadCaptionSource = sourceKind;
    }
    if (onTextChange && previousText !== text && normalizeVideoCaptionText(previousText) !== normalizeVideoCaptionText(text)) {
      onTextChange(container);
    }
    return container;
  }
}
