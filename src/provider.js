function completionUrl(baseUrl) {
  return baseUrl.endsWith('/v1')
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;
}

async function requestOpenAICompatible(config, payload) {
  if (!config.apiKey) {
    const error = new Error('请设置 AI_API_KEY 环境变量');
    error.status = 400;
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(completionUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: payload.messages,
        max_tokens: config.maxTokens,
        ...(payload.tools?.length ? { tools: payload.tools, tool_choice: payload.toolChoice || 'auto' } : {}),
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      const error = new Error(`模型接口返回了非 JSON 内容（HTTP ${response.status}）`);
      error.status = 502;
      throw error;
    }

    if (!response.ok) {
      const message = data?.error?.message || data?.message || `模型接口失败（HTTP ${response.status}）`;
      const error = new Error(message);
      error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
      throw error;
    }

    const message = data?.choices?.[0]?.message;
    if (!message) {
      const error = new Error('模型接口没有返回 choices[0].message');
      error.status = 502;
      throw error;
    }
    return { message, raw: data };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeout = new Error('模型接口请求超时');
      timeout.status = 504;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { requestOpenAICompatible };
