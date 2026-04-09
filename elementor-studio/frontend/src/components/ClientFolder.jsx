import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function ClientFolder({ client, index }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const statusColor = {
    deployed: '#10b981',
    ready: '#3b82f6',
    converting: '#f59e0b',
    error: '#ef4444',
  };

  const lastEdited = client.last_edited
    ? new Date(client.last_edited).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Never';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      whileHover={{ y: -4, scale: 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => navigate(`/editor/${client.id}`)}
      style={{
        background: '#fff',
        borderRadius: 20,
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isHovered ? 'rgba(59,130,246,0.3)' : 'rgba(0,0,0,0.06)',
        boxShadow: isHovered
          ? '0 20px 60px rgba(59,130,246,0.12), 0 4px 16px rgba(0,0,0,0.06)'
          : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* Header gradient bar */}
      <div style={{
        height: 4,
        background: isHovered
          ? 'linear-gradient(90deg, #3b82f6, #1d4ed8, #3b82f6)'
          : 'linear-gradient(90deg, #e5e7eb, #d1d5db)',
        backgroundSize: '200% 100%',
        animation: isHovered ? 'gradient-shift 3s ease infinite' : 'none',
        transition: 'background 0.3s',
      }} />

      <div style={{ padding: 24 }}>
        {/* Client avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <motion.div
            animate={{ rotate: isHovered ? 5 : 0 }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
            }}
          >
            {client.name?.charAt(0)?.toUpperCase() || '?'}
          </motion.div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#111827',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {client.name}
            </div>
            {client.website_url && (
              <div style={{
                fontSize: 12,
                color: '#9ca3af',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: 2,
              }}>
                {client.website_url.replace(/https?:\/\//, '').replace(/\/$/, '')}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: 16,
          fontSize: 12,
          color: '#6b7280',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>◎</span>
            <span>{client.page_count || 0} pages</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>◷</span>
            <span>{lastEdited}</span>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 500,
            color: statusColor[client.status] || '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColor[client.status] || '#d1d5db',
            }} />
            {client.status || 'Active'}
          </div>

          <motion.div
            animate={{ x: isHovered ? 4 : 0, opacity: isHovered ? 1 : 0.4 }}
            style={{
              fontSize: 18,
              color: '#3b82f6',
            }}
          >
            →
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
