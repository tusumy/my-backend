# my-backend

A small personal-AI gateway. The design borrows the useful boundary ideas from Elementera Coast without copying its full application: the chat client is only a window; context assembly, provider access and tools live behind one backend contract.

The existing `tianzhi-service/` is intentionally separate and remains independently deployable.

## Layout

```text
server.js               HTTP routes only
src/config.js           environment/config
src/context.js          one context-assembly path
src/provider.js         OpenAI-compatible provider adapter
src/tools.js            single backend/model tool registry
src/chat.js             model + tool loop
tianzhi-service/        standalone Python tianzhi-core API + MCP
```

## Endpoints

- `GET /health`
- `GET /api/status`
- `GET /api/tools`
- `POST /api/context/preview`
- `POST /api/chat`

`POST /api/chat` stays compatible with the old `{ "messages": [...] }` request. It now also accepts:

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "context": {
    "system": "optional system text",
    "customInstructions": "optional owner instructions",
    "thinkingSoil": "current conversation working context",
    "memories": ["confirmed memory only"],
    "worldbook": ["matched world-book entry"],
    "workbenchNote": "optional one-turn note"
  },
  "enableTools": true,
  "toolChoice": "auto"
}
```

The backend does not pretend to have persistence yet. `memories`, `worldbook` and `thinkingSoil` are explicit inputs supplied by a future storage layer/client. Pending memory candidates should not be passed as confirmed memories.

## Built-in tools

The first registered tool provider is the standalone Tianzhi service:

- `tianzhi_bazi_chart`
- `tianzhi_bazi_analysis`
- `tianzhi_bazi_year`

When the selected OpenAI-compatible model supports tool calling, `/api/chat` can advertise these tools, execute the HTTP call against Tianzhi, append the tool result, and let the model produce the final natural-language response.

## Environment

```bash
AI_API_KEY=...
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
AI_MAX_TOKENS=2048
AI_TIMEOUT_MS=60000
AI_MAX_TOOL_ROUNDS=4
SYSTEM_PROMPT=
CORS_ORIGIN=*
TIANZHI_API_URL=https://tianzhi-core-api.onrender.com
```

`AI_BASE_URL` may be either a provider root or a URL ending in `/v1`.

## Run

```bash
npm install
npm run check
npm start
```
