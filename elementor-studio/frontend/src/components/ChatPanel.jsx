import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const quickActions = [
  { label: 'Change colors', icon: '🎨' },
  { label: 'Edit text', icon: '✏' },
  { label: 'Add section', icon: '+' },
  { label: 'Fix mobile', icon: '📱' },
];

export default function ChatPanel({ clientId, pageId, clientName, siteUrl, onUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, [clientId, pageId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchHistory() {
    try {
      const url = pageId
        ? `/api/editor/history/${clientId}?pageId=${pageId}`
        : `/api/editor/history/${clientId}`;
      const res = await fetch(url);
      const data = await res.json();
      setMessages(data);
    } catch { /* no history yet */ }
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/editor/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, pageId, message: text }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.description,
          patch_json: data.patches,
          created_at: new Date().toISOString(),
        }]);
        onUpdate?.();
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error || 'Something went wrong. Please try again.',
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Network error. Please check your connection.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #f3f4f6',
        background: '#fff',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
          {clientName || 'Editor'}
        </div>
        {siteUrl && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '')}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: 14,
            marginTop: 40,
            padding: '0 20px',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>
              Start editing
            </div>
            <div style={{ fontSize: 13 }}>
              Tell me what you'd like to change on the site
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '85%',
                padding: '10px 16px',
                borderRadius: msg.role === 'user'
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                  : '#f3f4f6',
                color: msg.role === 'user' ? '#fff' : '#374151',
                fontSize: 14,
                lineHeight: 1.5,
                boxShadow: msg.role === 'user'
                  ? '0 2px 8px rgba(59,130,246,0.25)'
                  : 'none',
              }}>
                {msg.content}

                {msg.patch_json && Array.isArray(msg.patch_json) && msg.patch_json.length > 0 && (
                  <div style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: `1px solid ${msg.role === 'user' ? 'rgba(255,255,255,0.2)' : '#e5e7eb'}`,
                    fontSize: 11,
                    color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                  }}>
                    ✓ {msg.patch_json.length} change{msg.patch_json.length > 1 ? 's' : ''} applied
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', gap: 4, padding: '8px 0' }}
          >
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#3b82f6',
                }}
              />
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '0 16px 8px',
        overflowX: 'auto',
      }}>
        {quickActions.map(action => (
          <motion.button
            key={action.label}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => sendMessage(action.label)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid #e5e7eb',
              background: '#fff',
              fontSize: 12,
              color: '#6b7280',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {action.icon} {action.label}
          </motion.button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px 16px',
        borderTop: '1px solid #f3f4f6',
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          background: '#f9fafb',
          borderRadius: 16,
          padding: '4px 4px 4px 16px',
          border: '1px solid #e5e7eb',
          alignItems: 'center',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="What would you like to change?"
            disabled={loading}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              color: '#374151',
            }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: 'none',
              background: input.trim()
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : '#e5e7eb',
              color: input.trim() ? '#fff' : '#9ca3af',
              fontSize: 16,
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            ↑
          </motion.button>
        </div>
      </div>
    </div>
  );
}
