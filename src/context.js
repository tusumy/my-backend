function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function listText(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return text(item.content || item.text || item.value || item.summary);
      }
      return '';
    })
    .filter(Boolean);
}

function addBlock(blocks, label, value) {
  const body = text(value);
  if (body) blocks.push({ label, body });
}

function addListBlock(blocks, label, value) {
  const rows = listText(value);
  if (rows.length) blocks.push({ label, body: rows.map((v) => `- ${v}`).join('\n') });
}

function assembleContext(messages, context = {}, baseSystemPrompt = '') {
  if (!Array.isArray(messages)) throw new TypeError('messages 必须是数组');

  const blocks = [];
  addBlock(blocks, 'system', context.system || baseSystemPrompt);
  addBlock(blocks, 'custom_instructions', context.customInstructions);
  addBlock(blocks, 'thinking_soil', context.thinkingSoil);
  addListBlock(blocks, 'confirmed_memories', context.memories);
  addListBlock(blocks, 'worldbook', context.worldbook);
  addBlock(blocks, 'workbench_note', context.workbenchNote);

  const systemMessages = blocks.map((block) => ({
    role: 'system',
    content: `[${block.label}]\n${block.body}`,
  }));

  return {
    messages: [...systemMessages, ...messages],
    receipt: {
      blocks: blocks.map((b) => b.label),
      blockCount: blocks.length,
      inputMessageCount: messages.length,
      assembledMessageCount: systemMessages.length + messages.length,
    },
  };
}

module.exports = { assembleContext };
