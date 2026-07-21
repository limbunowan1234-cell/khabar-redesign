'use client';
import { useState } from 'react';
import WeatherWidget from '@/components/WeatherWidget';
import WeatherWarning from '@/components/WeatherWarning';

export default function WeatherStrip({ isDarkMode }: { isDarkMode?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '10px 16px',
          backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
          border: '1px solid ' + (isDarkMode ? '#2a2a2a' : '#eee'),
          borderLeft: '3px solid #c41e3a',
          borderRadius: '10px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          fontFamily: 'inherit',
          transition: 'box-shadow 0.2s'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: isDarkMode ? '#ddd' : '#333' }}>
          <span style={{ fontSize: '15px' }}>{'\u26C5'}</span>
          Darjeeling Weather & Alerts
        </span>
        <span style={{ fontSize: '10px', color: isDarkMode ? '#888' : '#999', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s', display: 'inline-block' }}>{'\u25BC'}</span>
      </button>

      {open && (
        <div style={{ marginTop: '10px', animation: 'wsFadeIn 0.25s ease' }}>
          <style>{`@keyframes wsFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <WeatherWidget variant="banner" isDarkMode={isDarkMode} />
          <WeatherWarning isDarkMode={isDarkMode} />
        </div>
      )}
    </div>
  );
}
