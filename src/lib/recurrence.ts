// 반복 규칙(Recurrence)으로부터 실제 발생 날짜(YYYY-MM-DD) 목록을 계산한다.
import type { Recurrence } from '../types';
import { toDateKey } from './date';

const MAX_TOTAL = 750; // 안전 상한 (무한 루프/과생성 방지)
const NEVER_HORIZON_MONTHS = 24; // 무기한 반복 시 미리 생성할 기간
const COUNT_HORIZON_MONTHS = 120; // 횟수 기반 반복의 탐색 상한

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

// 일요일 기준 주 시작일로 정렬한 두 날짜 사이의 주 수
function weeksBetween(a: Date, b: Date): number {
  const aSun = new Date(a);
  aSun.setDate(a.getDate() - a.getDay());
  const bSun = new Date(b);
  bSun.setDate(b.getDate() - b.getDay());
  const ms = bSun.getTime() - aSun.getTime();
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function matches(cursor: Date, rec: Recurrence, start: Date): boolean {
  switch (rec.type) {
    case 'weekly':
      return rec.weekdays?.includes(cursor.getDay()) ?? false;
    case 'biweekly':
      return (
        (rec.weekdays?.includes(cursor.getDay()) ?? false) &&
        weeksBetween(start, cursor) % 2 === 0
      );
    case 'monthlyDate':
      return cursor.getDate() === rec.monthDate;
    case 'monthlyNthWeekday': {
      if (cursor.getDay() !== rec.weekday) return false;
      if (rec.nthWeek === -1) {
        // 마지막 해당 요일: 다음 주 같은 요일이 다음 달이면 마지막
        return (
          cursor.getDate() + 7 >
          daysInMonth(cursor.getFullYear(), cursor.getMonth())
        );
      }
      return Math.ceil(cursor.getDate() / 7) === rec.nthWeek;
    }
    default:
      return false;
  }
}

export function generateOccurrences(rec: Recurrence): string[] {
  const start = parseKey(rec.startDate);
  const end = rec.endCondition;

  const hardStop =
    end.type === 'date'
      ? parseKey(end.value)
      : end.type === 'count'
        ? addMonths(start, COUNT_HORIZON_MONTHS)
        : addMonths(start, NEVER_HORIZON_MONTHS);
  const maxCount = end.type === 'count' ? end.value : Infinity;

  const results: string[] = [];
  const cursor = new Date(start);
  while (
    cursor <= hardStop &&
    results.length < maxCount &&
    results.length < MAX_TOTAL
  ) {
    if (matches(cursor, rec, start)) {
      results.push(toDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return results;
}
