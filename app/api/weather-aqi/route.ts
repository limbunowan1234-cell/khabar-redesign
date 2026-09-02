import { NextResponse } from 'next/server';

// Darjeeling only -- this widget is location-fixed by design (see
// components/WeatherAirWidget.tsx), not a general-purpose weather API.
const LAT = 27.041;
const LON = 88.2663;

// Server-side proxy so the OpenWeatherMap key never reaches the client
// bundle, matching how every other external call in this app goes
// through a Next.js API route rather than being fetched directly from
// the browser.
export async function GET() {
  try {
    const owmKey = process.env.OPENWEATHER_API_KEY;
    if (!owmKey) return NextResponse.json({ error: 'OPENWEATHER_API_KEY not set' }, { status: 503 });

    // AQICN's public "demo" token works for testing but is rate-limited
    // and shared across everyone using it -- get a real free token at
    // https://aqicn.org/data-platform/token/ and set AQICN_API_KEY.
    const [weatherRes, aqiRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=metric&appid=${owmKey}`),
      fetch(`https://api.waqi.info/feed/geo:${LAT};${LON}/?token=${process.env.AQICN_API_KEY || 'demo'}`),
    ]);

    if (!weatherRes.ok) {
      // Diagnostic only -- OpenWeatherMap's status/body is the one thing
      // that actually says *why* (bad key, key not yet activated, rate
      // limit, wrong plan) instead of just "something failed upstream".
      const body = await weatherRes.text().catch(() => '');
      console.error('weather-aqi: OpenWeatherMap request failed', weatherRes.status, body.slice(0, 500));
      return NextResponse.json({ error: 'Weather unavailable' }, { status: 502 });
    }
    const weather = await weatherRes.json();

    // AQI is best-effort -- a down/rate-limited AQICN shouldn't take the
    // weather half of the widget down with it. Diagnostic logging here
    // too: silently returning null on any of the 3 ways this can fail
    // (HTTP error, malformed body, wrong-shape JSON) makes "why is AQI
    // always missing" unanswerable otherwise.
    let aqi: number | null = null;
    if (!aqiRes.ok) {
      const body = await aqiRes.text().catch(() => '');
      console.error('weather-aqi: AQICN request failed', aqiRes.status, body.slice(0, 500));
    } else {
      const aqiData = await aqiRes.json().catch((e) => { console.error('weather-aqi: AQICN body not JSON', e); return null; });
      if (aqiData?.status === 'ok' && typeof aqiData.data?.aqi === 'number') {
        aqi = aqiData.data.aqi;
      } else {
        console.error('weather-aqi: AQICN response not usable', JSON.stringify(aqiData).slice(0, 500));
      }
    }

    return NextResponse.json({
      temp: Math.round(weather.main?.temp),
      condition: weather.weather?.[0]?.main || '',
      description: weather.weather?.[0]?.description || '',
      icon: weather.weather?.[0]?.icon || '',
      aqi,
    });
  } catch (error) {
    console.error('weather-aqi error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather/AQI' }, { status: 500 });
  }
}
