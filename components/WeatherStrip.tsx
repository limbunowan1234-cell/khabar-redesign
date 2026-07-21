'use client';
import { useState, useEffect } from 'react';
import WeatherWidget from '@/components/WeatherWidget';
import WeatherWarning from '@/components/WeatherWarning';

const WMO_ICONS: { [key: number]: string } = {
  0: '\u2600\uFE0F', 1: '\uD83C\uDF24', 2: '\u26C5', 3: '\u2601\uFE0F',
  45: '\uD83C\uDF2B', 48: '\uD83C\uDF2B',
  51: '\uD83C\uDF26', 53: '\uD83C\uDF26', 55: '\uD83C\uDF27',
  61: '\uD83C\uDF27', 63: '\uD83C\uDF27', 65: '\uD83C\uDF27',
  80: '\uD83C\uDF26', 81: '\uD83C\uDF27', 82: '\u26C8',
  95: '\u26C8', 96: '\u26C8', 99: '\u26C8'
};

export default function WeatherStrip({ isDarkMode }: { isDarkMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<number | null>(null);
  const [icon, setIcon] = useState('\u26C5');

  useEffect(() => {
    let alive = true;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=27.041&longitude=88.266&current_weather=true')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!alive || !d?.current_weather) return;
        setTemp(Math.round(d.current_weather.temperature));
        const code = d.current_weather.weathercode;
        if (WMO_ICONS[code]) setIcon(WMO_ICONS[code]);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

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
          <span style={{ fontSize: '15px' }}>{icon}</span>
          Darjeeling Weather & Alerts
          {temp !== null && (
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#c41e3a', backgroundColor: isDarkMode ? '#2a1518' : '#fdf0f2', padding: '2px 8px', borderRadius: '10px' }}>{temp}&deg;C</span>
          )}
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
