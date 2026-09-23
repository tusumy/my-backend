const express = require('express');
const cors = require('cors');
const { getConfig } = require('./src/config');
const { assembleContext } = require('./src/context');
const { listBackendTools } = require('./src/tools');
const { runChat } = require('./src/chat');

const config = getConfig();
const app = express();

app.disable('x-powered-by');
app.use(cors({
  origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  credentials: false,
}));
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({
    name: 'my-backend',
    status: 'ok',
    architecture: 'thin-gateway',
    endpoints: ['/health', '/api/status', '/api/tools', '/api/context/preview', '/api/chat'],
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/status', (_req, res) => {
  res.json({
    status: 'ok',
    provider: {
      baseUrl: config.ai.baseUrl,
      model: config.ai.model,
      configured: Boolean(config.ai.apiKey),
    },
    tianzhi: { apiUrl: config.tianzhiApiUrl },
    tools: listBackendTools(),
  });
});

app.get('/api/tools', (_req, res) => {
  res.json({ backendTools: listBackendTools() });
});

app.post('/api/context/preview', (req, res, next) => {
  try {
    const assembled = assembleContext(req.body?.messages || [], req.body?.context || {}, config.systemPrompt);
    res.json(assembled);
  } catch (error) {
    next(error);
  }
});

app.post('/api/chat', async (req, res, next) => {
  try {
    if (!Array.isArray(req.body?.messages)) {
      return res.status(400).json({ error: 'messages 必须是数组' });
    }
    const result = await runChat(config, req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number.isInteger(error?.status) ? error.status : 500;
  res.status(status).json({ error: error?.message || '后端请求失败' });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`my-backend listening on ${config.port}`);
});
