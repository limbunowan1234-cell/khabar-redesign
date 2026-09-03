import { NextResponse } from 'next/server';

// Darjeeling only -- this widget is location-fixed by design (see
// components/WeatherAirWidget.tsx), not a general-purpose weather API.
const LAT = 27.041;
const LON = 88.2663;

// Server-side proxy so API keys never reach the client bundle, matching
// how every other external call in this app goes through a Next.js API
// route rather than being fetched directly from the browser.
//
// AQI is the only thing WeatherAirWidget.tsx actually renders now --
// temp/condition were dropped after they duplicated (and occasionally
// disagreed with, being a different provider/model) WeatherStrip.tsx's
// own Open-Meteo reading elsewhere on the page. So AQICN is the one
// dependency that matters here: OpenWeatherMap is still queried (kept
// in the response in case something else wants it later) but a missing
// or failing OPENWEATHER_API_KEY no longer blocks the AQI half.
export async function GET() {
  try {
    const owmKey = process.env.OPENWEATHER_API_KEY;

    // AQICN's public "demo" token works for testing but is rate-limited,
    // shared across everyone using it, and not location-aware (it
    // returns whatever city its own demo station is, regardless of the
    // lat/lon queried) -- get a real free token at
    // https://aqicn.org/data-platform/token/ and set AQICN_API_KEY.
    const [weatherRes, aqiRes] = await Promise.all([
      owmKey ? fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=metric&appid=${owmKey}`) : null,
      fetch(`https://api.waqi.info/feed/geo:${LAT};${LON}/?token=${process.env.AQICN_API_KEY || 'demo'}`),
    ]);

    let temp: number | null = null;
    let condition = '';
    let description = '';
    let icon = '';
    if (!owmKey) {
      console.error('weather-aqi: OPENWEATHER_API_KEY not set, skipping weather (AQI is unaffected)');
    } else if (!weatherRes!.ok) {
      // Diagnostic only -- OpenWeatherMap's status/body is the one thing
      // that actually says *why* (bad key, key not yet activated, rate
      // limit, wrong plan) instead of just "something failed upstream".
      const body = await weatherRes!.text().catch(() => '');
      console.error('weather-aqi: OpenWeatherMap request failed', weatherRes!.status, body.slice(0, 500));
    } else {
      const weather = await weatherRes!.json();
      temp = Math.round(weather.main?.temp);
      condition = weather.weather?.[0]?.main || '';
      description = weather.weather?.[0]?.description || '';
      icon = weather.weather?.[0]?.icon || '';
    }

    // AQI is best-effort too -- a down/rate-limited AQICN just means the
    // widget renders nothing (see WeatherAirWidget.tsx), not a 502 for
    // the whole route. Diagnostic logging here: silently returning null
    // on any of the 3 ways this can fail (HTTP error, malformed body,
    // wrong-shape JSON) makes "why is AQI always missing" unanswerable
    // otherwise.
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

    return NextResponse.json({ temp, condition, description, icon, aqi });
  } catch (error) {
    console.error('weather-aqi error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather/AQI' }, { status: 500 });
  }
}
