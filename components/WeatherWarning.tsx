'use client';
import { useState, useEffect } from 'react';

const LAT = 27.041;
const LON = 88.2663;

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getSeverity(precip: number, code: number): { level: string; color: string; headline: string } | null {
  if (precip >= 20 || code >= 97) {
    return { level: 'RED ALERT', color: '#c41e3a', headline: 'Extremely Heavy Rain (' + precip.toFixed(0) + '+ cm)' };
  }
  if (precip >= 7 || (code >= 65 && code <= 67) || (code >= 82 && code <= 86)) {
    return { level: 'ORANGE ALERT', color: '#e67e22', headline: 'Heavy to Very Heavy Rain (' + precip.toFixed(0) + ' cm)' };
  }
  return null;
}

export default function WeatherWarning({ isDarkMode }: { isDarkMode?: boolean }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
      '&daily=weather_code,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FKolkata&forecast_days=4';
    fetch(url)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((j) => { if (alive) setData(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data || !data.daily) return null;

  const days = data.daily.time.map((dateStr: string, i: number) => {
    const precip = data.daily.precipitation_sum[i] || 0;
    const code = data.daily.weather_code[i];
    const wind = Math.round(data.daily.wind_speed_10m_max[i] || 0);
    const severity = getSeverity(precip, code);
    return { dateStr, i, precip, code, wind, severity };
  }).filter((d: any) => d.severity);

  if (days.length === 0) return null;

  return (
    <div style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid ' + (isDarkMode ? '#333' : '#eee') }}>
      <div style={{ background: 'linear-gradient(135deg, #c41e3a, #a01830)', padding: '16px 18px', color: '#fff' }}>
        <div style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.5px' }}>
          WEATHER FORECAST ALERT
        </div>
        <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '800' }}>Darjeeling Hills</h3>
        <p style={{ margin: 0, fontSize: '11px', opacity: 0.85 }}>Based on forecast data - not an official IMD warning</p>
      </div>

      <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#fff', padding: '14px' }}>
        {days.map((d: any) => (
          <div key={d.dateStr} style={{ padding: '12px', marginBottom: '10px', borderRadius: '10px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9', borderLeft: '4px solid ' + d.severity.color }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: isDarkMode ? '#aaa' : '#888', textTransform: 'uppercase' }}>{dayLabel(d.dateStr, d.i)} - {formatDate(d.dateStr)}</span>
              <span style={{ fontSize: '10px', fontWeight: '800', color: '#fff', backgroundColor: d.severity.color, padding: '3px 8px', borderRadius: '10px' }}>{d.severity.level}</span>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{d.severity.headline}</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: isDarkMode ? '#bbb' : '#666' }}>
              {d.wind > 30 && <span>Wind gusts up to {d.wind} kmph</span>}
              {(d.code >= 95) && <span>Thunderstorm risk</span>}
              <span>Landslide risk in hill areas</span>
            </div>
          </div>
        ))}
        <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: isDarkMode ? '#332a15' : '#fff8e1', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: isDarkMode ? '#e0c060' : '#7a5c00', lineHeight: '1.5' }}>
            Avoid unnecessary travel in hill areas, stay away from steep slopes and rivers, and keep emergency contacts ready. Source: Open-Meteo forecast data.
          </p>
        </div>
      </div>
    </div>
  );
}
