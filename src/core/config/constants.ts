/**
 * @file src/core/config/constants.ts
 *
 * 文件职责：集中声明配置领域中跨模块复用的端点、请求方式、显示模式和连接测试消息等稳定常量。
 * 主要内容：仅为保留的 DeepSeek、OpenRouter 与自定义接口维护默认端点，并导出 HTTP 方法常量与双语模式编号。
 * 模块边界：本文件属于 core 领域层，只定义纯常量；不直接读写浏览器存储、不发起网络请求。
 */

import {services} from './catalog';

export const urls: Record<string, string> = {
    [services.custom]: 'http://localhost:11434/v1/chat/completions',
    [services.deepseek]: 'https://api.deepseek.com/chat/completions',
    [services.openrouter]: 'https://openrouter.ai/api/v1/chat/completions',
};

export const method = {POST: 'POST', GET: 'GET'};

export const CONNECTION_TEST_MESSAGE = 'testTranslationService' as const;

export const constants = {
    DoubleClick: 'DoubleClick',
    LongPress: 'LongPress',
    MiddleClick: 'MiddleClick',
    TwoFinger: 'TwoFinger',
    ThreeFinger: 'ThreeFinger',
    FourFinger: 'FourFinger',
    DoubleClickScreen: 'DoubleClickScree',
    TripleClickScreen: 'TripleClickScreen',
};

export const styles = {
    singleTranslation: 0,
    bilingualTranslation: 1,
};
