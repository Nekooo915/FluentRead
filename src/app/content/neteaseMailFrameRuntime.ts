/**
 * @file src/app/content/neteaseMailFrameRuntime.ts
 * 文件职责：为网易邮件正文入口装配共享邮件全文翻译运行时。
 * 主要内容：复用 qqMailFrameRuntime 的受限正文 frame 全文翻译生命周期。
 * 模块边界：只负责应用接线，不改变邮件授权、配置或清理逻辑。
 */
import type {ContentScriptContext} from 'wxt/utils/content-script-context';
import {startNeteaseMailFrameApp as startMailFrame} from './qqMailFrameRuntime';

export function startNeteaseMailFrameApp(ctx: ContentScriptContext): Promise<void> {
    return startMailFrame(ctx);
}
