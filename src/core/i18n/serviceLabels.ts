/**
 * @file src/core/i18n/serviceLabels.ts
 * 文件职责：保留精简版服务名称本地化覆写的兼容纯函数边界，固定简体中文界面无需按语种动态覆写服务名。
 * 主要内容：导出 translateServiceLabel 空实现并始终返回 undefined，让上层直接沿用服务目录中的默认中文名称与元数据。
 * 模块边界：本文件属于 core i18n 纯逻辑层，不持有可变状态、不访问浏览器存储或 DOM，也不引入各供应商实现。
 */
import type {UiLanguage} from './types';

export function translateServiceLabel(_value: string, _language: UiLanguage): string | undefined {
    return undefined;
}
