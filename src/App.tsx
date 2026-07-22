import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarGrid } from './components/CalendarGrid';
import { EventFormModal } from './components/EventFormModal';
import { CategoryFormModal } from './components/CategoryFormModal';
import { DayRecordModal } from './components/DayRecordModal';
import { DayEventsModal } from './components/DayEventsModal';
import { CategoryBriefModal } from './components/CategoryBriefModal';
import { SettingsModal } from './components/SettingsModal';
import { WeekSummaryModal } from './components/WeekSummaryModal';
import { TabBar, type ActiveTab } from './components/TabBar';
import { useAppData } from './hooks/useAppData';
import { useWeather } from './hooks/useWeather';
import { addMonths, buildWeeksRange, formatMonthTitle, toDateKey } from './lib/date';
import {
  loadSettings,
  saveSettings,
  type AppSettings,
  type ViewMode,
} from './lib/settings';
import type { GeoResult } from './lib/weather';
import type { CalendarEvent, Category, Recurrence } from './types';
import './App.css';

type EventModalState = { dateKey: string; event: CalendarEvent | null } | null;
// 카테고리 모달: 'new' 또는 수정 대상 Category
type CategoryModalState = { mode: 'new' } | { mode: 'edit'; category: Category } | null;

function App() {
  const {
    categories,
    events,
    loading,
    saveEvent,
    saveEvents,
    removeEvent,
    saveCategory,
    removeCategory,
    reorderCategories,
    saveRecurrence,
    removeRecurrence,
    dayNotes,
    saveDayNote,
  } = useAppData();
  const now = new Date();
  // anchor: 렌더 범위 중심월. visibleMonth: 스크롤로 실제 보이는 달(헤더 표시).
  const [anchor, setAnchor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [visible, setVisible] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [scrollTarget, setScrollTarget] = useState({ key: toDateKey(now), nonce: 1 });
  const year = visible.year;
  const month = visible.month;
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [eventModal, setEventModal] = useState<EventModalState>(null);
  const [categoryModal, setCategoryModal] = useState<CategoryModalState>(null);
  const [dayRecordDate, setDayRecordDate] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [briefCategory, setBriefCategory] = useState<Category | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoomFar, setZoomFar] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  // 테마를 <html data-theme>에 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const dataOn = settings.viewMode === 'weather' || settings.viewMode === 'temperature';
  const { weather, status: weatherStatus } = useWeather(
    dataOn,
    settings.location,
    year,
    month,
  );

  // 렌더할 주 범위: 앵커 앞뒤 24개월.
  const weeks = useMemo(
    () =>
      buildWeeksRange(
        new Date(anchor.year, anchor.month - 24, 1),
        new Date(anchor.year, anchor.month + 25, 0),
      ),
    [anchor],
  );

  // 특정 달로 이동(스크롤). 범위를 벗어나면 앵커를 옮겨 재생성.
  const goToMonth = (y: number, m: number) => {
    setVisible({ year: y, month: m });
    const diff = (y - anchor.year) * 12 + (m - anchor.month);
    if (Math.abs(diff) > 22) setAnchor({ year: y, month: m });
    setScrollTarget((prev) => ({
      key: toDateKey(new Date(y, m, 1)),
      nonce: prev.nonce + 1,
    }));
  };
  const go = (delta: number) => {
    const next = addMonths(year, month, delta);
    goToMonth(next.year, next.month);
  };
  const goToday = () => {
    const t = new Date();
    goToMonth(t.getFullYear(), t.getMonth());
    setScrollTarget((prev) => ({ key: toDateKey(t), nonce: prev.nonce + 1 }));
  };

  // 스크롤로 보이는 달이 바뀔 때만 헤더 갱신.
  const onVisibleMonthChange = (y: number, m: number) => {
    setVisible((prev) => (prev.year === y && prev.month === m ? prev : { year: y, month: m }));
  };

  // 모바일 좌우 스와이프로 월 이동
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  // 활성 탭이 운동 카테고리이면 부위 슬롯 모드
  const activeCategory =
    activeTab === 'all' ? null : categories.find((c) => c.id === activeTab) ?? null;
  const isWorkoutTab = !!activeCategory?.workout;
  const workoutCategory = categories.find((c) => c.workout) ?? null;
  // 운동 부위 슬롯은 운동 탭 + 운동 보기모드일 때만
  const workoutMode = isWorkoutTab && settings.viewMode === 'workout';

  // 활성 탭에 따른 일정 필터링. 'all'이면 전체(레이어 겹침), 개별이면 해당 카테고리만.
  const visibleEvents = useMemo(
    () =>
      activeTab === 'all'
        ? events
        : events.filter((e) => e.categoryId === activeTab),
    [events, activeTab],
  );

  // 특정 날짜에 걸치는 일정(기간 일정은 시작~끝 범위 포함)
  const eventsOnDay = (d: string) =>
    events
      .filter((e) =>
        e.kind === 'period'
          ? e.date <= d && (e.endDate ?? e.date) >= d
          : e.date === d,
      )
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const handleSaveEvent = (event: CalendarEvent) => {
    saveEvent(event);
    setEventModal(null);
  };
  const handleSaveManyEvents = (list: CalendarEvent[]) => {
    saveEvents(list);
    setEventModal(null);
  };
  const handleDeleteEvent = (id: string) => {
    removeEvent(id);
    setEventModal(null);
  };
  const handleSaveRecurrence = (recurrence: Recurrence) => {
    saveRecurrence(recurrence);
    setEventModal(null);
  };
  const handleDeleteRecurrence = (recurrenceId: string) => {
    removeRecurrence(recurrenceId);
    setEventModal(null);
  };

  const handleSaveCategory = (category: Category) => {
    saveCategory(category);
    setCategoryModal(null);
  };
  const handleDeleteCategory = (id: string) => {
    if (activeTab === id) setActiveTab('all');
    removeCategory(id);
    setCategoryModal(null);
  };

  // 보기 모드 전환(한 번에 하나). 날씨/기온은 위치가 없으면 설정창을 연다.
  const setMode = (mode: ViewMode) => {
    // 운동 보기는 운동 탭으로 자동 이동
    if (mode === 'workout' && workoutCategory && !isWorkoutTab)
      setActiveTab(workoutCategory.id);
    updateSettings({ viewMode: mode });
    if ((mode === 'weather' || mode === 'temperature') && !settings.location)
      setSettingsOpen(true);
  };

  const ALL_MODE_BUTTONS: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    {
      mode: 'off',
      label: '일반',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18M8 2v4M16 2v4" />
        </svg>
      ),
    },
    {
      mode: 'rating',
      label: '별점',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      mode: 'weather',
      label: '날씨',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 19a4.5 4.5 0 1 0 0-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6 19Z" />
        </svg>
      ),
    },
    {
      mode: 'temperature',
      label: '기온',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
        </svg>
      ),
    },
    {
      mode: 'workout',
      label: '운동',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12" />
        </svg>
      ),
    },
  ];
  // 운동 버튼은 운동 카테고리가 있을 때 노출 (누르면 운동 탭으로 이동)
  const MODE_BUTTONS = ALL_MODE_BUTTONS.filter(
    (b) => b.mode !== 'workout' || !!workoutCategory,
  );

  return (
    <div className="app">
      <header className="app__header">
        <button
          className="nav-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="설정"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>

        <div className="app__monthnav">
          <button className="nav-btn" onClick={() => go(-1)} aria-label="이전 달">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="app__title">{formatMonthTitle(year, month)}</h1>
          <button className="nav-btn" onClick={() => go(1)} aria-label="다음 달">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button className="today-btn" onClick={goToday}>
            오늘
          </button>
          <button
            className={`nav-btn ${zoomFar ? 'is-on' : ''}`}
            onClick={() => setZoomFar((v) => !v)}
            aria-label="멀리 보기"
            title={zoomFar ? '기본 보기' : '멀리 보기(1년 훑기)'}
          >
            {zoomFar ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4M11 8v6M8 11h6" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4M8 11h6" />
              </svg>
            )}
          </button>
        </div>

        <div className="app__modes">
          {MODE_BUTTONS.map((b) => (
            <button
              key={b.mode}
              className={`mode-btn ${settings.viewMode === b.mode ? 'is-on' : ''}`}
              onClick={() => setMode(b.mode)}
              aria-pressed={settings.viewMode === b.mode}
            >
              {b.icon}
              {b.label}
            </button>
          ))}
        </div>
      </header>

      <TabBar
        categories={categories}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onReorder={reorderCategories}
        onAddCategory={() => setCategoryModal({ mode: 'new' })}
        onEditCategory={(category) => setCategoryModal({ mode: 'edit', category })}
        onBriefCategory={(category) => setBriefCategory(category)}
      />

      {dataOn && !settings.location && (
        <button className="app__notice" onClick={() => setSettingsOpen(true)}>
          날씨/기온을 표시하려면 위치를 설정하세요. (눌러서 설정 열기)
        </button>
      )}
      {dataOn && settings.location && weatherStatus === 'loading' && (
        <div className="app__notice">날씨 불러오는 중…</div>
      )}
      {dataOn && settings.location && weatherStatus === 'error' && (
        <div className="app__notice">
          날씨를 불러오지 못했습니다. 인터넷 연결을 확인하세요.
        </div>
      )}
      {dataOn &&
        settings.location &&
        weatherStatus === 'ready' &&
        weather.size === 0 && (
          <div className="app__notice">
            이 달({settings.location.name})은 날씨 데이터 범위 밖입니다. (과거 약 3개월
            ~ 미래 16일만 지원)
          </div>
        )}

      {loading ? (
        <div className="app__loading">불러오는 중…</div>
      ) : (
        <div
          className="app__calendar"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <CalendarGrid
            weeks={weeks}
            events={visibleEvents}
            categories={categories}
            weather={weather}
            viewMode={settings.viewMode}
            workout={workoutMode}
            workoutColor={activeCategory?.color ?? '#3b6ef5'}
            zoomFar={zoomFar}
            showWeekNumber={settings.showWeekNumber}
            dayNotes={dayNotes}
            scrollTarget={scrollTarget}
            onVisibleMonthChange={onVisibleMonthChange}
            onSelectDay={(dateKey) => setDayRecordDate(dateKey)}
            onSelectWeek={(sundayKey) => setWeekStart(sundayKey)}
            onSelectEvent={(event) =>
              setEventModal({ dateKey: event.date, event })
            }
            onToggleDone={(event) =>
              saveEvent({ ...event, done: !event.done, updatedAt: Date.now() })
            }
          />
        </div>
      )}

      {eventModal && (
        <EventFormModal
          dateKey={eventModal.dateKey}
          event={eventModal.event}
          categories={categories}
          onSave={handleSaveEvent}
          onSaveMany={handleSaveManyEvents}
          onSaveRecurrence={handleSaveRecurrence}
          onDelete={handleDeleteEvent}
          onDeleteRecurrence={handleDeleteRecurrence}
          onClose={() => setEventModal(null)}
        />
      )}

      {categoryModal && (
        <CategoryFormModal
          category={categoryModal.mode === 'edit' ? categoryModal.category : null}
          nextOrder={categories.length}
          eventCount={
            categoryModal.mode === 'edit'
              ? events.filter((e) => e.categoryId === categoryModal.category.id)
                  .length
              : 0
          }
          onSave={handleSaveCategory}
          onDelete={handleDeleteCategory}
          onClose={() => setCategoryModal(null)}
        />
      )}

      {dayRecordDate &&
        (settings.viewMode === 'rating' ? (
          <DayRecordModal
            date={dayRecordDate}
            note={dayNotes.get(dayRecordDate) ?? null}
            onSave={(note) => saveDayNote(note)}
            onClose={() => setDayRecordDate(null)}
          />
        ) : (
          <DayEventsModal
            date={dayRecordDate}
            events={eventsOnDay(dayRecordDate)}
            categories={categories}
            onToggleDone={(event) =>
              saveEvent({ ...event, done: !event.done, updatedAt: Date.now() })
            }
            onSelectEvent={(event) => {
              setDayRecordDate(null);
              setEventModal({ dateKey: event.date, event });
            }}
            onAddEvent={() => {
              const d = dayRecordDate;
              setDayRecordDate(null);
              setEventModal({ dateKey: d, event: null });
            }}
            onClose={() => setDayRecordDate(null)}
          />
        ))}

      {weekStart && (
        <WeekSummaryModal
          sundayKey={weekStart}
          events={events}
          dayNotes={dayNotes}
          categories={categories}
          onSelectEvent={(event) => {
            setWeekStart(null);
            setEventModal({ dateKey: event.date, event });
          }}
          onSelectDay={(dateKey) => {
            setWeekStart(null);
            setDayRecordDate(dateKey);
          }}
          onClose={() => setWeekStart(null)}
        />
      )}

      {briefCategory && (
        <CategoryBriefModal
          category={briefCategory}
          events={events}
          onSelectEvent={(event) => {
            setBriefCategory(null);
            setEventModal({ dateKey: event.date, event });
          }}
          onClose={() => setBriefCategory(null)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          location={settings.location}
          showWeekNumber={settings.showWeekNumber}
          onShowWeekNumberChange={(v) => updateSettings({ showWeekNumber: v })}
          onSave={(location: GeoResult | null) => {
            updateSettings({ location });
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <button
        className="theme-toggle"
        onClick={() => {
          const order: typeof settings.theme[] = ['light', 'gray', 'dark'];
          const next = order[(order.indexOf(settings.theme) + 1) % order.length];
          updateSettings({ theme: next });
        }}
        aria-label="테마 전환"
        title={`테마: ${settings.theme}`}
      >
        {settings.theme === 'light' && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
          </svg>
        )}
        {settings.theme === 'gray' && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
          </svg>
        )}
        {settings.theme === 'dark' && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default App;
