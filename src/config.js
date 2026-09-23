function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function intEnv(name, fallback) {
  const n = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getConfig() {
  return {
    port: intEnv('PORT', 3000),
    ai: {
      apiKey: process.env.AI_API_KEY || '',
      baseUrl: cleanBaseUrl(process.env.AI_BASE_URL || 'https://api.deepseek.com'),
      model: process.env.AI_MODEL || 'deepseek-chat',
      maxTokens: intEnv('AI_MAX_TOKENS', 2048),
      timeoutMs: intEnv('AI_TIMEOUT_MS', 60000),
      maxToolRounds: intEnv('AI_MAX_TOOL_ROUNDS', 4),
    },
    corsOrigins: String(process.env.CORS_ORIGIN || '*')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    systemPrompt: process.env.SYSTEM_PROMPT || '',
    tianzhiApiUrl: cleanBaseUrl(
      process.env.TIANZHI_API_URL || 'https://tianzhi-core-api.onrender.com'
    ),
  };
}

module.exports = { getConfig };
