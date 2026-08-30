'use client';
import { useState, useEffect } from 'react';
import { CITIES } from '@/components/WeatherWidget';

// Same thresholds as WeatherWarning.tsx's getSeverity() -- duplicated
// rather than imported because WeatherWarning only computes this for
// whichever single city is currently selected, and refactoring it to
// expose a reusable function would mean this component re-renders (and
// re-fetches) every time WeatherWarning does. Five independent small
// fetches, one per town, is simpler and no more expensive.
function severityLevel(precip: number, code: number): 'red' | 'orange' | null {
  if (precip >= 20 || code >= 97) return 'red';
  if (precip >= 7 || (code >= 65 && code <= 67) || (code >= 82 && code <= 86)) return 'orange';
  return null;
}

const LEVEL_COLOR: Record<string, string> = { red: '#c41e3a', orange: '#e67e22', clear: '#2e7d32' };
const LEVEL_LABEL: Record<string, string> = { red: 'Red alert', orange: 'Orange alert', clear: 'Clear' };

interface TownStatus { name: string; level: 'red' | 'orange' | 'clear' | 'loading'; }

export default function WeatherAllTowns({ isDarkMode, selectedCity, onSelectCity }: { isDarkMode?: boolean; selectedCity: string; onSelectCity: (name: string) => void }) {
  const [statuses, setStatuses] = useState<TownStatus[]>(CITIES.map((c) => ({ name: c.name, level: 'loading' })));

  useEffect(() => {
    let alive = true;
    CITIES.forEach((city, i) => {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
        '&daily=weather_code,precipitation_sum&timezone=Asia%2FKolkata&forecast_days=1';
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d?.daily) return;
          const precip = d.daily.precipitation_sum?.[0] || 0;
          const code = d.daily.weather_code?.[0] || 0;
          const level = severityLevel(precip, code) || 'clear';
          setStatuses((prev) => prev.map((s, si) => (si === i ? { ...s, level } : s)));
        })
        .catch(() => {
          setStatuses((prev) => prev.map((s, si) => (si === i ? { ...s, level: 'clear' } : s)));
        });
    });
    return () => { alive = false; };
  }, []);

  const activeCount = statuses.filter((s) => s.level === 'red' || s.level === 'orange').length;

  return (
    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid ' + (isDarkMode ? '#333' : '#eee') }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: isDarkMode ? '#999' : '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
        Across the hills{activeCount > 0 ? ' -- ' + activeCount + ' town' + (activeCount > 1 ? 's' : '') + ' under alert' : ''}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
        {statuses.map((s) => {
          const active = s.name === selectedCity;
          const color = s.level === 'loading' ? (isDarkMode ? '#555' : '#ccc') : LEVEL_COLOR[s.level];
          return (
            <button
              key={s.name}
              onClick={() => onSelectCity(s.name)}
              title={s.level === 'loading' ? 'Checking...' : LEVEL_LABEL[s.level]}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 10px', borderRadius: '16px', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '12px', fontWeight: active ? 800 : 600,
                backgroundColor: active ? color : 'transparent',
                color: active ? '#fff' : (isDarkMode ? '#ccc' : '#444'),
                border: '1.5px solid ' + color,
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: active ? '#fff' : color, flexShrink: 0 }} />
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
