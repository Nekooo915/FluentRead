/**
 * @file src/features/video-subtitle/content/runtime.ts
 * 文件职责：装配 HTML 音视频、站点视频及会议字幕运行时，并协调 YouTube/X 原生字幕、FluentRead 原文与双语显示层、目标语言人工轨、逐条翻译、校时、菜单、完整句学习与下载；挂载后接收 YouTube 桥回放的早到时间轴；菜单关闭字幕时保留播放器入口，设置中心关闭功能时移除入口；独立管理 YouTube 播放器的原生字幕隐藏所有权，切句不释放，离开或关闭功能时恢复。
 * 主要内容：挂载原句学习与独立本地读音控制器，原文变化立即作废旧读音，字幕隐藏或关闭取消请求；读音开关复用既有配置与菜单并保持仅译文模式语义，说明与下载可独立展开，Escape 逐层关闭且菜单关闭重置临时展开状态；双语顺序复用现有外观配置即时保存与重排，不重发翻译；显示模式变化重新授予同句翻译资格并复用已有缓存，不混入字幕原文及导出；媒体切换和配置变化取消有界字幕预取并清理控制，协调字幕校时、预翻译与补译导出确认，并为可选逐字高亮提供当前句时间；X 分片加载尊重原生轨道优先级和原译文成对显示，播放器内换模型保留取消焦点，完整 AI 识别提前展示稳定句，完成后才缓存和导出。
 * 模块边界：本文件只在 content 页面编排，同视频底控的局部显隐订阅与字幕布局共用帧调度，帧内只校准已展开的菜单；关闭时保留入口状态，打开时一次同步内容、宿主和焦点；完整 AI 字幕缓存请求与提交身份由 subtitleSession 拥有，requestSession 将完整采集映射为后台单流的唯一请求代际；采集资源仍归 fullCapture，不拦截 fetch/XHR 也不实现翻译 provider，翻译经统一 service client。
 */
import {createHtmlMediaHost, mountWhenHtmlMediaPresent} from './htmlMedia';
import {createNativeFullscreenSubtitles, supportsNativeVideoFullscreen} from './nativeFullscreen';
import {hasDistinctTranslation} from '@/src/core/translation/result';
import {hasUiLanguageBundle, type UiLanguage} from '@/src/core/i18n';
import browser from 'webextension-polyfill';
import {sendRuntimeMessage} from '@/src/platform/browser/runtimeMessages';
import {
  VIDEO_AI_CAPTION_CONTAINER_ID,
  VIDEO_CAPTION_CONTAINER_SELECTOR,
  VIDEO_SUBTITLE_PANEL_ID,
  VIDEO_SUBTITLE_PANEL_ACTIVE_CLASS,
  VIDEO_TRANSLATION_BUTTON_ID,
  VIDEO_TRANSLATION_MENU_ID,
  VIDEO_TRANSLATION_ACTIVE_CLASS,
  VIDEO_DISPLAY_TRANSLATION_ONLY_CLASS,
  VIDEO_DISPLAY_ORIGINAL_ONLY_CLASS,
  VIDEO_DISPLAY_HIDDEN_CLASS,
  VIDEO_NORMALIZED_CAPTION_CLASS,
  VIDEO_CAPTION_STABILITY_MS,
  VIDEO_CAPTION_MAX_WAIT_MS,
  normalizeVideoSubtitleDisplayMode,
  getTimedTextCacheKey,
  isOriginalTimedTextUrl,
  downloadSubtitleSrt,
  isYouTubeVideoPage,
  isXVideoPage,
  isXHostPage,
  isSupportedVideoPage,
  isHtmlMediaPage,
  readVisibleCaptionText,
  findCaptionContainer,
  findVideoPlayer,
  getVideoPageKey,
  markVideoUi,
  videoUi,
  getOrCreateTranslationOverlay,
  removeTranslationOverlay, clearRenderedVideoTranslation, deactivateNormalizedVideoCaption, readVideoPlaybackTimeMs,
  syncTranslationOverlayPosition,
  applyVideoDisplayState,
  installVideoSubtitleStyle,
  renderHumanVideoCaption,
} from './ui';
import {XCaptionSource} from './xCaptionSource';
import {XSubtitleLoader} from './xSubtitleLoader';
import {VideoTranslationCache} from './translationCache';
import {VideoPretranslationController} from './pretranslationController';
import {getVideoTranslationConfigFingerprint, normalizeVideoCaptionText, revealVideoSubtitleTranslation, selectYoutubeCaptionCue, selectVideoSubtitleCueAtOffset, findProgressiveVideoCaptionCue, findActiveVideoCaptionCue, selectProgressiveVideoCaptionCue, type YoutubeCueSelection} from './subtitleLogic';
import { config, requestConfigPatch, subscribeConfig } from '@/src/services/config/store';
import {getVideoUiLanguage, localizeVideoUiText, refreshVideoUiAccessibility, refreshVideoUiText, getVideoSubtitleDownloadErrorMessage, writeVideoCaptionText, createVideoSubtitleKaraoke} from './ui';
import {
  type Config,
  normalizeVideoSubtitleOffsetMs,
} from '@/src/core/config/model';
import { translateVideoText } from '@/src/services/translation/client';
import {
  buildYoutubeTimedTextUrl,
  chooseYoutubeCaptionTrackForLocation,
  finalizeVideoSubtitleCues,
  parseYoutubeTimedTextResponse,
  type VideoSubtitleCue,
} from './youtubeSubtitleData';
import {validateYoutubeTimedTextMessage} from './youtubeTimedTextMessage';
import {YOUTUBE_BRIDGE_REPLAY_EVENT} from './youtubeTimedTextBridgeCore';
import {getVideoPretranslationWindowMs, getVideoServiceLabel} from './serviceProfile';
import {parseXVideoBridgeMessage} from './xVideoSubtitleData';
import {
  createVideoPlayerMenu, renderVideoMenuMode, renderVideoSubtitleOrder,
  renderVideoSubtitleTiming, renderVideoSourceStatus, handleVideoMenuNavigation, handleVideoMenuDisclosure, closeVideoMenuDisclosure, resetVideoMenuDisclosures, setVideoMenuToolsOpen, setVideoMenuDownloadStatus, syncVideoPlayerMenuLayout, revealVideoMenuBodyControl, type VideoMenuMode,
} from './playerMenu';
import {isVideoSubtitleInTargetLanguage} from './subtitleLanguage';
import {createVideoPlayerLocator} from './videoPlayerLocator';
import {createVideoPlayerBinding, type VideoPlayerBinding} from './videoPlayerBinding';
import {getCaptionPlatform} from './platforms';
import {getCourseCaptionRequest} from './courseCaptionData';
import {mountPlatformCaptions} from './platformRuntime';
import {createYoutubeNativeCaptionVisibility} from './youtubeNativeCaptionVisibility';
import {YoutubeHumanCaptions} from './youtubeHumanCaptions';
import {readVideoCaptionText} from './subtitleTransport';
import {TimedTextTrackCache} from './timedTextTrackCache';
import {createVideoSubtitleDownloads} from './downloads';
import {confirmVideoSubtitleExport} from './exportPrompt';
import {createSubtitleLayoutObserver} from './subtitleLayoutObserver';

type VideoConfigPatch = Partial<Pick<Config, 'videoTranslationEnabled' | 'videoSubtitleVisible' | 'videoSubtitleDisplayMode' | 'videoSubtitleFontSize' | 'videoSubtitleOffsetMs' | 'videoLocalModel' | 'videoSubtitleAppearance'>>;

/**
 * 挂载 YouTube / X 与 HTML 音视频的字幕入口；普通媒体按需启停并使用独立浮层。
 * X 的 AI 字幕是用户主动点击后，先完整采集视频音频，再交给扩展 offscreen
 * 页面内的本地 Whisper 模型和翻译服务；默认不会采集音频，音频不会离开浏览器。
 */
export function mountVideoSubtitleTranslation(): () => void {
  if (!isHtmlMediaPage()) return mountVideoSubtitleRuntime();
  let dispose: (() => void) | undefined;
  const sync = () => {
    if (config.on && config.videoTranslationEnabled) dispose ??= mountWhenHtmlMediaPresent(mountVideoSubtitleRuntime);
    else {const previous = dispose; dispose = undefined; previous?.();}
  };
  const unsubscribe = subscribeConfig(sync);
  sync();
  return () => {unsubscribe(); const previous = dispose; dispose = undefined; previous?.();};
}

/** HTML 媒体和 X 共用原生 TextTrack / 本地识别来源；桥接请求仍限定原站点。 */
const isMediaSubtitlePage = () => isXVideoPage() || isHtmlMediaPage();

