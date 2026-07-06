'use client';
import { useState, useEffect } from 'react';

const CITIES = [
  { name: 'Darjeeling', lat: 27.041, lon: 88.2663 },
  { name: 'Kalimpong', lat: 27.0710, lon: 88.4700 },
  { name: 'Kurseong', lat: 26.8804, lon: 88.2803 },
  { name: 'Siliguri', lat: 26.7271, lon: 88.3953 },
  { name: 'Mirik', lat: 26.8874, lon: 88.1826 },
];

function describe(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear sky', icon: '\u2600\uFE0F' };
  if (code <= 2) return { label: 'Partly cloudy', icon: '\u26C5' };
  if (code === 3) return { label: 'Overcast', icon: '\u2601\uFE0F' };
  if (code <= 48) return { label: 'Foggy', icon: '\uD83C\uDF2B\uFE0F' };
  if (code <= 57) return { label: 'Drizzle', icon: '\uD83C\uDF26\uFE0F' };
  if (code <= 67) return { label: 'Rain', icon: '\uD83C\uDF27\uFE0F' };
  if (code <= 77) return { label: 'Snow', icon: '\uD83C\uDF28\uFE0F' };
  if (code <= 82) return { label: 'Rain showers', icon: '\uD83C\uDF27\uFE0F' };
  if (code <= 86) return { label: 'Snow showers', icon: '\uD83C\uDF28\uFE0F' };
  if (code <= 99) return { label: 'Thunderstorm', icon: '\u26C8\uFE0F' };
  return { label: 'Clear', icon: '\uD83C\uDF24\uFE0F' };
}

function getAlert(code: number, maxTemp: number | null): string | null {
  if (code >= 95) return 'Thunderstorm warning - avoid outdoor travel';
  if (code >= 82 && code <= 86) return 'Heavy rain/snow showers expected';
  if (code >= 65 && code <= 67) return 'Heavy rain alert - landslide risk in hill areas';
  if (code >= 73 && code <= 77) return 'Snowfall alert - roads may be affected';
  if (maxTemp != null && maxTemp <= 2) return 'Cold wave alert - freezing conditions expected';
  return null;
}

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

const DEG = '\u00B0';

interface WeatherWidgetProps {
  isDarkMode?: boolean;
  variant?: 'card' | 'banner';
}

export default function WeatherWidget({ isDarkMode = false, variant = 'card' }: WeatherWidgetProps) {
  const [cityIndex, setCityIndex] = useState(0);
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoadingState] = useState(true);

  const city = CITIES[cityIndex];

  useEffect(() => {
    let alive = true;
    setLoadingState(true);
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FKolkata&forecast_days=5';
    fetch(url)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((j) => { if (alive) { setData(j); setLoadingState(false); } })
      .catch(() => { if (alive) { setFailed(true); setLoadingState(false); } });
    return () => { alive = false; };
  }, [cityIndex]);

  if (failed && !data) return null;

  const temp = data ? Math.round(data.current?.temperature_2m) : null;
  const code = data ? data.current?.weather_code : 0;
  const hi = data ? Math.round(data.daily?.temperature_2m_max?.[0]) : null;
  const lo = data ? Math.round(data.daily?.temperature_2m_min?.[0]) : null;
  const w = describe(code || 0);
  const alert = data ? getAlert(code || 0, hi) : null;

  const gold = '#f5c518';
  const cardBg = isDarkMode ? 'linear-gradient(135deg,#2a1518,#1e1e1e)' : 'linear-gradient(135deg,#c41e3a,#a01830)';
  const forecastDays = data?.daily?.time || [];

  const citySelector = (
    <select
      value={cityIndex}
      onChange={(e) => setCityIndex(Number(e.target.value))}
      style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, padding: '3px 6px', cursor: 'pointer', outline: 'none' }}
    >
      {CITIES.map((c, i) => (
        <option key={c.name} value={i} style={{ color: '#1a1a1a' }}>{c.name}</option>
      ))}
    </select>
  );

  const forecastRow = !loading && forecastDays.length > 1 && (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
      {forecastDays.slice(0, 5).map((dateStr: string, i: number) => {
        const dayHi = Math.round(data.daily.temperature_2m_max[i]);
        const dayLo = Math.round(data.daily.temperature_2m_min[i]);
        const dayCode = data.daily.weather_code[i];
        const dayW = describe(dayCode);
        return (
          <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{dayLabel(dateStr, i)}</span>
            <span style={{ fontSize: '18px' }}>{dayW.icon}</span>
            <span style={{ color: 'white', fontSize: '11px', fontWeight: 700 }}>{dayHi}{DEG}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px' }}>{dayLo}{DEG}</span>
          </div>
        );
      })}
    </div>
  );

  const alertBanner = alert && (
    <div style={{ marginTop: '10px', padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '14px' }}>{'\u26A0\uFE0F'}</span>
      <span style={{ color: 'white', fontSize: '11px', fontWeight: 600, lineHeight: 1.3 }}>{alert}</span>
    </div>
  );

  if (variant === 'banner') {
    return (
      <div style={{ background: cardBg, borderRadius: '12px', padding: '12px 16px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '30px', lineHeight: 1 }}>{loading ? '\u23F3' : w.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ color: 'white', fontSize: '22px', fontWeight: 800, lineHeight: 1 }}>{loading ? '--' : temp + DEG}</span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 600 }}>{loading ? 'Loading...' : w.label}</span>
              </div>
              {citySelector}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginTop: '2px' }}>{city.name}{!loading && hi != null ? '  -  H ' + hi + DEG + '  L ' + lo + DEG : ''}</div>
          </div>
        </div>
        {alertBanner}
        {forecastRow}
      </div>
    );
  }

  return (
    <div style={{ background: cardBg, borderRadius: '14px', padding: '18px', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ color: gold, fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{city.name} Weather</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {citySelector}
            <span style={{ fontSize: '28px', lineHeight: 1 }}>{loading ? '\u23F3' : w.icon}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ color: 'white', fontSize: '40px', fontWeight: 800, lineHeight: 1 }}>{loading ? '--' : temp + DEG}</span>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600 }}>{loading ? 'Loading...' : w.label}</span>
        </div>
        {!loading && hi != null && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}><span style={{ color: gold, fontWeight: 700 }}>H</span> {hi}{DEG}C</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}><span style={{ color: gold, fontWeight: 700 }}>L</span> {lo}{DEG}C</div>
          </div>
        )}
        {alertBanner}
        {forecastRow}
      </div>
    </div>
  );
}
