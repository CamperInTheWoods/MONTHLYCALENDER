import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toDateKey, todayKey, weekOfYear, WEEKDAY_LABELS } from '../lib/date';
import type { Category, CalendarEvent, DayNote } from '../types';
import type { DayWeather, WeatherCategory } from '../lib/weather';
import { tempColor } from '../lib/weather';
import { WeatherIcon } from './WeatherIcon';
import './CalendarGrid.css';

const MAX_VISIBLE_PER_DAY = 3;
// 한 주 행의 고정 높이(px). CSS .calendar__week height와 일치해야 스냅/스크롤 계산이 맞다.
const WEEK_HEIGHT = 108;
const WEEK_HEIGHT_FAR = 30; // 멀리 보기(축소) 주 높이
const MAX_DOTS = 6;

// 크게 보기(현재 주 확대) 모드
const NEAR_SMALL_HEIGHT = WEEK_HEIGHT; // 포커스 아닌 주는 기본 보기와 같은 높이
const NEAR_FOCUS_MAX_VISIBLE = 15; // 포커스된 주의 하루 최대 표시 일정 수
const NEAR_FOCUS_MIN_HEIGHT = 360; // 실측 전 초기 추정 높이

// 운동 모드: 고정 부위 슬롯(위→아래 순서). 제목에 부위명이 포함되면 해당 슬롯에 표시.
const WORKOUT_PARTS = ['어깨', '가슴', '등', '하체'];
// 운동일로부터 경과일별 진하기 (당일, +1일, +2일, +3일)
const WORKOUT_FADE = [1, 0.6, 0.4, 0.22];

const WEATHER_BG: Record<WeatherCategory, string> = {
  clear: 'var(--weather-clear)',
  cloudy: 'var(--weather-cloudy)',
  overcast: 'var(--weather-overcast)',
  rain: 'var(--weather-rain)',
  snow: 'var(--weather-snow)',
};

// 별점(0.5~5) 셀 배경색: 낮음=어둡고 칙칙한 청회색 -> 높음=밝고 선명한 파랑.
const RATING_HUE = 215;
function ratingRatio(rating: number) {
  return Math.min(1, Math.max(0, (rating - 0.5) / 4.5));
}
function ratingLightness(rating: number) {
  return 35 + ratingRatio(rating) * 50; // 35%(어두움) ~ 85%(밝음)
}
function ratingColor(rating: number): string {
  const r = ratingRatio(rating);
  const sat = 15 + r * 55; // 15%(칙칙) ~ 70%(선명)
  return `hsl(${RATING_HUE} ${Math.round(sat)}% ${Math.round(ratingLightness(rating))}%)`;
}
function ratingTextColor(rating: number): string {
  return ratingLightness(rating) < 58 ? '#ffffff' : '#1d2129';
}

