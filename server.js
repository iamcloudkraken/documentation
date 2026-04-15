const express = require('express');
const { readFileSync, existsSync } = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Load docs as AI context
const llmsPath = path.join(__dirname, 'static', 'llms-full.txt');
const fallbackPath = path.join(__dirname, '..', 'documentation', 'llms-full.txt');
const docsContext = existsSync(llmsPath)
  ? readFileSync(llmsPath, 'utf-8').slice(0, 12000)
  : existsSync(fallbackPath)
    ? readFileSync(fallbackPath, 'utf-8').slice(0, 12000)
    : 'Documentation not available.';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'build')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', hasApiKey: !!ANTHROPIC_API_KEY });
});

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'AI assistant is not configured. Add ANTHROPIC_API_KEY to your .env file.',
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const systemPrompt = `You are an AI documentation assistant for STREAMINGPLUS, a cloud-native streaming infrastructure platform. Help users understand and use the platform effectively.

Full documentation context:
---
${docsContext}
---

Guidelines:
- Answer accurately based on the documentation above.
- Provide working code examples in bash, YAML, or Python when helpful.
- Keep answers concise and actionable. Use bullet points for steps.
- Format code blocks with triple backticks and language tags.
- If unsure, say so rather than guessing.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.slice(-10),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Anthropic API error:', response.status, text);
      return res.status(response.status).json({ error: `API error: ${response.status}` });
    }

    const data = await response.json();
    res.json({ content: data.content[0]?.text || '' });
  } catch (err) {
    console.error('Chat proxy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 STREAMINGPLUS Docs at http://localhost:${PORT}`);
  console.log(`   AI Assistant: ${ANTHROPIC_API_KEY ? '✅ enabled' : '⚠️  disabled (add ANTHROPIC_API_KEY to .env)'}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
