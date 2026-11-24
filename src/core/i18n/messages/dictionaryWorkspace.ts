/**
 * @file src/core/i18n/messages/dictionaryWorkspace.ts
 * 文件职责：提供精简版固定简体中文环境下的兼容文案目录引用，供基础中文消息表静态合并。
 * 主要内容：仅导入并导出 dictionary-workspace/zh-CN.json 简体中文消息映射，不再引入其余六国语言 JSON 资源以减小扩展体积。
 * 模块边界：本文件仅包含静态界面文案导出，不读取用户配置、不修改运行时状态，也不访问浏览器存储或 DOM。
 */
import chinese from './dictionary-workspace/zh-CN.json';
export const dictionaryWorkspaceChineseMessages = chinese;
