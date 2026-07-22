import type { WeatherCategory } from '../lib/weather';

// 날씨 분류별 라인 SVG 아이콘. 색만으로 구분하기 어려운 점을 보완한다.
// (cloudy=구름 외곽선, overcast=채운 먹구름으로 '더 흐림'을 직관적으로 표현)
export function WeatherIcon({ category }: { category: WeatherCategory }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const cloud = 'M18 10h-1.26A7 7 0 1 0 4 14h14a4 4 0 0 0 0-8z';

  switch (category) {
    case 'clear':
      return (
        <svg {...common} fill="none">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case 'cloudy':
      return (
        <svg {...common} fill="none">
          <path d={cloud} />
        </svg>
      );
    case 'overcast':
      // 먹구름: 뒤에 작은 구름을 겹쳐 무겁고 짙은 느낌을 준다.
      return (
        <svg {...common} fill="none">
          <path
            d={cloud}
            transform="translate(4 -3) scale(0.7)"
            stroke="currentColor"
          />
          <path d={cloud} fill="currentColor" stroke="none" />
        </svg>
      );
    case 'rain':
      return (
        <svg {...common} fill="none">
          <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
          <path d="M8 19v2M12 19v2M16 19v2" />
        </svg>
      );
    case 'snow':
      return (
        <svg {...common} fill="none">
          <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
          <path d="M8 20h.01M12 20h.01M16 20h.01M10 22h.01M14 22h.01" />
        </svg>
      );
  }
}