interface Props {
  weeks: Date[][]; // 렌더할 연속 주(일요일 시작)
  events: CalendarEvent[];
  categories: Category[];
  weather: Map<string, DayWeather>;
  viewMode: 'off' | 'rating' | 'weather' | 'temperature' | 'workout';
  workout: boolean; // 운동 부위 슬롯 표시 여부
  workoutColor: string;
  zoomFar: boolean; // 멀리 보기(축소)
  zoomNear: boolean; // 크게 보기(현재 주 확대)
  showWeekNumber: boolean;
  dayNotes: Map<string, DayNote>;
  // 특정 날짜(키)로 스크롤. nonce가 바뀔 때마다 재실행.
  scrollTarget: { key: string; nonce: number };
  onVisibleMonthChange: (year: number, month: number) => void;
  onSelectDay: (dateKey: string) => void;
  onSelectWeek: (sundayKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onToggleDone: (event: CalendarEvent) => void;
}

export function CalendarGrid({
  weeks,
  events,
  categories,
  weather,
  viewMode,
  workout,
  workoutColor,
  zoomFar,
  zoomNear,
  showWeekNumber,
  dayNotes,
  scrollTarget,
  onVisibleMonthChange,
  onSelectDay,
  onSelectWeek,
  onSelectEvent,
  onToggleDone,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRowRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [focusedHeight, setFocusedHeight] = useState(NEAR_FOCUS_MIN_HEIGHT);

  const colorByCategory = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.color));
    return m;
  }, [categories]);
  const orderByCategory = useMemo(() => {
    const m = new Map<string, number>();
    categories.forEach((c) => m.set(c.id, c.order));
    return m;
  }, [categories]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    for (const arr of m.values()) {
      arr.sort(
        (a, b) =>
          (orderByCategory.get(a.categoryId) ?? 999) -
          (orderByCategory.get(b.categoryId) ?? 999),
      );
    }
    return m;
  }, [events, orderByCategory]);

  const bottomBars = useMemo(() => {
    type Bar = { event: CalendarEvent; role: 'deadline' | 'start' | 'end' };
    const m = new Map<string, Bar[]>();
    const push = (date: string, bar: Bar) => {
      const a = m.get(date) ?? [];
      a.push(bar);
      m.set(date, a);
    };
    for (const e of events) {
      if (e.kind === 'deadline') push(e.date, { event: e, role: 'deadline' });
      else if (e.kind === 'period') {
        push(e.date, { event: e, role: 'start' });
        if (e.endDate) push(e.endDate, { event: e, role: 'end' });
      }
    }
    for (const arr of m.values()) {
      arr.sort(
        (a, b) =>
          (orderByCategory.get(a.event.categoryId) ?? 999) -
          (orderByCategory.get(b.event.categoryId) ?? 999),
      );
    }
    return m;
  }, [events, orderByCategory]);

  // 운동 모드: 날짜별로 그날 운동한 부위 -> 일정. (제목에 부위명 포함으로 매칭)
  const workoutByDate = useMemo(() => {
    const m = new Map<string, Map<string, CalendarEvent>>();
    if (!workout) return m;
    for (const e of events) {
      for (const part of WORKOUT_PARTS) {
        if (e.title.includes(part)) {
          const day = m.get(e.date) ?? new Map();
          if (!day.has(part)) day.set(part, e);
          m.set(e.date, day);
        }
      }
    }
    return m;
  }, [events, workout]);

  // 특정 부위를 그날 포함 최근 3일 내 언제 했는지 (가장 가까운 날 기준)
  const findRecentWorkout = (part: string, day: Date) => {
    for (let d = 0; d < WORKOUT_FADE.length; d++) {
      const dt = new Date(day);
      dt.setDate(day.getDate() - d);
      const ev = workoutByDate.get(toDateKey(dt))?.get(part);
      if (ev) return { daysAgo: d, event: ev };
    }
    return null;
  };

  const today = todayKey();
  const weekHeight = zoomFar ? WEEK_HEIGHT_FAR : WEEK_HEIGHT;

  // 날짜 키가 속한 주가 weeks 배열에서 몇 번째인지 계산.
  const weekIndexForKey = (key: string) => {
    if (weeks.length === 0) return 0;
    const first = weeks[0][0]; // 첫 주 일요일
    const [ty, tm, td] = key.split('-').map(Number);
    const target = new Date(ty, tm - 1, td);
    target.setDate(target.getDate() - target.getDay()); // 대상 주 일요일
    const idx = Math.round(
      (target.getTime() - first.getTime()) / (7 * 86400000),
    );
    return Math.min(Math.max(idx, 0), weeks.length - 1);
  };

  // 크게 보기: 포커스 주(focusedIndex)는 focusedHeight만큼, 나머지는 NEAR_SMALL_HEIGHT만큼 차지한다고
  // 가정하고, 스크롤 컨테이너 내 세로 offset이 몇 번째 주에 해당하는지 역산.
  const nearIndexAtOffset = (offset: number) => {
    const f = focusedIndex ?? 0;
    const beforeEnd = f * NEAR_SMALL_HEIGHT;
    const focusEnd = beforeEnd + focusedHeight;
    let idx: number;
    if (offset < beforeEnd) idx = Math.floor(offset / NEAR_SMALL_HEIGHT);
    else if (offset < focusEnd) idx = f;
    else idx = f + 1 + Math.floor((offset - focusEnd) / NEAR_SMALL_HEIGHT);
    return Math.min(Math.max(idx, 0), weeks.length - 1);
  };

  // scrollTarget/zoomNear가 바뀌면 포커스 주 인덱스를 그 즉시(렌더 중) 맞춰둔다.
  // (React 권장 패턴: 외부 신호에 따른 state 조정은 effect가 아니라 렌더 중에 처리)
  const syncKey = `${zoomNear}:${scrollTarget.nonce}`;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  if (zoomNear && syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    setFocusedIndex(weekIndexForKey(scrollTarget.key));
  } else if (!zoomNear && syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
  }

  // scrollTarget이 바뀌면 해당 날짜가 속한 주로 스크롤 위치를 맞춘다.
  // - 기본/멀리 보기: 그 주를 맨 위로.
  // - 크게 보기: 포커스(확대)된 그 주를 맨 위로.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || weeks.length === 0) return;
    const idx = weekIndexForKey(scrollTarget.key);
    if (zoomNear) {
      el.scrollTop = idx * NEAR_SMALL_HEIGHT;
    } else {
      el.scrollTo({ top: idx * weekHeight });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget, zoomFar, zoomNear]);

  // 포커스된 주 행의 실제 높이를 측정해 offset 역산에 반영.
  // (매 렌더마다 재측정: 일정 개수 변화로 포커스 주 높이가 바뀔 수 있음)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!zoomNear) return;
    const h = focusedRowRef.current?.offsetHeight;
    if (h && Math.abs(h - focusedHeight) > 1) setFocusedHeight(h);
  });

  // 크게 보기에서 포커스 주를 바꾸는 유일한 방법: 날짜/주차를 직접 클릭.
  // (스크롤로 자동 전환되지 않음 — 스크롤 위치를 흔드는 문제가 있었음)
  const pinWeek = (i: number) => setFocusedIndex(i);

  // 스크롤 시 맨 위에 보이는 주의 달을 헤더에 알린다. 크게 보기에서는 포커스 주를 바꾸지 않는다.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (zoomNear) {
      const wk = weeks[nearIndexAtOffset(el.scrollTop)];
      if (wk) onVisibleMonthChange(wk[4].getFullYear(), wk[4].getMonth());
      return;
    }
    const idx = Math.round(el.scrollTop / weekHeight);
    const wk = weeks[Math.min(Math.max(idx, 0), weeks.length - 1)];
    if (wk) {
      const th = wk[4]; // 목요일 기준 달
      onVisibleMonthChange(th.getFullYear(), th.getMonth());
    }
  };

  const renderDay = (
    day: Date,
    opts: { farLike?: boolean; expanded?: boolean; weekIndex?: number } = {},
  ) => {
    const farLike = opts.farLike ?? zoomFar;
    const maxVisible = opts.expanded ? NEAR_FOCUS_MAX_VISIBLE : MAX_VISIBLE_PER_DAY;
    const key = toDateKey(day);
    const selectDay = () => {
      if (zoomNear && opts.weekIndex !== undefined) pinWeek(opts.weekIndex);
      onSelectDay(key);
    };
    const allDayEvents = eventsByDate.get(key) ?? [];
    const bars = bottomBars.get(key) ?? [];
    const dayEvents = allDayEvents.filter(
      (e) => e.kind === 'event' || e.kind === 'task',
    );
    const visible = dayEvents.slice(0, maxVisible);
    const hiddenCount = dayEvents.length - visible.length;
    const dayWeather = weather.get(key);
    const note = dayNotes.get(key);
    const rating = note?.rating ?? 0;
    const ratingMode = viewMode === 'rating';
    const isFirst = day.getDate() === 1;

    let bg: string | undefined;
    let fg: string | undefined;
    if (ratingMode && rating > 0) {
      bg = ratingColor(rating);
      fg = ratingTextColor(rating);
    } else if (viewMode === 'temperature' && dayWeather)
      bg = tempColor(dayWeather.tempMax);
    else if (viewMode === 'weather' && dayWeather)
      bg = WEATHER_BG[dayWeather.category];

    // 멀리 보기 / 크게 보기의 축소 주: 배경색(날씨/온도/별점) + 일정 점만 간단히.
    if (farLike) {
      const dots = allDayEvents.slice(0, MAX_DOTS);
      return (
        <div
          key={key}
          className={`calendar__day is-far ${key === today ? 'is-today' : ''} ${
            bg ? (fg ? 'has-bg-rating' : 'has-bg') : ''
          }`}
          style={bg ? { background: bg, color: fg } : undefined}
          onClick={selectDay}
        >
          <span className="calendar__daynum-far">
            {isFirst ? `${day.getMonth() + 1}/1` : day.getDate()}
          </span>
          {dots.length > 0 && (
            <span className="calendar__fardots">
              {dots.map((e) => (
                <span
                  key={e.id}
                  className="calendar__fardot"
                  style={{ backgroundColor: colorByCategory.get(e.categoryId) }}
                />
              ))}
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        key={key}
        className={`calendar__day ${key === today ? 'is-today' : ''} ${
          bg ? (fg ? 'has-bg-rating' : 'has-bg') : ''
        }`}
        style={bg ? { background: bg, color: fg } : undefined}
        onClick={() => onSelectDay(key)}
      >
        <div className="calendar__dayhead">
          {dayWeather && (
            <span className="calendar__weather">
              <WeatherIcon category={dayWeather.category} />
              <span className="calendar__temp">
                <span className={dayWeather.tempMin <= -5 ? 'is-extreme' : ''}>
                  {dayWeather.tempMin}°
                </span>
                /
                <span className={dayWeather.tempMax >= 30 ? 'is-extreme' : ''}>
                  {dayWeather.tempMax}°
                </span>
              </span>
            </span>
          )}
          {!dayWeather && isFirst && (
            <span className="calendar__monthlabel">{day.getMonth() + 1}월</span>
          )}
          <span className="calendar__dayright">
            {ratingMode && rating > 0 && (
              <span className="calendar__rating">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {rating}
              </span>
            )}
            <button
              className={`calendar__daynum ${isFirst ? 'is-first' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                selectDay();
              }}
            >
              {isFirst ? `${day.getMonth() + 1}/1` : day.getDate()}
            </button>
          </span>
        </div>
        {workout ? (
          <div className="calendar__workout">
            {WORKOUT_PARTS.map((part) => {
              const hit = findRecentWorkout(part, day);
              return (
                <div key={part} className="calendar__wslot">
                  {hit && (
                    <button
                      className={`calendar__wpart ${
                        hit.event.title.includes('PT') ? 'is-pt' : ''
                      }`}
                      style={{
                        backgroundColor: workoutColor,
                        opacity: WORKOUT_FADE[hit.daysAgo],
                      }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectEvent(hit.event);
                      }}
                      title={hit.event.title}
                    >
                      {part}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : ratingMode ? (
          note?.memo ? <div className="calendar__memo">{note.memo}</div> : null
        ) : (
          <>
            <div className="calendar__events">
              {visible.map((e) => {
                const color = colorByCategory.get(e.categoryId);
                if (e.kind === 'task') {
                  return (
                    <div
                      key={e.id}
                      className={`calendar__task ${e.done ? 'is-done' : ''}`}
                      style={{ '--cat': color } as React.CSSProperties}
                    >
                      <button
                        className="calendar__check"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onToggleDone(e);
                        }}
                        aria-label={e.done ? '완료 취소' : '완료'}
                      >
                        {e.done ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="4" width="16" height="16" rx="3" />
                          </svg>
                        )}
                      </button>
                      <button
                        className="calendar__task-title"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectEvent(e);
                        }}
                        title={e.title}
                      >
                        {e.title}
                      </button>
                    </div>
                  );
                }
                return (
                  <button
                    key={e.id}
                    className="calendar__event"
                    style={{ backgroundColor: color }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelectEvent(e);
                    }}
                    title={e.title}
                  >
                    {e.time && <span className="calendar__event-time">{e.time}</span>}
                    {e.title}
                  </button>
                );
              })}
              {hiddenCount > 0 && (
                <div className="calendar__more">+{hiddenCount}개</div>
              )}
            </div>
            {bars.length > 0 && (
              <div className="calendar__deadlines">
                {bars.map(({ event: e, role }) => (
                  <button
                    key={`${e.id}-${role}`}
                    className={`calendar__deadline calendar__bar--${role}`}
                    style={
                      { '--cat': colorByCategory.get(e.categoryId) } as React.CSSProperties
                    }
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelectEvent(e);
                    }}
                    title={e.title}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="calendar">
      <div className={`calendar__weekdays ${showWeekNumber ? 'has-weeknum' : ''}`}>
        {showWeekNumber && <div className="calendar__weeknum-head" />}
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`calendar__weekday ${i === 0 ? 'is-sun' : ''} ${
              i === 6 ? 'is-sat' : ''
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div
        className={`calendar__scroll ${zoomNear ? 'is-near' : ''}`}
        ref={scrollRef}
        onScroll={onScroll}
      >
        {weeks.map((week, i) => {
          const isFocused = zoomNear && focusedIndex === i;
          return (
            <div
              className={`calendar__week ${showWeekNumber ? 'has-weeknum' : ''} ${
                zoomFar ? 'is-far' : ''
              } ${isFocused ? 'is-near-focus' : ''}`}
              key={toDateKey(week[0])}
              ref={isFocused ? focusedRowRef : undefined}
            >
              {showWeekNumber && (
                <button
                  className="calendar__weeknum"
                  onClick={() => {
                    if (zoomNear) pinWeek(i);
                    else onSelectWeek(toDateKey(week[0]));
                  }}
                  title={zoomNear ? '이 주 확대' : '이 주 요약'}
                >
                  {weekOfYear(week[4])}
                </button>
              )}
              {week.map((day) =>
                renderDay(day, { farLike: zoomFar, expanded: isFocused, weekIndex: i }),
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
