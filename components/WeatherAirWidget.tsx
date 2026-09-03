'use client';
import { useState, useEffect } from 'react';

// Air Quality only -- this used to also show temp/condition from
// OpenWeatherMap, but that duplicated (and occasionally disagreed
// with, by several degrees -- different provider, different model)
// WeatherStrip.tsx's own Open-Meteo-based reading already on this
// page. Two conflicting temperatures for the same city reads as
// broken, so WeatherStrip stays the one source of truth for weather;
// this card's only job is the one thing WeatherStrip doesn't have.

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
  // the key isn't set, or (now that temp/condition are gone) AQI itself
  // came back null -- there's nothing left worth showing on its own.
  const aqi = data?.aqi != null ? aqiLabel(data.aqi) : null;
  if (failed || !data || !aqi) return null;

  const gold = '#f5c518';
  const cardBg = isDarkMode ? 'linear-gradient(135deg,#2a1518,#1e1e1e)' : 'linear-gradient(135deg,#c41e3a,#a01830)';

  return (
    <div style={{ background: cardBg, borderRadius: '14px', padding: '18px', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ color: gold, fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Air Quality · Darjeeling
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'white', fontSize: '28px', fontWeight: 800, lineHeight: 1 }}>{data.aqi}</span>
          <span style={{ backgroundColor: aqi.color, color: aqi.textColor, padding: '4px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>{aqi.text}</span>
        </div>
      </div>
    </div>
  );
}
