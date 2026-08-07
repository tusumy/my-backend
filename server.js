const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

async function callAI(messages, apiKey, baseURL, model) {
  const response = await fetch(`${baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 1024,
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const apiKey = process.env.AI_API_KEY;
    const baseURL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
    const model = process.env.AI_MODEL || 'deepseek-chat';

    if (!apiKey) {
      return res.status(400).json({ error: '请设置 AI_API_KEY 环境变量' });
    }

    const reply = await callAI(messages, apiKey, baseURL, model);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI接口调用失败' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务已启动，端口 ${PORT}`);
});
