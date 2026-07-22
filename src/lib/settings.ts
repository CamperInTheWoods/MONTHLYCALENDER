// 앱 설정. 동기화 대상이 아닌 가벼운 값이라 localStorage에 저장한다.
import type { GeoResult } from './weather';

// 보기 모드. 'off'=일반, 'rating'=별점 색, 'weather'=날씨 색, 'temperature'=기온 색,
// 'workout'=운동 부위 슬롯(운동 탭에서만). 한 번에 하나만 활성화된다.
export type ViewMode = 'off' | 'rating' | 'weather' | 'temperature' | 'workout';

export type Theme = 'light' | 'gray' | 'dark';

export interface AppSettings {
  location: GeoResult | null;
  viewMode: ViewMode;
  theme: Theme;
  showWeekNumber: boolean;
}

const KEY = 'layer-calendar-settings';

const DEFAULTS: AppSettings = {
  location: null,
  viewMode: 'off',
  theme: 'light',
  showWeekNumber: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
