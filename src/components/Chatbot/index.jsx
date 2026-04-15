import React, { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  { label: 'Get started', query: 'How do I get started with STREAMINGPLUS?' },
  { label: 'Kafka source', query: 'How do I connect a Kafka source?' },
  { label: 'Deploy to K8s', query: 'How do I deploy to Kubernetes?' },
  { label: 'CLI reference', query: 'Show me the sp CLI commands' },
];

function renderMarkdown(text) {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${escHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function escHtml(s) {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 Hi! I'm the STREAMINGPLUS AI assistant. Ask me anything about the platform.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setHasApiKey(d.hasApiKey))
      .catch(() => setHasApiKey(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text) {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMsg }],
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || data.error }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error — is the server running?' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chatbot-wrapper">
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <div>
              <div className="chatbot-name">AI Assistant</div>
              <div className="chatbot-subtitle">Powered by Claude · Knows the docs</div>
            </div>
            <button
              onClick={() => setMessages([{ role: 'assistant', content: "👋 Hi! I'm the STREAMINGPLUS AI assistant. Ask me anything about the platform." }])}
              title="Clear conversation"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.6 }}
            >
              🗑
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <div
                  className="chat-msg-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
              </div>
            ))}
            {loading && (
              <div className="chat-msg assistant">
                <div className="chat-msg-content" style={{ opacity: 0.6 }}>Thinking…</div>
              </div>
            )}
            {!hasApiKey && (
              <div className="chat-msg assistant">
                <div className="chat-msg-content" style={{ color: 'var(--ifm-color-warning)' }}>
                  ⚠️ No API key configured. Set <code>ANTHROPIC_API_KEY</code> in <code>.env</code> to enable the AI assistant.
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s.label}
                  onClick={() => send(s.query)}
                  style={{
                    background: 'var(--ifm-color-emphasis-100)',
                    border: '1px solid var(--ifm-color-emphasis-300)',
                    borderRadius: 20,
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    color: 'var(--ifm-font-color-base)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="chatbot-input-area">
            <div className="chatbot-input-row">
              <input
                className="chatbot-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Ask anything about STREAMINGPLUS…"
                disabled={loading || !hasApiKey}
              />
              <button
                className="chatbot-send"
                onClick={() => send()}
                disabled={loading || !input.trim() || !hasApiKey}
              >
                ➤
              </button>
            </div>
            <p className="chatbot-disclaimer">AI may make mistakes. Always verify critical information.</p>
          </div>
        </div>
      )}

      <button className="chatbot-fab" onClick={() => setOpen(o => !o)} aria-label="Toggle AI assistant">
        {open ? '✕' : '💬'} <span className="fab-label">{open ? 'Close' : 'Ask AI'}</span>
      </button>
    </div>
  );
}
