const TOOL_DEFS = [
  {
    key: 'tianzhi.bazi_chart',
    displayName: '天秩 · 八字排盘',
    modelName: 'tianzhi_bazi_chart',
    description: '按出生时间、经度和性别计算确定性的八字排盘。',
    endpoint: '/v1/bazi/chart',
    required: ['birth'],
  },
  {
    key: 'tianzhi.bazi_analysis',
    displayName: '天秩 · 八字分析',
    modelName: 'tianzhi_bazi_analysis',
    description: '计算八字、旺衰、五行力量、十神力量、格局、调候和喜用神。',
    endpoint: '/v1/bazi/analysis',
    required: ['birth'],
  },
  {
    key: 'tianzhi.bazi_year',
    displayName: '天秩 · 流年评分',
    modelName: 'tianzhi_bazi_year',
    description: '计算指定流年对原局的相对作用；可选传入当前大运干支。',
    endpoint: '/v1/bazi/year',
    required: ['birth', 'year_ganzhi'],
  },
];

function parameterSchema(required = []) {
  return {
    type: 'object',
    properties: {
      birth: { type: 'string', description: '出生时间，ISO 8601，例如 2002-01-01T12:30:00' },
      longitude: { type: 'number', minimum: -180, maximum: 180, default: 0 },
      gender: { type: 'integer', enum: [0, 1], default: 0, description: '0 男，1 女' },
      use_true_solar: { type: 'boolean', default: true },
      late_zi: { type: 'string', enum: ['next_day', 'same_day'], default: 'next_day' },
      year_ganzhi: { type: 'string', minLength: 2, maxLength: 2, description: '流年干支，例如 丙午' },
      dayun_ganzhi: { type: ['string', 'null'], minLength: 2, maxLength: 2, description: '可选大运干支' },
    },
    required,
    additionalProperties: false,
  };
}

function listBackendTools() {
  return TOOL_DEFS.map((tool) => ({
    key: tool.key,
    displayName: tool.displayName,
    modelName: tool.modelName,
    description: tool.description,
  }));
}

function modelTools() {
  return TOOL_DEFS.map((tool) => ({
    type: 'function',
    function: {
      name: tool.modelName,
      description: tool.description,
      parameters: parameterSchema(tool.required),
    },
  }));
}

async function postJson(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) {
      throw new Error(data?.detail || data?.error || `工具接口失败（HTTP ${response.status}）`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function executeTool(config, toolCall) {
  const name = toolCall?.function?.name || toolCall?.name;
  const descriptor = TOOL_DEFS.find((tool) => tool.modelName === name);
  if (!descriptor) throw new Error(`未知工具：${name || '(empty)'}`);

  let args = toolCall?.function?.arguments ?? toolCall?.arguments ?? {};
  if (typeof args === 'string') {
    try { args = JSON.parse(args || '{}'); }
    catch { throw new Error(`${name} 的 arguments 不是合法 JSON`); }
  }

  for (const key of descriptor.required) {
    if (args?.[key] === undefined || args?.[key] === null || args?.[key] === '') {
      throw new Error(`${name} 缺少必填参数 ${key}`);
    }
  }

  const output = await postJson(`${config.tianzhiApiUrl}${descriptor.endpoint}`, args);
  return {
    toolKey: descriptor.key,
    displayName: descriptor.displayName,
    output,
  };
}

module.exports = { listBackendTools, modelTools, executeTool };
