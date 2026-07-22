// 날짜 유틸. 로컬 타임존 기준 YYYY-MM-DD 문자열을 다룬다.

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export interface MonthGrid {
  year: number;
  month: number; // 0-11
  weeks: Date[][]; // 각 주 = 7일(일~토). 5주 또는 6주.
}

// 해당 월을 포함하는 달력 그리드를 생성한다.
// 첫 주는 그 달 1일이 속한 주의 일요일부터, 마지막 주는 말일이 속한 주의 토요일까지.
export function buildMonthGrid(year: number, month: number): MonthGrid {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay()); // 직전 일요일

  const weeks: Date[][] = [];
  const cursor = new Date(start);
  do {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (
    // 다음 주 시작일이 아직 이번 달이면 한 주 더(최대 6주)
    weeks.length < 6 &&
    cursor.getMonth() === month
  );

  return { year, month, weeks };
}

export function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// start~end 범위를 덮는 연속 주(일요일 시작, 7일씩) 배열.
export function buildWeeksRange(start: Date, end: Date): Date[][] {
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  cur.setDate(cur.getDate() - cur.getDay()); // 그 주 일요일로
  const weeks: Date[][] = [];
  while (cur <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatMonthTitle(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

// 그 해의 몇 주차인지(1~53). 1월 1일이 속한 주를 1주차로, 일요일 시작 기준.
export function weekOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000) + 1;
  return Math.ceil((dayOfYear + start.getDay()) / 7);
}
