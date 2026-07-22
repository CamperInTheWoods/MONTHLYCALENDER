// Open-Meteo(무료, API 키 불필요) 기반 날씨 조회.
// - 지오코딩: 도시명 -> 위경도
// - 일별 날씨코드(WMO) 조회 후 앱 분류로 매핑
import { toDateKey, todayKey } from './date';

export type WeatherCategory = 'clear' | 'cloudy' | 'overcast' | 'rain' | 'snow';

export interface DayWeather {
  category: WeatherCategory;
  tempMin: number; // 섭씨, 정수 반올림
  tempMax: number;
}

export interface GeoResult {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

// 강수량(mm)이 이 값 미만이면 약한 이슬비로 보고 비로 칠하지 않는다.
const RAIN_MM_THRESHOLD = 1;

// WMO weather code(+강수량) -> 앱 분류
export function classifyWmo(code: number, precipMm = 0): WeatherCategory {
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code <= 1) return 'clear'; // 0 맑음, 1 대체로 맑음
  if (code === 2) return 'cloudy'; // 부분적 구름
  // 비/이슬비/소나기/뇌우 계열: 실제로 의미 있는 양일 때만 '비'
  const isWet =
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    code >= 95;
  if (isWet) return precipMm >= RAIN_MM_THRESHOLD ? 'rain' : 'overcast';
  return 'overcast'; // 3 흐림, 45·48 안개 등
}

// 기온모드 셀 배경색. 추위(-5°)=파랑 ~ 더위(35°)=빨강 으로 연속 보간.
// 배경이라 연한 파스텔(명도 높게)로 글자 가독성을 유지한다.
export function tempColor(tempC: number): string {
  const lo = -5;
  const hi = 35;
  const ratio = Math.min(1, Math.max(0, (tempC - lo) / (hi - lo)));
  const hue = 220 * (1 - ratio); // 220(파랑) -> 0(빨강)
  return `hsl(${Math.round(hue)} 70% 85%)`;
}

export async function geocode(name: string): Promise<GeoResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name,
  )}&count=1&language=ko&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('지오코딩 실패');
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) return null;
  return { name: r.name, country: r.country ?? '', lat: r.latitude, lon: r.longitude };
}

// 해당 월의 일별 날씨 분류를 조회한다. API 허용 범위를 벗어난 날짜는 결과에 없다.
export async function fetchMonthWeather(
  lat: number,
  lon: number,
  year: number,
  month: number,
): Promise<Map<string, DayWeather>> {
  const start = toDateKey(new Date(year, month, 1));
  const monthEnd = toDateKey(new Date(year, month + 1, 0));
  // 미래 날씨는 표시하지 않는다. 조회 범위를 오늘까지로 제한한다.
  const today = todayKey();
  const end = monthEnd < today ? monthEnd : today;
  const result = new Map<string, DayWeather>();
  if (start > end) return result; // 전체가 미래인 달 -> 호출하지 않음
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=auto&start_date=${start}&end_date=${end}`;

  const res = await fetch(url);
  if (!res.ok) return result; // 범위 밖 등 -> 빈 결과
  const data = await res.json();
  const times: string[] = data.daily?.time ?? [];
  const codes: (number | null)[] = data.daily?.weathercode ?? [];
  const maxs: (number | null)[] = data.daily?.temperature_2m_max ?? [];
  const mins: (number | null)[] = data.daily?.temperature_2m_min ?? [];
  const precips: (number | null)[] = data.daily?.precipitation_sum ?? [];
  times.forEach((t, i) => {
    const code = codes[i];
    if (code == null) return;
    result.set(t, {
      category: classifyWmo(code, precips[i] ?? 0),
      tempMin: Math.round(mins[i] ?? 0),
      tempMax: Math.round(maxs[i] ?? 0),
    });
  });
  return result;
}
