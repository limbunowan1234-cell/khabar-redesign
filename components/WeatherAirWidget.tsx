'use client';
import { useState, useEffect } from 'react';

// Air Quality only -- this used to also show temp/condition from
// OpenWeatherMap, but that duplicated (and occasionally disagreed
// with, by several degrees -- different provider, different model)
// WeatherStrip.tsx's own Open-Meteo-based reading already on this
// page. Two conflicting temperatures for the same city reads as
// broken, so WeatherStrip stays the one source of truth for weather;
// this card's only job is the one thing WeatherStrip doesn't have.

// 3-bucket scale as specified -- Good/Moderate/Poor.
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

  // A quiet one-line data strip between hairlines, like the markets/weather
  // line on a newspaper front page, rather than a coloured promo card.
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '10px 2px',
        marginBottom: '28px',
        borderTop: '1px solid var(--rule)',
        borderBottom: '1px solid var(--rule)',
        color: isDarkMode ? '#e0e0e0' : '#1a1a1a',
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--color-text-muted)' }}>
        Air quality · Darjeeling
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 800, lineHeight: 1 }}>{data.aqi}</span>
        <span style={{ backgroundColor: aqi.color, color: aqi.textColor, padding: '3px 10px', borderRadius: '2px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{aqi.text}</span>
      </span>
    </div>
  );
}
