'use client';
import { useState, useEffect } from 'react';

// OpenWeatherMap icon-code prefix -> emoji. WeatherWidget.tsx already
// renders weather as an emoji rather than a raster icon (WMO codes,
// a different provider) -- matching that same visual language here
// instead of pulling in OpenWeatherMap's own PNG icon set.
const ICON_MAP: Record<string, string> = {
  '01': '☀️', '02': '⛅', '03': '☁️', '04': '☁️',
  '09': '🌦️', '10': '🌧️', '11': '⛈️',
  '13': '🌨️', '50': '🌫️',
};

// 3-bucket scale as specified -- Good/Moderate/Poor, reusing the site's
// own accent colors (gold, red) rather than inventing new ones.
function aqiLabel(aqi: number): { text: string; color: string; textColor: string } {
  if (aqi <= 50) return { text: 'Good', color: '#2e7d32', textColor: '#fff' };
  if (aqi <= 100) return { text: 'Moderate', color: '#f5c518', textColor: '#1a1a1a' };
  return { text: 'Poor', color: '#c41e3a', textColor: '#fff' };
}

export default function WeatherAirWidget({ isDarkMode }: { isDarkMode?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/weather-aqi')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  // Fail gracefully: no widget at all if the API is down, rate-limited,
  // or OPENWEATHER_API_KEY isn't set yet -- never a broken/empty card.
  if (failed || !data) return null;

  const gold = '#f5c518';
  const cardBg = isDarkMode ? 'linear-gradient(135deg,#2a1518,#1e1e1e)' : 'linear-gradient(135deg,#c41e3a,#a01830)';
  const icon = ICON_MAP[(data.icon || '').slice(0, 2)] || '🌤️';
  const aqi = data.aqi != null ? aqiLabel(data.aqi) : null;

  return (
    <div style={{ background: cardBg, borderRadius: '14px', padding: '18px', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '16px' }}>
        <div>
          <div style={{ color: gold, fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Darjeeling</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '30px', lineHeight: 1 }}>{icon}</span>
            <span style={{ color: 'white', fontSize: '36px', fontWeight: 800, lineHeight: 1 }}>{data.temp}&deg;</span>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' as const }}>{data.description || data.condition}</span>
          </div>
        </div>
        {aqi && (
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '6px' }}>Air Quality</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
              <span style={{ color: 'white', fontSize: '22px', fontWeight: 800 }}>{data.aqi}</span>
              <span style={{ backgroundColor: aqi.color, color: aqi.textColor, padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 }}>{aqi.text}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
