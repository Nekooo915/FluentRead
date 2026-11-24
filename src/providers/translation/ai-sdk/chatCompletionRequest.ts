/**
 * @file src/providers/translation/ai-sdk/chatCompletionRequest.ts
 * 文件职责：在最终 Chat Completions 请求边界统一输出 token 上限的协议兼容。
 * 主要内容：官方 OpenAI 端点采用现行 max_completion_tokens 字段，其他兼容请求保留 max_tokens；显式新字段优先并清理冲突字段。
 * 模块边界：只转换请求值，不选择模型或发起网络请求。
 */

export function normalizeChatCompletionRequest(endpoint: string, body: Record<string, unknown>, _service?: string): Record<string, unknown> {
  const url = new URL(endpoint);
  const officialChat = url.origin === 'https://api.openai.com'
    && url.pathname.replace(/\/$/u, '') === '/v1/chat/completions';
  const result = {...body};
  const completionLimit = body.max_completion_tokens;
  const legacyLimit = body.max_tokens;
  const modern = officialChat || completionLimit != null;
  const limit = completionLimit ?? legacyLimit;
  delete result.max_tokens;
  delete result.max_completion_tokens;
  if (limit != null) result[modern ? 'max_completion_tokens' : 'max_tokens'] = limit;
  return result;
}
