'use client';
import { useState, useEffect } from 'react';

// Darjeeling coordinates
const LAT = 27.041;
const LON = 88.2663;

// Open-Meteo weather codes -> label + emoji
function describe(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear sky', icon: '☀️' };
  if (code <= 2) return { label: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { label: 'Overcast', icon: '☁️' };
  if (code <= 48) return { label: 'Foggy', icon: '🌫️' };
  if (code <= 57) return { label: 'Drizzle', icon: '🌦️' };
  if (code <= 67) return { label: 'Rain', icon: '🌧️' };
  if (code <= 77) return { label: 'Snow', icon: '🌨️' };
  if (code <= 82) return { label: 'Rain showers', icon: '🌧️' };
  if (code <= 86) return { label: 'Snow showers', icon: '🌨️' };
  if (code <= 99) return { label: 'Thunderstorm', icon: '⛈️' };
  return { label: 'Clear', icon: '🌤️' };
}

interface WeatherWidgetProps {
  isDarkMode?: boolean;
  variant?: 'card' | 'banner'; // card = desktop sidebar, banner = mobile strip
}

export default function WeatherWidget({ isDarkMode = false, variant = 'card' }: WeatherWidgetProps) {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata';
    fetch(url)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((j) => { if (alive) setData(j); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  if (failed) return null;

  const loading = !data;
  const temp = data ? Math.round(data.current?.temperature_2m) : null;
  const code = data ? data.current?.weather_code : 0;
  const hi = data ? Math.round(data.daily?.temperature_2m_max?.[0]) : null;
  const lo = data ? Math.round(data.daily?.temperature_2m_min?.[0]) : null;
  const w = describe(code || 0);

  const gold = '#f5c518';
  const cardBg = isDarkMode ? 'linear-gradient(135deg,#2a1518,#1e1e1e)' : 'linear-gradient(135deg,#c41e3a,#a01830)';

  if (variant === 'banner') {
    // Mobile: compact horizontal strip
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: cardBg, borderRadius: '12px', padding: '12px 16px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <span style={{ fontSize: '30px', lineHeight: 1 }}>{loading ? '⏳' : w.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ color: 'white', fontSize: '22px', fontWeight: 800, lineHeight: 1 }}>{loading ? '--' : temp + '°'}</span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 600 }}>{loading ? 'Loading...' : w.label}</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginTop: '2px' }}>Darjeeling{!loading && hi != null ? '  •  H ' + hi + '°  L ' + lo + '°' : ''}</div>
        </div>
      </div>
    );
  }

  // Desktop: sidebar card with glass accent
  return (
    <div style={{ background: cardBg, borderRadius: '14px', padding: '18px', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ color: gold, fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Darjeeling Weather</span>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>{loading ? '⏳' : w.icon}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ color: 'white', fontSize: '40px', fontWeight: 800, lineHeight: 1 }}>{loading ? '--' : temp + '°'}</span>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600 }}>{loading ? 'Loading...' : w.label}</span>
        </div>
        {!loading && hi != null && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}><span style={{ color: gold, fontWeight: 700 }}>H</span> {hi}°C</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}><span style={{ color: gold, fontWeight: 700 }}>L</span> {lo}°C</div>
          </div>
        )}
      </div>
    </div>
  );
}