function mountVideoSubtitleRuntime(): () => void {
  const platform = getCaptionPlatform(window.location);
  // Coursera 只在播放器已发布可读取的完整轨时使用课程入口，其余播放器沿用 HTML 媒体路径。
  const courseraHasTrack = import.meta.env.BROWSER !== 'userscript' && platform === 'coursera'
    && Array.from(document.querySelectorAll('video')).some(video => getCourseCaptionRequest('coursera', new URL(window.location.href), video));
  if (platform && (platform !== 'coursera' || courseraHasTrack)) return mountPlatformCaptions({
    document, window, config, subscribe: subscribeConfig,
    translate: translateVideoText,
    patch: patch => { void requestConfigPatch(patch, sendRuntimeMessage).catch(() => undefined); },
    label: text => localizeVideoUiText(text, getVideoUiLanguage(config.uiLanguage)),
    download: downloadSubtitleSrt,
    iconUrl: browser.runtime.getURL('icon/128.png'),
    openSettings: () => { void sendRuntimeMessage({type: 'openOptionsPage', section: 'settings-video'}).catch(() => undefined); },
  });
  if (!isSupportedVideoPage() && !isXHostPage()) return () => undefined;

  const style = installVideoSubtitleStyle();
  let destroyed = false;
  let generation = 0;
  let lastSource = '';
  let lastTranslatedSource = '';
  let lastTranslatedText = '';
  let humanCaptionKey = '';
  let videoPageKey = getVideoPageKey();
  let uiSyncTimer: number | undefined;
  let captionObserver: MutationObserver | undefined;
  let observedContainer: HTMLElement | null = null;
  const nativeCaptionVisibility = createYoutubeNativeCaptionVisibility();
  let menuElement: HTMLElement | null = null;
  let buttonElement: HTMLButtonElement | null = null;
  // 语言资源包可能在配置广播后才到达，加载完成时仍需刷新既有菜单。
  const menuTextLocale = (language: UiLanguage) => `${language}:${hasUiLanguageBundle(language)}`;
  let renderedMenuTextLocale = '';
  let pendingTranslationSource = '';
  let pendingTranslationOverlay: HTMLElement | null = null;
  let translationLoopRunning = false;
  let stableCaptionTimer: ReturnType<typeof setTimeout> | undefined;
  let stableCaptionSource = '';
  let stableCaptionOverlay: HTMLElement | null = null;
  let stableCaptionStartedAt: number | undefined;
  let subtitleOffsetMs = normalizeVideoSubtitleOffsetMs(config.videoSubtitleOffsetMs);
  const capturedSubtitleTracks = new TimedTextTrackCache(() => pretranslationTrackKey);
  const humanCaptions = new YoutubeHumanCaptions((input, init) => fetch(input, init), () => {
    if (destroyed) return;
    resetTranslationState();
    scheduleUpdate();
  });
  // 已是目标语言的字幕直接返回原文：不请求翻译服务，渲染层据此只显示原文一行。
  const videoTranslator = new VideoTranslationCache((text, signal) => isVideoSubtitleInTargetLanguage(text, config.to)
    ? Promise.resolve(text)
    : translateVideoText(text, signal, isMediaSubtitlePage() ? config.videoSourceLanguage : undefined));
  let observedVideo: HTMLMediaElement | null = null;
  const subtitleLayout = createSubtitleLayoutObserver(() => {
    if (menuElement?.isConnected && !menuElement.hidden) {
      playerBinding?.syncMenuHost();
      syncVideoPlayerMenuLayout(menuElement);
    }
    syncTranslationOverlayPosition(observedContainer);
  }, isYouTubeVideoPage);
  const scheduleSubtitleLayout = subtitleLayout.schedule;
  const observeSubtitleLayout = subtitleLayout.observe;
  let pretranslationTrackRequest: Promise<void> | undefined;
  let pretranslationTrackAbort: AbortController | undefined;
  let pretranslationTrackRequestKey = '';
  let pretranslationTrackRetryAt = 0;
  let pretranslationTrackKey = '';
  let pretranslationCues: VideoSubtitleCue[] = [];
  let pretranslationCacheVersion = 0;
  let pretranslationConfigKey = getVideoTranslationConfigFingerprint(config);
  let progressiveCueKey = '';
  let progressiveCue: VideoSubtitleCue | null = null;
  let progressiveTranslation = '';
  let normalizedCaptionActive = false;
  let observedMediaSource = '';
  let observedMediaEpoch = 0;
  let mediaMissingTimer: ReturnType<typeof setTimeout> | undefined;
  let activeVideoLanguage = config.videoSourceLanguage;
  const htmlMediaHost = isHtmlMediaPage() ? createHtmlMediaHost(scheduleSubtitleLayout) : null;
  const playerLocator = createVideoPlayerLocator(htmlMediaHost ? {includeAudio: true, getPlayer: htmlMediaHost.getPlayer} : {});
  let playerBinding: VideoPlayerBinding | undefined;
  const xSubtitleLoader = new XSubtitleLoader({
    fetch: (url, options) => fetch(url, {...options, credentials: 'omit'}),
    language: () => config.videoSourceLanguage,
    onCues: (url, cues) => appendXSubtitleCues(url, cues),
  });
  const xSubtitleTrackKey = 'x:captions';
  let xSubtitleCues: VideoSubtitleCue[] = [];

  const xCaptionSource = new XCaptionSource(() => ({
    video: observedVideo, player: playerLocator.getTarget()?.player,
    enabled: config.on && config.videoTranslationEnabled && config.videoSubtitleVisible !== false,
    sidecarCues: pretranslationTrackKey.startsWith('x:') ? pretranslationCues : [], language: config.videoSourceLanguage,
  }));
  const syncXVideoCaptionSource = () => xCaptionSource.sync();

  const clearRenderedTranslation = () => clearRenderedVideoTranslation(document);
  const deactivateNormalizedCaption = () => { deactivateNormalizedVideoCaption(document); normalizedCaptionActive = false; };

  const clearProgressiveCaption = () => {
    progressiveCueKey = '';
    progressiveCue = null;
    progressiveTranslation = '';
    deactivateNormalizedCaption();
  };

  const cancelStableCaption = () => {
    if (stableCaptionTimer) clearTimeout(stableCaptionTimer);
    stableCaptionTimer = undefined;
    stableCaptionSource = '';
    stableCaptionOverlay = null;
    stableCaptionStartedAt = undefined;
  };

  const resetTranslationState = (preserveCaptionWait = false) => {
    if (!preserveCaptionWait) cancelStableCaption();
    generation += 1;
    lastSource = '';
    lastTranslatedSource = '';
    lastTranslatedText = '';
    humanCaptionKey = '';
    pendingTranslationSource = '';
    pendingTranslationOverlay = null;
    clearProgressiveCaption();
    clearRenderedTranslation();
    document.getElementById(VIDEO_SUBTITLE_PANEL_ID)?.classList.remove(VIDEO_SUBTITLE_PANEL_ACTIVE_CLASS);
  };

  // 译文与原文相同（包括已是目标语言而跳过翻译）时，双语只保留原文一行；仅译文模式隐藏了
  // 原文行，仍需用原文回退显示。结果按原样缓存，每次渲染时按当前显示模式决定，切换模式后立即生效。
  const visibleTranslation = (translation: string, source: string): string =>
    hasDistinctTranslation(normalizeVideoCaptionText(source), normalizeVideoCaptionText(translation)) ? translation
      : normalizeVideoSubtitleDisplayMode(config.videoSubtitleDisplayMode) === 'translation-only' ? source : '';

  // X 的双语面板以一整对字幕为更新单位。未预取到译文时先收起两行，
  // 返回后一起显示；明确失败时保留原文，让菜单中的重试仍然可用。
  const renderSynchronizedXCaption = (container: HTMLElement, source: string, translation?: string) => {
    const player = playerLocator.getTarget()?.player;
    if (!player) return;
    const result = translation || (isVideoSubtitleInTargetLanguage(source, config.to) ? source : '');
    normalizedCaptionActive = true;
    renderHumanVideoCaption(player, container, result || videoTranslator.hasFailure(source) ? source : '', visibleTranslation(result, source));
  };

  const canReadVideo = () => config.on && config.videoTranslationEnabled && config.videoSubtitleVisible !== false;

  const canTranslateVideo = () => canReadVideo() && normalizeVideoSubtitleDisplayMode(config.videoSubtitleDisplayMode) !== 'original-only';

  // 接管状态属于播放器会话，而非某一条 cue 或可被 YouTube 整块替换的字幕容器。
  // 各显示模式都由 FluentRead 自有层呈现；关闭视频字幕功能后才交还给网站。
  const syncNativeCaptionVisibility = () => {
    const nextPlayer = config.on && config.videoTranslationEnabled && isYouTubeVideoPage()
      ? playerLocator.getTarget()?.player || null : null;
    nativeCaptionVisibility.sync(nextPlayer);
  };

  const clearPretranslationState = (clearTrack = false, preserveTranslations = false) => {
    pretranslationController.clear();
    pretranslationTrackAbort?.abort();
    pretranslationTrackAbort = undefined;
    pretranslationTrackRequest = undefined;
    pretranslationCacheVersion += 1;
    if (preserveTranslations) videoTranslator.cancelPending();
    else videoTranslator.clear();
    resetTranslationState();
    if (clearTrack) {
      pretranslationTrackRequest = undefined;
      pretranslationTrackRequestKey = '';
      pretranslationTrackRetryAt = 0;
      pretranslationTrackKey = '';
      pretranslationCues = [];
    }
  };

  const getCachedVideoTranslation = (source: string, prefetch = false, cue?: VideoSubtitleCue): Promise<string> => {
    if (config.videoPreferHumanSubtitles && isYouTubeVideoPage()) {
      const currentMs = getCurrentVideoTimeMs() - subtitleOffsetMs;
      const active = cue || findProgressiveVideoCaptionCue(pretranslationCues, source, currentMs);
      const time = prefetch && active ? active.startMs + active.durationMs / 2 : currentMs;
      const human = humanCaptions.at(time);
      if (human) return Promise.resolve(human);
    }
    return videoTranslator.request(source, prefetch);
  };

  const nativeFullscreen = createNativeFullscreenSubtitles(() => ({
    video: observedVideo as HTMLVideoElement | null, enabled: canReadVideo() && isYouTubeVideoPage(),
    cues: pretranslationCues, mode: normalizeVideoSubtitleDisplayMode(config.videoSubtitleDisplayMode),
    offsetMs: subtitleOffsetMs, language: config.to, bilingualOrder: config.videoSubtitleAppearance.bilingualOrder,
    revision: `${videoTranslator.revision}:${humanCaptions.revision}:${config.to}:${config.videoPreferHumanSubtitles}`,
    translation: (source, cue) => (config.videoPreferHumanSubtitles ? humanCaptions.at(cue.startMs + cue.durationMs / 2) : '')
      || (isVideoSubtitleInTargetLanguage(source, config.to) ? source : videoTranslator.peek(source)),
  }));

  const getCurrentVideoTimeMs = () => readVideoPlaybackTimeMs(
    playerLocator.getTarget()?.player || (isYouTubeVideoPage() ? findVideoPlayer() : null), observedVideo);

  const hasAdjustedTimeline = () => subtitleOffsetMs !== 0 && pretranslationCues.length > 0;
  const getAdjustedCaptionCue = () => selectVideoSubtitleCueAtOffset(pretranslationCues, getCurrentVideoTimeMs(), subtitleOffsetMs);
  // 逐字高亮默认关闭；开启后原文与译文按当前句的时间一起扫光，手动校时同样生效。
  const karaoke = createVideoSubtitleKaraoke(() => canReadVideo() ? observedVideo : null,
    () => progressiveCue || getAdjustedCaptionCue(), () => subtitleOffsetMs);
  const readCurrentCaptionText = (container: Element | null): string => {
    if (!container) return '';
    if (!hasAdjustedTimeline()) return readVisibleCaptionText(container);
    if (isYouTubeVideoPage() && document.querySelector('.ytp-subtitles-button')?.getAttribute('aria-pressed') === 'false') return '';
    return getAdjustedCaptionCue()?.text || '';
  };

  const getProgressiveCueKey = (cue: VideoSubtitleCue): string =>
    `${(cue as VideoSubtitleCue & { cueId?: string }).cueId || cue.startMs}:${normalizeVideoCaptionText(cue.text)}`;

  const findActiveProgressiveCue = () => findActiveVideoCaptionCue(pretranslationCues, getCurrentVideoTimeMs());
  const selectProgressiveCue = (source: string, selection?: YoutubeCueSelection): VideoSubtitleCue | null => {
    if (hasAdjustedTimeline()) return getAdjustedCaptionCue();
    if (isYouTubeVideoPage()) {
      // 播放时钟可能在同轮跨过句界；输入全同才复用，不保留跨帧或异步结果。
      const cues = pretranslationCues, currentMs = getCurrentVideoTimeMs();
      if (selection && selection.cues === cues && selection.source === source && selection.currentMs === currentMs) return selection.cue;
      return selectYoutubeCaptionCue(cues, source, currentMs).cue;
    }
    return selectProgressiveVideoCaptionCue(pretranslationCues, source, getCurrentVideoTimeMs());
  };

  const renderProgressiveCaption = (source: string, overlay: HTMLElement, container: HTMLElement) => {
    if (!progressiveCue) return;
    if (isMediaSubtitlePage()) {
      renderSynchronizedXCaption(container, progressiveCue.text, progressiveTranslation);
      return;
    }
    if (!progressiveTranslation) return;
    if (!visibleTranslation(progressiveTranslation, progressiveCue.text)) {
      writeVideoCaptionText(overlay, '');
      syncTranslationOverlayPosition(container);
      return;
    }

    const revealed = normalizedCaptionActive
      ? progressiveTranslation.trim()
      : revealVideoSubtitleTranslation(progressiveTranslation, source, progressiveCue.text);
    if (!revealed) return;
    writeVideoCaptionText(overlay, revealed);
    syncTranslationOverlayPosition(container);
  };

  const updateProgressiveCaption = (source: string, overlay: HTMLElement, container: HTMLElement, selection?: YoutubeCueSelection): boolean => {
    const cue = selectProgressiveCue(source, selection);
    if (!cue) return false;

    cancelStableCaption();
    const cueKey = getProgressiveCueKey(cue);
    if (cueKey !== progressiveCueKey) {
      deactivateNormalizedCaption();
      progressiveCueKey = cueKey;
      progressiveCue = cue;
      progressiveTranslation = videoTranslator.peek(cue.text) || '';
      ++generation;
      lastTranslatedSource = '';
      lastTranslatedText = '';
      writeVideoCaptionText(overlay, '');
    } else {
      progressiveCue = cue;
    }
    startCaptionClock();

    const syntheticCaptionActive = container.id === VIDEO_AI_CAPTION_CONTAINER_ID;
    const captionDiffersFromCue = normalizeVideoCaptionText(source) !== normalizeVideoCaptionText(cue.text);
    // YouTube 的整句与逐词字幕都使用同一个双语面板；避免每次换句在
    // 原生定位和归一化定位之间跳动，播放控件动画也不再分别移动两行。
    normalizedCaptionActive ||= captionDiffersFromCue || syntheticCaptionActive || isYouTubeVideoPage();
    if (normalizedCaptionActive) {
      const player = playerLocator.getTarget()?.player || (isYouTubeVideoPage() ? findVideoPlayer() : null);
      if (player) renderHumanVideoCaption(player, container, isMediaSubtitlePage() ? '' : cue.text, overlay.textContent || '');
    }
    lastSource = source;
    renderProgressiveCaption(source, overlay, container);
    if (progressiveTranslation) return true;

    const requestGeneration = generation;
    const requestCueKey = cueKey;
    const requestTrackVersion = pretranslationCacheVersion;
    void getCachedVideoTranslation(cue.text, false, cue).then((translated) => {
      const result = typeof translated === 'string' ? translated.trim() : '';
      if (!result) return;
      if (destroyed || requestTrackVersion !== pretranslationCacheVersion) return;

      if (requestGeneration !== generation || requestCueKey !== progressiveCueKey) return;
      if (observedVideo?.seeking || !canTranslateVideo()) return;
      progressiveTranslation = result;

      const currentContainer = findCaptionContainer();
      const currentSource = readCurrentCaptionText(currentContainer);
      const currentCue = currentSource ? selectProgressiveCue(currentSource) : findActiveProgressiveCue();
      const currentCueKey = currentCue ? getProgressiveCueKey(currentCue) : '';
      if (!currentContainer || !currentSource || currentCueKey !== requestCueKey) return;
      lastSource = currentSource;
      renderProgressiveCaption(currentSource, overlay, currentContainer);
    }).catch((error) => {
      if (!destroyed && requestGeneration === generation) {
        if (isMediaSubtitlePage()) { scheduleUpdate(); updatePlayerUiState(); }
        console.warn('[FluentRead] 视频字幕前置翻译失败', error);
      }
    });

    return true;
  };

  const primeUpcomingVideoCaptions = () => {
    if (destroyed || !canTranslateVideo() || !observedVideo || pretranslationCues.length === 0) return;
    videoTranslator.primeUpcoming(pretranslationCues, observedVideo.currentTime * 1000 - subtitleOffsetMs,
      getVideoPretranslationWindowMs(config.videoService || config.service), observedVideo.playbackRate, getCachedVideoTranslation);
  };

  const pretranslationController = new VideoPretranslationController(primeUpcomingVideoCaptions, () => {
    ensurePretranslationTrack();
    scheduleUpdate();
  });
  const schedulePretranslation = (immediate = false) => pretranslationController.schedule(immediate);

  const setPretranslationTrack = (key: string, entry: { url: string; cues: VideoSubtitleCue[] }) => {
    // 字幕时间行只在有时间轴时出现；打开的菜单需在轨道到达或清空时立即更新。
    if ((pretranslationCues.length > 0) !== (entry.cues.length > 0) && menuElement && !menuElement.hidden) {
      queueMicrotask(() => { if (!destroyed) updatePlayerUiState(); });
    }
    if (key === pretranslationTrackKey) {
      pretranslationCues = entry.cues;
      schedulePretranslation();
      return;
    }
    pretranslationTrackAbort?.abort();
    pretranslationTrackKey = key;
    pretranslationCues = entry.cues;
    pretranslationCacheVersion += 1;
    videoTranslator.clear();
    resetTranslationState();
    schedulePretranslation(true);
  };

  const getPreferredCapturedTrack = () => {
    const active = pretranslationTrackKey ? capturedSubtitleTracks.get(pretranslationTrackKey) : undefined;
    if (active) return [pretranslationTrackKey, active] as const;
    const captured = Array.from(capturedSubtitleTracks.entries());
    const original = captured.find(([, entry]) => isOriginalTimedTextUrl(entry.url));
    return original || captured[0] || null;
  };

  const appendXSubtitleCues = (url: string, cues: VideoSubtitleCue[]) => {
    if (cues.length === 0) return;
    xSubtitleCues = finalizeVideoSubtitleCues([...xSubtitleCues, ...cues]).slice(0, 4000);
    const entry = { url, cues: xSubtitleCues };
    capturedSubtitleTracks.set(xSubtitleTrackKey, entry);
    if (canReadVideo()) {
      ensurePretranslationTrack();
      scheduleUpdate();
    }
  };

  const handleXSubtitleResourceMessage = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin || !isXVideoPage()) return;
    const data = parseXVideoBridgeMessage(event.data, {
      matchesPage: href => getVideoPageKey(href) === videoPageKey,
      mediaSource: `${observedMediaSource} ${(observedVideo as HTMLVideoElement | null)?.poster || ''}`,
      videoCount: () => document.querySelectorAll('video').length,
    });
    if (!data || data.kind === 'media') return;
    if (data.loadCaptions) {
      xSubtitleLoader.load({ url: data.url, offsetMs: 0 }, data.responseText);
    }
  };

  const ensurePretranslationTrack = () => {
    if (destroyed || !canReadVideo()) return;
    if (isYouTubeVideoPage()) humanCaptions.sync(document, window.location, config.to, config.videoPreferHumanSubtitles);

    const native = isMediaSubtitlePage() ? xCaptionSource.readNativeTrack() : null;

    if (native) {
      setPretranslationTrack(`x:native:${native.languageCode}`, {url: 'x:native', cues: native.cues});
      return;
    }
    const captured = getPreferredCapturedTrack();
    if (captured) {
      setPretranslationTrack(captured[0], captured[1]);
      return;
    }

    if (isMediaSubtitlePage()) return;
    const track = chooseYoutubeCaptionTrackForLocation(document, window.location, config.from);
    if (!track) return;
    const url = buildYoutubeTimedTextUrl(track);
    const key = getTimedTextCacheKey(url);
    if (key === pretranslationTrackKey && pretranslationCues.length > 0) return;
    if (pretranslationTrackRequest) return;
    if (pretranslationTrackRequestKey === key && Date.now() < pretranslationTrackRetryAt) return;

    pretranslationTrackRequestKey = key;
    const requestVersion = pretranslationCacheVersion;
    const controller = new AbortController();
    pretranslationTrackAbort = controller;
    const request = (async () => {
      try {
        const text = await readVideoCaptionText(url, fetch, {credentials: 'include', signal: controller.signal});
        if (destroyed || controller.signal.aborted || requestVersion !== pretranslationCacheVersion) return;
        const cues = finalizeVideoSubtitleCues(parseYoutubeTimedTextResponse(text));
        if (cues.length === 0) {
          pretranslationTrackRetryAt = Date.now() + 5000;
          return;
        }
        const entry = { url, cues };
        capturedSubtitleTracks.set(key, entry);
        setPretranslationTrack(key, entry);
        pretranslationTrackRetryAt = 0;
        scheduleUpdate();
      } catch {
        // 页面尚未准备好字幕轨道时，保留 DOM 实时翻译回退，并降低重试频率。
        if (!controller.signal.aborted && requestVersion === pretranslationCacheVersion) pretranslationTrackRetryAt = Date.now() + 5000;
      } finally {
        if (pretranslationTrackAbort === controller) pretranslationTrackAbort = undefined;
      }
    })();
    pretranslationTrackRequest = request;
    void request.then(
      () => {
        if (pretranslationTrackRequest === request) pretranslationTrackRequest = undefined;
      },
      () => {
        if (pretranslationTrackRequest === request) pretranslationTrackRequest = undefined;
      },
    );
  };

  const syncVideoElement = (confirmMissing = false) => {
    const nextVideo = playerLocator.sync()?.video || null;
    if (!nextVideo && observedVideo && (observedVideo.isConnected || !confirmMissing)) {
      // 全屏切换和布局动画可能暂时隐藏仍连接的播放器；候选不可见不等于换媒体。
      if (observedVideo.isConnected) { if (mediaMissingTimer) clearTimeout(mediaMissingTimer); mediaMissingTimer = undefined; return; }
      mediaMissingTimer ??= setTimeout(() => { mediaMissingTimer = undefined; syncVideoElement(true); }, 1500);
      return;
    }
    if (mediaMissingTimer) clearTimeout(mediaMissingTimer);
    mediaMissingTimer = undefined;
    const nextSource = nextVideo?.currentSrc || nextVideo?.src || '';
    const previousVideo = observedVideo;
    if (nextVideo === observedVideo && nextSource === observedMediaSource) return;
    const sameMedia = Boolean(previousVideo && previousVideo === nextVideo && nextSource === observedMediaSource);
    if (!sameMedia) { observedMediaEpoch += 1; if (previousVideo) downloads.cancel(); }
    xCaptionSource.restoreTracks();
    stopCaptionClock();
    pretranslationController.observe(null);
    observedVideo = nextVideo || null;
    observedMediaSource = nextSource;
    if (previousVideo && isMediaSubtitlePage() && !sameMedia) {
      xSubtitleLoader.reset();
      xSubtitleCues = [];
      capturedSubtitleTracks.clear();
      clearPretranslationState(true);
    }
    if (!observedVideo) return;
    pretranslationController.observe(observedVideo);
    if (isMediaSubtitlePage()) document.dispatchEvent(new CustomEvent(YOUTUBE_BRIDGE_REPLAY_EVENT));
    startCaptionClock();
    schedulePretranslation();
  };

  const closeMenu = () => {
    const menu = menuElement?.isConnected ? menuElement : document.getElementById(VIDEO_TRANSLATION_MENU_ID);
    const button = buttonElement?.isConnected ? buttonElement : document.getElementById(VIDEO_TRANSLATION_BUTTON_ID);
    const heldFocus = menu?.contains(document.activeElement);
    if (menu) menu.hidden = true;
    downloads.cancel();
    if (menu) {
      if (menu.dataset.panel === 'tools') setVideoMenuToolsOpen(menu, false);
      else resetVideoMenuDisclosures(menu);
    }
    button?.setAttribute('aria-expanded', 'false');
    if (heldFocus && button?.isConnected) button.focus({preventScroll: true});
    syncTranslationOverlayPosition(findCaptionContainer());
  };

  const renderPlayerUiState = () => {
    const button = buttonElement?.isConnected ? buttonElement : document.getElementById(VIDEO_TRANSLATION_BUTTON_ID);
    const menu = menuElement?.isConnected ? menuElement : document.getElementById(VIDEO_TRANSLATION_MENU_ID);
    if (!menu) return;
    if (button instanceof HTMLButtonElement) buttonElement = button;
    if (menu instanceof HTMLElement) menuElement = menu;

    const enabled = config.on && config.videoTranslationEnabled;
    const visible = config.videoSubtitleVisible !== false;
    const status = config.on
      ? (enabled && visible ? videoUi('video.enabled') : videoUi('video.disabled'))
      : videoUi('video.globalDisabled');
    button?.classList.toggle(VIDEO_TRANSLATION_ACTIVE_CLASS, enabled && visible);
    button?.removeAttribute('aria-pressed');
    const expanded = String(!menu.hidden);
    if (button && button.getAttribute('aria-expanded') !== expanded) button.setAttribute('aria-expanded', expanded);

    const language = getVideoUiLanguage(config.uiLanguage);
    refreshVideoUiAccessibility(menu.hidden ? null : menu, button, document, language, status);
    if (menu.hidden) return;
    const textLocale = menuTextLocale(language);
    if (renderedMenuTextLocale !== textLocale) {
      refreshVideoUiText(menu, language);
      renderedMenuTextLocale = textLocale;
    }
    const selectedMode: VideoMenuMode = enabled && visible ? normalizeVideoSubtitleDisplayMode(config.videoSubtitleDisplayMode) : 'off';
    renderVideoMenuMode(menu, selectedMode, !config.on, status);
    renderVideoSubtitleOrder(menu, config.videoSubtitleAppearance.bilingualOrder, !enabled || !visible, selectedMode === 'bilingual');
    const service = menu.querySelector<HTMLElement>('[data-service-label]');
    const serviceLabel = localizeVideoUiText(getVideoServiceLabel(config.videoService || config.service), language);
    if (service && service.textContent !== serviceLabel) service.textContent = serviceLabel;
    renderVideoSubtitleTiming(menu, subtitleOffsetMs, enabled && visible && pretranslationCues.length > 0, language);
    if (isMediaSubtitlePage()) {
      const source = pretranslationTrackKey.startsWith('x:') && pretranslationCues.length > 0 ? 'native' : 'none';
      renderVideoSourceStatus(menu, {
        enabled: enabled && visible, source,
        cueCount: source === 'none' ? 0 : pretranslationCues.length,
        translationFailed: canTranslateVideo() && videoTranslator.hasFailure(progressiveCue?.text || readCurrentCaptionText(findCaptionContainer())),
      }, language);
    }
    const nativeHint = menu.querySelector<HTMLElement>('[data-native-fullscreen-hint]');
    if (nativeHint) nativeHint.hidden = !isYouTubeVideoPage() || !supportsNativeVideoFullscreen(observedVideo as HTMLVideoElement | null) || !enabled || !visible;
    if (!menu.hidden) syncVideoPlayerMenuLayout(menu);
  };

  const updatePlayerUiState = () => {
    playerBinding?.sync();
    renderPlayerUiState();
  };

  const persistVideoConfig = (patch: VideoConfigPatch) => {
    // requestConfigPatch 会在返回 Promise 前乐观更新共享 config；连续点击会读取
    // 用户刚看到的状态，同时后台只在最新权威配置上合并这几个视频字段。
    void requestConfigPatch(
      patch,
      sendRuntimeMessage,
    ).catch((error) => {
      console.warn('[FluentRead] 视频字幕设置保存失败', error);
    });
  };

  const ensureNativeCaptions = () => {
    if (!isYouTubeVideoPage()) return;
    const nativeButton = document.querySelector<HTMLButtonElement>('.ytp-subtitles-button');
    if (nativeButton && nativeButton.getAttribute('aria-pressed') !== 'true') {
      nativeButton.click();
    }
  };

  const handleTimedTextMessage = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const validated = validateYoutubeTimedTextMessage(event.data, window.location.href);
    if (!validated) return;
    // 人工目标轨由独立时间轴消费，不能把它当作播放器的原文轨替换。
    if (humanCaptions.ownsUrl(validated.url)) return;
    const key = getTimedTextCacheKey(validated.url);
    const entry = validated;
    capturedSubtitleTracks.set(key, entry);
    // 仅原文模式不请求翻译，但仍消费原始时间轴，让自有字幕层显示完整 cue。
    if (canReadVideo()) {
      setPretranslationTrack(key, entry);
      scheduleUpdate();
    }
  };

  const downloads = createVideoSubtitleDownloads({
    config, document, location: window.location, request: (input, init) => fetch(input, init), isX: isMediaSubtitlePage, isDisposed: () => destroyed,
    isAiActive: () => false,
    isAiComplete: () => true,
    nativeX: () => xCaptionSource.readNativeTrack(), aiCues: () => [],
    captured: () => Array.from(capturedSubtitleTracks.values()).reverse(),
    human: {ready: async () => {
      if (isYouTubeVideoPage()) humanCaptions.sync(document, window.location, config.to, config.videoPreferHumanSubtitles);
      await humanCaptions.ready();
    }, at: time => humanCaptions.at(time)},
    translate: source => videoTranslator.request(source), peek: source => pretranslationConfigKey === getVideoTranslationConfigFingerprint(config) ? videoTranslator.peek(source) : undefined,
    cancelTranslations: () => videoTranslator.cancelPending(),
    contextKey: () => `${getVideoPageKey()}:${observedMediaEpoch}`,
    confirm: (menu, preview, bilingual, signal) => confirmVideoSubtitleExport(menu, preview, bilingual, signal, videoUi), ui: videoUi, status: setVideoMenuDownloadStatus, save: (srt, language, cues) => {
      const value = menuElement?.querySelector<HTMLSelectElement>('[data-subtitle-format]')?.value;
      downloadSubtitleSrt(srt, language, cues, value === 'vtt' || value === 'md' ? value : 'srt');
    }, refreshButtons: updatePlayerUiState,
    remember: entry => { const key = getTimedTextCacheKey(entry.url); capturedSubtitleTracks.set(key, entry);
      if (canReadVideo()) setPretranslationTrack(key, entry); },
  });

  const selectMenuMode = (mode: VideoMenuMode) => {
    if (mode === 'off') {
      if (config.videoSubtitleVisible === false) return;
      persistVideoConfig({ videoSubtitleVisible: false });
      downloads.cancel();
      return;
    }
    const wasEnabled = config.videoTranslationEnabled;
    persistVideoConfig({
      videoSubtitleDisplayMode: normalizeVideoSubtitleDisplayMode(mode),
      ...(wasEnabled ? {} : {videoTranslationEnabled: true}),
      ...(config.videoSubtitleVisible === false ? {videoSubtitleVisible: true} : {}),
    });
    if (!wasEnabled) ensureNativeCaptions();
  };

  const handleMenuClick = async (event: MouseEvent) => {
    if (!event.isTrusted) return;
    const menu = menuElement;
    if (!menu || !(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>('[data-action], [data-mode], [data-subtitle-order]');
    if (!target || !menu.contains(target) || (target instanceof HTMLButtonElement && target.disabled)) return;

    event.preventDefault();
    event.stopPropagation();

    if (handleVideoMenuDisclosure(menu, target.dataset.action)) return;

    if (target.dataset.action === 'open-subtitle-tools' || target.dataset.action === 'close-subtitle-tools') {
      const open = target.dataset.action === 'open-subtitle-tools';
      setVideoMenuToolsOpen(menu, open);
      const destination = menu.querySelector<HTMLButtonElement>(open ? '[data-action="close-subtitle-tools"]' : '[data-action="open-subtitle-tools"]');
      if (destination && !destination.hidden) destination.focus();
      else menu.querySelector<HTMLButtonElement>('[data-mode][aria-checked="true"]')?.focus();
      return;
    }
    if (['subtitle-earlier', 'subtitle-later', 'reset-subtitle-timing'].includes(target.dataset.action || '')) {
      const nextOffset = target.dataset.action === 'reset-subtitle-timing' ? 0
        : normalizeVideoSubtitleOffsetMs(config.videoSubtitleOffsetMs) + (target.dataset.action === 'subtitle-earlier' ? -500 : 500);
      persistVideoConfig({videoSubtitleOffsetMs: normalizeVideoSubtitleOffsetMs(nextOffset)});
      return;
    }
    if (target.dataset.subtitleOrder === 'original-first' || target.dataset.subtitleOrder === 'translation-first') {
      persistVideoConfig({videoSubtitleAppearance: {...config.videoSubtitleAppearance, bilingualOrder: target.dataset.subtitleOrder}});
      return;
    }
    if (target.dataset.mode) {
      selectMenuMode(target.dataset.mode as VideoMenuMode);
      return;
    }
    if (target.dataset.action === 'close-menu') {
      closeMenu();
      buttonElement?.focus({preventScroll: true});
      return;
    }
    if (target.dataset.action === 'retry-subtitle-translation') {
      videoTranslator.retryFailures();
      resetTranslationState();
      scheduleUpdate();
      schedulePretranslation();
      updatePlayerUiState();
      return;
    }
    if (target.dataset.action === 'download-subtitles') {
      await downloads.original(menu, target as HTMLButtonElement,
        error => getVideoSubtitleDownloadErrorMessage(error, getVideoUiLanguage(config.uiLanguage)));
      return;
    }
    if (target.dataset.action === 'download-translated-subtitles' || target.dataset.action === 'download-bilingual-subtitles') {
      syncPretranslationConfig();
      await downloads.translated(menu, target as HTMLButtonElement, target.dataset.action === 'download-bilingual-subtitles');
      return;
    }
    if (target.dataset.action === 'open-settings') {
      closeMenu();
      void sendRuntimeMessage({ type: 'openOptionsPage', section: 'settings-video' }).catch(() => undefined);
    }
  };

  const createPlayerMenu = (player: HTMLElement): HTMLElement => {
    const language = getVideoUiLanguage(config.uiLanguage);
    const menu = createVideoPlayerMenu(language, isMediaSubtitlePage());
    renderedMenuTextLocale = '';
    player.appendChild(menu);
    bindMenuClick(menu);
    menuElement = menu;
    return menu;
  };

  const handleButtonClick = (event: MouseEvent) => {
    if (!event.isTrusted) return;
    event.preventDefault();
    event.stopPropagation();
    const menu = menuElement?.isConnected ? menuElement : document.getElementById(VIDEO_TRANSLATION_MENU_ID);
    if (!(menu instanceof HTMLElement)) return;
    menuElement = menu;
    if (!menu.hidden) {
      closeMenu();
      return;
    }
    menu.hidden = false;
    playerBinding?.syncMenuHost();
    renderPlayerUiState();
    syncTranslationOverlayPosition(findCaptionContainer());
    // 新一次打开回到主要操作；只重置自有正文，不滚动网页，状态刷新/旋转保留原位置。
    const body = menu.querySelector<HTMLElement>('.fluent-read-video-menu-body');
    if (body) body.scrollTop = 0;
    // 这是用户明确打开菜单的初始焦点；极矮态不能把焦点交给已隔离的正文。
    const initialFocus = menu.dataset.viewportState === 'close-only' ? '[data-action="close-menu"]' : '[data-mode][aria-checked="true"]';
    const control = menu.querySelector<HTMLButtonElement>(initialFocus);
    control?.focus({preventScroll: true});
    revealVideoMenuBodyControl(menu, control);
  };

  const bindButtonClick = (button: HTMLButtonElement) => {
    if (button.dataset.fluentReadClickBound === 'true') return;
    button.dataset.fluentReadClickBound = 'true';
    button.addEventListener('click', handleButtonClick);
  };

  const bindMenuClick = (menu: HTMLElement) => {
    if (menu.dataset.fluentReadClickBound === 'true') return;
    menu.dataset.fluentReadClickBound = 'true';
    menu.addEventListener('click', handleMenuClick);
    menu.addEventListener('keydown', handleVideoMenuNavigation);
  };

  const createPlayerButton = (): HTMLButtonElement => {
    const button = document.createElement('button');
    button.id = VIDEO_TRANSLATION_BUTTON_ID;
    button.className = 'ytp-button fluent-read-video-subtitle-button fluent-read-video-ui notranslate';
    button.type = 'button';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-controls', VIDEO_TRANSLATION_MENU_ID);
    const initialLabel = videoUi('video.buttonAriaLabel', {status: videoUi('video.disabled')});
    button.setAttribute('aria-label', initialLabel);
    button.title = initialLabel;
    const icon = document.createElement('img');
    icon.className = 'fluent-read-video-subtitle-button-icon';
    icon.src = browser.runtime.getURL('icon/128.png');
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
    markVideoUi(button);
    bindButtonClick(button);
    button.classList.toggle('fluent-read-video-subtitle-x-button', isMediaSubtitlePage());
    buttonElement = button;
    return button;
  };

  const handleDocumentClick = (event: MouseEvent) => {
    if (!event.isTrusted) return;
    if (!menuElement?.isConnected || menuElement.hidden) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (buttonElement?.contains(target) || menuElement.contains(target)) return;
    closeMenu();
  };

  const handleDocumentKeydown = (event: KeyboardEvent) => {
    if (!event.isTrusted) return;
    if (event.key !== 'Escape' || !menuElement || menuElement.hidden) return;
    // 全屏 Escape 属于浏览器；菜单可以同时收尾，但不能阻止退出全屏。
    if (!document.fullscreenElement) event.preventDefault();
    event.stopPropagation();
    // 导出/模型确认先退回原菜单，再按一次才关闭整个菜单。
    if (menuElement.dataset.view === 'export-prompt') { downloads.cancel(); return; }
    if (menuElement.dataset.view === 'main' && closeVideoMenuDisclosure(menuElement)) return;
    if (menuElement.dataset.panel === 'tools') {
      setVideoMenuToolsOpen(menuElement, false);
      const destination = menuElement.querySelector<HTMLButtonElement>('[data-action="open-subtitle-tools"]');
      if (destination && !destination.hidden) destination.focus();
      else menuElement.querySelector<HTMLButtonElement>('[data-mode][aria-checked="true"]')?.focus();
    } else { closeMenu(); buttonElement?.focus({preventScroll: true}); }
  };

  const startTranslationLoop = () => {
    if (translationLoopRunning) return;

    translationLoopRunning = true;
    void (async () => {
      try {
        while (!destroyed && pendingTranslationSource) {
          const nextSource = pendingTranslationSource;
          const nextOverlay = pendingTranslationOverlay;
          pendingTranslationSource = '';
          pendingTranslationOverlay = null;
          const requestGeneration = generation;
          try {
            const translated = await getCachedVideoTranslation(nextSource);
            if (!nextOverlay || destroyed || observedVideo?.seeking || !canTranslateVideo()
              || requestGeneration !== generation || nextSource !== lastSource) continue;
            const result = typeof translated === 'string' ? translated.trim() : '';
            lastTranslatedSource = nextSource;
            lastTranslatedText = result;
            const shown = visibleTranslation(result, nextSource);
            const currentContainer = findCaptionContainer();
            if (!currentContainer || readCurrentCaptionText(currentContainer) !== nextSource) continue;
            if (isMediaSubtitlePage()) { renderSynchronizedXCaption(currentContainer, nextSource, result); continue; }
            if (!shown) continue;
            writeVideoCaptionText(nextOverlay, shown);
            syncTranslationOverlayPosition(currentContainer);
          } catch (error) {
            if (!destroyed && requestGeneration === generation) {
              if (isMediaSubtitlePage()) {
                const container = findCaptionContainer();
                if (container && readCurrentCaptionText(container) === nextSource) renderSynchronizedXCaption(container, nextSource);
                updatePlayerUiState();
              }
              console.warn('[FluentRead] 视频字幕翻译失败', error);
            }
          }
        }
      } finally {
        translationLoopRunning = false;
      }
    })();
  };

  const commitStableCaption = (source: string, overlay: HTMLElement, container: HTMLElement) => {
    if (destroyed || readCurrentCaptionText(container) !== source || source === lastSource) return;

    lastSource = source;
    ++generation;
    lastTranslatedSource = '';
    lastTranslatedText = '';
    writeVideoCaptionText(overlay, '');
    if (container.id === VIDEO_AI_CAPTION_CONTAINER_ID || isYouTubeVideoPage()) {
      const player = playerLocator.getTarget()?.player || (isYouTubeVideoPage() ? findVideoPlayer() : null);
      if (player) {
        renderHumanVideoCaption(player, container, isMediaSubtitlePage() ? '' : source, '');
        normalizedCaptionActive = true;
      }
    }
    const cached = videoTranslator.peek(source);
    if (cached !== undefined) {
      lastTranslatedSource = source;
      lastTranslatedText = cached;
      writeVideoCaptionText(overlay, visibleTranslation(cached, source));
      if (isMediaSubtitlePage()) renderSynchronizedXCaption(container, source, cached);
      pendingTranslationSource = '';
      pendingTranslationOverlay = null;
      syncTranslationOverlayPosition(container);
      return;
    }
    pendingTranslationSource = source;
    pendingTranslationOverlay = overlay;
    if (isMediaSubtitlePage()) renderSynchronizedXCaption(container, source);
    startTranslationLoop();
  };

  const scheduleStableCaption = (source: string, overlay: HTMLElement) => {
    if (stableCaptionTimer && stableCaptionSource === source) return;

    const startedAt = stableCaptionStartedAt ?? performance.now();
    cancelStableCaption();
    stableCaptionStartedAt = startedAt;
    stableCaptionSource = source;
    stableCaptionOverlay = overlay;
    stableCaptionTimer = setTimeout(() => {
      stableCaptionTimer = undefined;
      const nextSource = stableCaptionSource;
      const nextOverlay = stableCaptionOverlay;
      stableCaptionSource = '';
      stableCaptionOverlay = null;
      stableCaptionStartedAt = undefined;
      if (destroyed || !nextSource) return;

      const container = findCaptionContainer();
      const player = playerLocator.getTarget()?.player || (isYouTubeVideoPage() ? findVideoPlayer() : null);
      if (!container || !player || readCurrentCaptionText(container) !== nextSource) return;
      const currentOverlay = nextOverlay?.isConnected ? nextOverlay : getOrCreateTranslationOverlay(player);
      commitStableCaption(nextSource, currentOverlay, container);
    }, Math.min(VIDEO_CAPTION_STABILITY_MS, Math.max(0, VIDEO_CAPTION_MAX_WAIT_MS - (performance.now() - startedAt))));
  };

  const updateCaption = (syncedXContainer?: HTMLElement) => {
    if (destroyed) return;
    if (isYouTubeVideoPage() && observedVideo?.seeking) { resetTranslationState(); return; }

    const container = syncedXContainer || (isMediaSubtitlePage() ? syncXVideoCaptionSource() : null) || findCaptionContainer();
    if (!container) {
      captionObserver?.disconnect();
      captionObserver = undefined;
      observedContainer = null;
      resetTranslationState();
      return;
    }

    container.classList.add('notranslate');
    applyVideoDisplayState(container);
    const displayMode = normalizeVideoSubtitleDisplayMode(config.videoSubtitleDisplayMode);
    const player = playerLocator.getTarget()?.player || (isYouTubeVideoPage() ? findVideoPlayer() : null);
    if (!player) return;
    const source = readCurrentCaptionText(container);
    const compactYoutube = isYouTubeVideoPage() && (player.getBoundingClientRect().width <= 600 || window.matchMedia?.('(pointer: coarse)').matches === true);
    const canTranslate = config.on && config.videoTranslationEnabled && config.videoSubtitleVisible !== false && displayMode !== 'original-only';
    if (!canTranslate) {
      if (config.on && config.videoTranslationEnabled && config.videoSubtitleVisible !== false
        && displayMode === 'original-only') {
        if (!source) {
          resetTranslationState();
          if (hasAdjustedTimeline()) container.classList.add(VIDEO_NORMALIZED_CAPTION_CLASS);
          return;
        }
        const youtubeSelection = isYouTubeVideoPage() && !hasAdjustedTimeline()
          ? selectYoutubeCaptionCue(pretranslationCues, source, getCurrentVideoTimeMs()) : undefined;
        if (youtubeSelection?.stale) return resetTranslationState();
        // YouTube 的滚动字幕 DOM 可能只含当前句前缀；轨道与播放时间能确认时显示完整 cue。
        const original = youtubeSelection?.cue?.text || source;
        cancelStableCaption();
        if (original !== lastSource) {
          generation += 1;
          lastSource = original;
          lastTranslatedSource = '';
          lastTranslatedText = '';
          pendingTranslationSource = '';
          pendingTranslationOverlay = null;
          progressiveCueKey = '';
          progressiveCue = null;
          progressiveTranslation = '';
        }
        renderHumanVideoCaption(player, container, original, '');
        normalizedCaptionActive = true;
        return;
      }
      resetTranslationState();
      return;
    }

    const overlay = getOrCreateTranslationOverlay(player);

    if (!source) {
      resetTranslationState();
      // 手动校时的空档也属于调整后的时间轴，不能漏出未偏移的原生字幕。
      if (hasAdjustedTimeline()) container.classList.add(VIDEO_NORMALIZED_CAPTION_CLASS);
      return;
    }

    let youtubeSelection: YoutubeCueSelection | undefined;
    if (isYouTubeVideoPage() && !hasAdjustedTimeline()) {
      const cues = pretranslationCues, currentMs = getCurrentVideoTimeMs();
      youtubeSelection = {...selectYoutubeCaptionCue(cues, source, currentMs), cues, source, currentMs};
    }
    if (youtubeSelection?.stale) return resetTranslationState();
    const human = config.videoPreferHumanSubtitles && isYouTubeVideoPage()
      ? humanCaptions.at(getCurrentVideoTimeMs() - subtitleOffsetMs) : '';
    if (human) {
      const key = `${source}:${human}`;
      if (key !== humanCaptionKey) {
        resetTranslationState();
        videoTranslator.cancelPending();
        humanCaptionKey = key;
      }
      normalizedCaptionActive = true;
      renderHumanVideoCaption(player, container, source, visibleTranslation(human, source));
      return;
    }
    if (humanCaptionKey) resetTranslationState();
    if (updateProgressiveCaption(source, overlay, container, youtubeSelection)) return;

    if (progressiveCueKey) {
      clearProgressiveCaption();
      lastSource = '';
      lastTranslatedSource = '';
      lastTranslatedText = '';
      writeVideoCaptionText(overlay, '');
    }

    if (compactYoutube) {
      normalizedCaptionActive = true;
      renderHumanVideoCaption(player, container, source, lastTranslatedSource === source ? visibleTranslation(lastTranslatedText, source) : '');
    }
    if (source === lastSource) {
      syncTranslationOverlayPosition(container);
      const shown = lastTranslatedSource === source ? visibleTranslation(lastTranslatedText, source) : '';
      if (lastTranslatedSource === source && overlay.textContent !== shown) {
        writeVideoCaptionText(overlay, shown);
        syncTranslationOverlayPosition(container);
      }
      return;
    }

    if (isYouTubeVideoPage() && source !== stableCaptionSource) {
      resetTranslationState(true);
      renderHumanVideoCaption(player, container, source, '');
      normalizedCaptionActive = true;
    }

    // 短暂合并同一批词更新，但连续输出不能无限重置等待。
    // 仍由单个翻译循环合并为最新待译文本，旧请求不得写回新字幕。
    if (isMediaSubtitlePage() || videoTranslator.peek(source) !== undefined) commitStableCaption(source, overlay, container);
    else scheduleStableCaption(source, overlay);
  };

  // 原生字幕更新与清理在同一轮 DOM 变更内完成，请求的稳定等待单独处理。
  const scheduleUpdate = () => updateCaption();

  let captionFrame: number | undefined;
  let captionFrameVideo: HTMLVideoElement | null = null;
  let clockAdjustedCueKey = '';
  const stopCaptionClock = () => {
    if (captionFrame !== undefined) captionFrameVideo?.cancelVideoFrameCallback(captionFrame);
    captionFrame = undefined;
    captionFrameVideo = null;
    clockAdjustedCueKey = '';
  };
  const startCaptionClock = () => {
    const video = observedVideo as HTMLVideoElement | null;
    if (document.visibilityState === 'hidden' || !config.on || !config.videoTranslationEnabled || config.videoSubtitleVisible === false
      || !video || video.paused || video.ended || captionFrame !== undefined
      || (!isMediaSubtitlePage() && !hasAdjustedTimeline() && !progressiveCue)
      || typeof video.requestVideoFrameCallback !== 'function') return;
    captionFrameVideo = video;
    captionFrame = video.requestVideoFrameCallback(() => {
      captionFrame = undefined;
      if (destroyed || observedVideo !== video || !video.isConnected) return;
      if (hasAdjustedTimeline()) {
        const cue = getAdjustedCaptionCue();
        const key = cue ? getProgressiveCueKey(cue) : '';
        if (key !== clockAdjustedCueKey) { clockAdjustedCueKey = key; updateCaption(); }
      } else if (isMediaSubtitlePage()) {
        xCaptionSource.sync(updateCaption);
      } else if (progressiveCue && (video.currentTime * 1000 < progressiveCue.startMs
        || video.currentTime * 1000 >= progressiveCue.startMs + progressiveCue.durationMs)) {
        updateCaption();
      }
      startCaptionClock();
    });
  };

  const videoTimelineEventNames = ['timeupdate', 'seeking', 'seeked', 'emptied', 'loadedmetadata', 'resize', 'durationchange', 'play', 'pause', 'ended', 'ratechange'];
  const handleVideoTimelineEvent = (event: Event) => {
    const target = event.target as HTMLMediaElement | null;
    if (!target || !['VIDEO', 'AUDIO'].includes(target.tagName)) return;
    if (target !== observedVideo || event.type === 'loadedmetadata' || event.type === 'emptied') syncVideoElement();
    if (target !== observedVideo) return;
    if (isYouTubeVideoPage() && ['seeking', 'emptied', 'ended'].includes(event.type)) resetTranslationState();
    if (isMediaSubtitlePage()) syncXVideoCaptionSource();
    if (target.paused || target.ended) stopCaptionClock();
    else startCaptionClock();
    if (['loadedmetadata', 'seeked', 'play', 'ratechange'].includes(event.type)) ensurePretranslationTrack();
    schedulePretranslation(['loadedmetadata', 'seeked', 'play', 'ratechange'].includes(event.type));
    scheduleUpdate();
  };

  const handleVideoVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      stopCaptionClock();
      return;
    }
    // Safari 可能挂起后台页的时钟；回来时重读媒体身份、cue、画幅及菜单位置。
    syncPlayerUi();
    scheduleSubtitleLayout();

  };
  const handlePageShow = () => { syncPlayerUi(); scheduleSubtitleLayout(); };

  const observeCaptionContainer = () => {
    const container = findCaptionContainer();
    if (!container) {
      captionObserver?.disconnect();
      captionObserver = undefined;
      observedContainer = null;
      resetTranslationState();
      return;
    }
    if (container === observedContainer && container.isConnected) {
      applyVideoDisplayState(container);
      return;
    }

    captionObserver?.disconnect();
    observedContainer = container;
    container.classList.add('notranslate');
    applyVideoDisplayState(container);
    // 合成 AI 容器由 cue 和播放器时间事件直接驱动；观察并改写自己的
    // textContent 会形成约 120ms 一次的自触发循环。
    if (container.id !== VIDEO_AI_CAPTION_CONTAINER_ID) {
      captionObserver = new MutationObserver(scheduleUpdate);
      captionObserver.observe(container, { childList: true, subtree: true, characterData: true });
    }
    scheduleUpdate();
  };

  const syncPretranslationConfig = () => {
    const nextPretranslationConfigKey = getVideoTranslationConfigFingerprint(config);
    if (nextPretranslationConfigKey === pretranslationConfigKey) return;
    pretranslationConfigKey = nextPretranslationConfigKey;
    humanCaptions.clear();
    downloads.cancel();
    clearPretranslationState(false);
  };

  const syncPlayerUi = () => {
    if (destroyed) return;
    const nextVideoPageKey = getVideoPageKey();
    if (nextVideoPageKey !== videoPageKey && !isMediaSubtitlePage()) {
      videoPageKey = nextVideoPageKey;
      downloads.cancel();
      captionObserver?.disconnect();
      captionObserver = undefined;
      observedContainer = null;
      capturedSubtitleTracks.clear();
      xSubtitleLoader.reset();
      xSubtitleCues = [];
      clearPretranslationState(true);
      resetTranslationState();
    }
    videoPageKey = nextVideoPageKey;
    syncNativeCaptionVisibility();
    if (!isSupportedVideoPage() || !config.on) {
      humanCaptions.clear();
      observeSubtitleLayout(null, null);
      playerBinding?.sync();
      stopCaptionClock();
      xCaptionSource.restoreTracks();
      closeMenu();
      buttonElement = null;
      menuElement = null;
      removeTranslationOverlay();
      nativeFullscreen.sync();
      return;
    }
    syncPretranslationConfig();
    syncVideoElement();
    nativeFullscreen.sync();
    startCaptionClock();
    const layoutTarget = config.videoTranslationEnabled && config.videoSubtitleVisible !== false ? playerLocator.getTarget() : null;
    observeSubtitleLayout(layoutTarget?.player || null, layoutTarget?.video || null);
    ensurePretranslationTrack();
    syncXVideoCaptionSource();
    observeCaptionContainer();
    updatePlayerUiState();
    scheduleUpdate();
    schedulePretranslation();
    syncTranslationOverlayPosition(observedContainer);
  };

  playerBinding = createVideoPlayerBinding({
    locator: playerLocator,
    getState: () => ({enabled: !destroyed && config.on && config.videoTranslationEnabled && isSupportedVideoPage(), progress: null}),
    createButton: createPlayerButton,
    createMenu: target => createPlayerMenu(target.player),
  });
  const unsubscribePlayer = playerLocator.subscribe(() => syncPlayerUi());
  document.addEventListener('click', handleDocumentClick, true);
  document.addEventListener('keydown', handleDocumentKeydown, true);
  document.addEventListener('visibilitychange', handleVideoVisibilityChange);
  document.addEventListener('fullscreenchange', scheduleSubtitleLayout);
  window.addEventListener('resize', scheduleSubtitleLayout);
  window.addEventListener('orientationchange', scheduleSubtitleLayout);
  window.addEventListener('pageshow', handlePageShow);
  window.visualViewport?.addEventListener('resize', scheduleSubtitleLayout);
  window.visualViewport?.addEventListener('scroll', scheduleSubtitleLayout);
  videoTimelineEventNames.forEach((eventName) => document.addEventListener(eventName, handleVideoTimelineEvent, true));
  window.addEventListener('message', handleTimedTextMessage);
  window.addEventListener('message', handleXSubtitleResourceMessage);
  syncPlayerUi();
  if (isYouTubeVideoPage()) document.dispatchEvent(new CustomEvent(YOUTUBE_BRIDGE_REPLAY_EVENT));
  uiSyncTimer = window.setInterval(syncPlayerUi, 1000);

  let previousDisplayMode = normalizeVideoSubtitleDisplayMode(config.videoSubtitleDisplayMode);
  const unsubscribeConfig = subscribeConfig((nextConfig) => {
    const nextDisplayMode = normalizeVideoSubtitleDisplayMode(nextConfig.videoSubtitleDisplayMode);
    if (nextDisplayMode !== previousDisplayMode) {
      previousDisplayMode = nextDisplayMode;
      resetTranslationState();
    }
    const nextOffset = normalizeVideoSubtitleOffsetMs(nextConfig.videoSubtitleOffsetMs);
    if (nextOffset !== subtitleOffsetMs) {
      subtitleOffsetMs = nextOffset;
      resetTranslationState();
      schedulePretranslation();
    }
    if (nextConfig.videoSourceLanguage !== activeVideoLanguage) {
      xSubtitleLoader.reset();
      xSubtitleCues = [];
      capturedSubtitleTracks.clear();
      clearPretranslationState(true);
      if (isMediaSubtitlePage()) document.dispatchEvent(new CustomEvent(YOUTUBE_BRIDGE_REPLAY_EVENT));
      activeVideoLanguage = nextConfig.videoSourceLanguage;
    }
    syncPretranslationConfig();
    syncPlayerUi();
    karaoke.sync();
    if (observedContainer) {
      applyVideoDisplayState(observedContainer);
      syncTranslationOverlayPosition(observedContainer);
    }
    if (!nextConfig.on || !nextConfig.videoTranslationEnabled || nextConfig.videoSubtitleVisible === false || nextDisplayMode === 'original-only') {
      humanCaptions.clear();
      if (!nextConfig.on || !nextConfig.videoTranslationEnabled) downloads.cancel();
      clearPretranslationState(false, true);
      resetTranslationState();
      if (nextConfig.on && nextConfig.videoTranslationEnabled && nextConfig.videoSubtitleVisible !== false) scheduleUpdate();
      return;
    }
    observeCaptionContainer();
    scheduleUpdate();
  });

  return () => {
    destroyed = true;
    karaoke.destroy();
    nativeCaptionVisibility.destroy();
    humanCaptions.clear();
    downloads.destroy();
    nativeFullscreen.destroy();
    unsubscribePlayer();
    if (menuElement) setVideoMenuDownloadStatus(menuElement, '');
    playerBinding?.destroy();
    playerLocator.destroy();
    htmlMediaHost?.destroy();
    xSubtitleLoader.reset();
    pretranslationController.destroy();
    videoTranslator.clear();
    generation += 1;
    pendingTranslationSource = '';
    pendingTranslationOverlay = null;
    if (mediaMissingTimer) clearTimeout(mediaMissingTimer);
    cancelStableCaption();
    clearPretranslationState(true);
    stopCaptionClock();
    xCaptionSource.restoreTracks();
    observedVideo = null;
    if (uiSyncTimer !== undefined) window.clearInterval(uiSyncTimer);
    captionObserver?.disconnect();
    subtitleLayout.destroy();
    unsubscribeConfig();
    document.removeEventListener('click', handleDocumentClick, true);
    document.removeEventListener('keydown', handleDocumentKeydown, true);
    document.removeEventListener('visibilitychange', handleVideoVisibilityChange);
    document.removeEventListener('fullscreenchange', scheduleSubtitleLayout);
    window.removeEventListener('resize', scheduleSubtitleLayout);
    window.removeEventListener('orientationchange', scheduleSubtitleLayout);
    window.removeEventListener('pageshow', handlePageShow);
    window.visualViewport?.removeEventListener('resize', scheduleSubtitleLayout);
    window.visualViewport?.removeEventListener('scroll', scheduleSubtitleLayout);
    videoTimelineEventNames.forEach((eventName) => document.removeEventListener(eventName, handleVideoTimelineEvent, true));
    window.removeEventListener('message', handleTimedTextMessage);
    window.removeEventListener('message', handleXSubtitleResourceMessage);
    document.getElementById(VIDEO_AI_CAPTION_CONTAINER_ID)?.remove();
    closeMenu();
    document.querySelectorAll(`#${VIDEO_TRANSLATION_BUTTON_ID}, #${VIDEO_TRANSLATION_MENU_ID}`).forEach((node) => node.remove());
    removeTranslationOverlay();
    document.querySelectorAll(VIDEO_CAPTION_CONTAINER_SELECTOR).forEach((node) => {
      node.classList.remove('notranslate', VIDEO_DISPLAY_TRANSLATION_ONLY_CLASS, VIDEO_DISPLAY_ORIGINAL_ONLY_CLASS, VIDEO_DISPLAY_HIDDEN_CLASS, VIDEO_NORMALIZED_CAPTION_CLASS);
      node.removeAttribute('data-fluent-read-video-display-mode');
    });
    style.remove();
  };
}
