const { assembleContext } = require('./context');
const { requestOpenAICompatible } = require('./provider');
const { modelTools, executeTool } = require('./tools');

async function runChat(config, input) {
  const assembled = assembleContext(input.messages, input.context || {}, config.systemPrompt);
  const conversation = [...assembled.messages];
  const toolRuns = [];
  const toolsEnabled = input.enableTools !== false;
  const advertisedTools = toolsEnabled ? modelTools() : [];

  for (let round = 0; round <= config.ai.maxToolRounds; round += 1) {
    const { message } = await requestOpenAICompatible(config.ai, {
      messages: conversation,
      tools: advertisedTools,
      toolChoice: input.toolChoice || 'auto',
    });

    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) {
      return {
        reply: typeof message.content === 'string' ? message.content : '',
        message,
        toolRuns,
        contextReceipt: assembled.receipt,
      };
    }

    if (!toolsEnabled) throw new Error('模型请求了工具，但本次请求禁用了工具');
    if (round === config.ai.maxToolRounds) throw new Error('工具调用轮次超过上限');

    conversation.push(message);
    for (const call of calls) {
      try {
        const result = await executeTool(config, call);
        toolRuns.push({
          id: call.id || null,
          tool: result.toolKey,
          displayName: result.displayName,
          status: 'success',
        });
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result.output),
        });
      } catch (error) {
        toolRuns.push({
          id: call.id || null,
          tool: call?.function?.name || call?.name || 'unknown',
          status: 'error',
          error: error.message,
        });
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error: error.message }),
        });
      }
    }
  }

  throw new Error('聊天循环意外结束');
}

module.exports = { runChat };
