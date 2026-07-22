import { useEffect, useRef, useState } from 'react';
import { fetchMonthWeather } from '../lib/weather';
import type { DayWeather, GeoResult } from '../lib/weather';

type WeatherMap = Map<string, DayWeather>;

export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'error';

// 날씨/기온 모드일 때, 보이는 달 ±1개월을 불러온다(세로 스크롤로 여러 달이
// 한 화면에 보이므로). 방문한 달은 캐시에 쌓여 다시 불러오지 않는다.
export function useWeather(
  enabled: boolean,
  location: GeoResult | null,
  year: number,
  month: number,
) {
  const [weather, setWeather] = useState<WeatherMap>(new Map());
  const [status, setStatus] = useState<WeatherStatus>('idle');
  const cache = useRef(new Map<string, WeatherMap>());

  useEffect(() => {
    if (!enabled || !location) {
      setWeather(new Map());
      setStatus('idle');
      return;
    }
    const { lat, lon } = location;
    const prefix = `${lat},${lon},`;
    const mergeCache = (): WeatherMap => {
      const merged: WeatherMap = new Map();
      for (const [k, map] of cache.current) {
        if (!k.startsWith(prefix)) continue;
        for (const [d, w] of map) merged.set(d, w);
      }
      return merged;
    };

    // 현재 달 ±1개월
    const months = [-1, 0, 1].map((delta) => {
      const dt = new Date(year, month + delta, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });
    const need = months.filter(
      ({ y, m }) => !cache.current.has(`${prefix}${y}-${m}`),
    );

    if (need.length === 0) {
      setWeather(mergeCache());
      setStatus('ready');
      return;
    }

    let active = true;
    setStatus('loading');
    Promise.all(
      need.map(({ y, m }) =>
        fetchMonthWeather(lat, lon, y, m).then((map) => {
          cache.current.set(`${prefix}${y}-${m}`, map);
        }),
      ),
    )
      .then(() => {
        if (active) {
          setWeather(mergeCache());
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [enabled, location, year, month]);

  return { weather, status };
}
