/**
 * @file src/features/video-subtitle/content/subtitleTransport.ts
 * 文件职责：为 X 与 YouTube 的字幕读取提供有界网络与响应流读取生命周期。
 * 主要内容：十五秒总预算覆盖响应头及全部正文，按字节上限拒绝大响应；外部取消保留原因并回收未读正文。
 * 模块边界：只获取字幕文本，不解析或选择轨道、不提交字幕。
 */
import {cancelUnreadResponseBody} from '@/src/platform/http/runtime';

type CaptionRequest = (url: string, init: {signal: AbortSignal; credentials: RequestCredentials}) => Promise<Response>;
interface CaptionRequestOptions {
    signal?: AbortSignal;
    credentials: RequestCredentials;
    maxBytes?: number;
}

async function readBoundedResponse(response: Response, limit: number, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
    if (!response.ok || Number(response.headers.get('content-length')) > limit) {
        cancelUnreadResponseBody(response);
        throw new Error('字幕响应无效或过大');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('字幕响应为空');
    const chunks: Uint8Array[] = [];
    let length = 0;
    const cancel = () => { void reader.cancel().catch(() => undefined); };
    signal.addEventListener('abort', cancel, {once: true});
    try {
        while (!signal.aborted) {
            const part = await reader.read();
            if (part.done) break;
            length += part.value.length;
            if (length > limit) throw new Error('字幕响应超过读取上限');
            chunks.push(part.value);
        }
        if (signal.aborted) throw new Error('字幕读取已取消');
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return bytes;
    } finally {
        signal.removeEventListener('abort', cancel);
        cancel();
        reader.releaseLock();
    }
}

export async function readVideoCaptionText(url: string, request: CaptionRequest, options: CaptionRequestOptions): Promise<string> {
    options.signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal!.reason);
    const canceled = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {once: true});
    });
    options.signal?.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(() => controller.abort(new DOMException('字幕资源读取超时', 'TimeoutError')), 15_000);
    try {
        const work = (async () => {
            const response = await request(url, {signal: controller.signal, credentials: options.credentials});
            if (controller.signal.aborted) {
                cancelUnreadResponseBody(response);
                controller.signal.throwIfAborted();
            }
            if (!response.ok) {
                cancelUnreadResponseBody(response);
                throw new Error(`字幕轨道请求失败（${response.status}）`);
            }
            return new TextDecoder().decode(await readBoundedResponse(response, options.maxBytes ?? 8_000_000, controller.signal));
        })();
        return await Promise.race([work, canceled]);
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        controller.abort();
    }
}
