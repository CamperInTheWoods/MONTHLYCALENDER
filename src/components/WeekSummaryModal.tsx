import { useEffect } from 'react';
import type { Category, CalendarEvent, DayNote } from '../types';
import { toDateKey, weekOfYear, WEEKDAY_LABELS } from '../lib/date';
import './EventFormModal.css';
import './DayRecordModal.css';
import './WeekSummaryModal.css';

interface Props {
  sundayKey: string; // 주 시작(일요일) YYYY-MM-DD
  events: CalendarEvent[];
  dayNotes: Map<string, DayNote>;
  categories: Category[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (dateKey: string) => void;
  onClose: () => void;
}

const KIND_LABEL: Record<string, string> = {
  task: '할 일',
  deadline: '마감',
  period: '기간',
};

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function WeekSummaryModal({
  sundayKey,
  events,
  dayNotes,
  categories,
  onSelectEvent,
  onSelectDay,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const start = parseKey(sundayKey);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const colorOf = (id: string) =>
    categories.find((c) => c.id === id)?.color ?? '#999';

  const eventsOn = (key: string) =>
    events
      .filter((e) =>
        e.kind === 'period'
          ? e.date <= key && (e.endDate ?? e.date) >= key
          : e.date === key,
      )
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const weekNo = weekOfYear(days[4]);
  const range = `${start.getMonth() + 1}/${start.getDate()} ~ ${
    days[6].getMonth() + 1
  }/${days[6].getDate()}`;

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal__header">
          <h2 className="modal__title">
            {weekNo}주차 <span className="week__range">{range}</span>
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="week__days">
          {days.map((d, i) => {
            const key = toDateKey(d);
            const dayEvents = eventsOn(key);
            const note = dayNotes.get(key);
            return (
              <div className="week__day" key={key}>
                <button className="week__dayhead" onClick={() => onSelectDay(key)}>
                  <span
                    className={`week__dow ${i === 0 ? 'is-sun' : ''} ${
                      i === 6 ? 'is-sat' : ''
                    }`}
                  >
                    {WEEKDAY_LABELS[i]} {d.getDate()}
                  </span>
                  {note && note.rating > 0 && (
                    <span className="week__rating">★ {note.rating}</span>
                  )}
                </button>

                {dayEvents.length === 0 ? (
                  <div className="week__empty">—</div>
                ) : (
                  <ul className="day__list">
                    {dayEvents.map((e) => (
                      <li key={e.id}>
                        <button
                          className="day__item"
                          onClick={() => onSelectEvent(e)}
                        >
                          <span
                            className="day__dot"
                            style={{ backgroundColor: colorOf(e.categoryId) }}
                          />
                          <span className="day__item-title">{e.title}</span>
                          {(e.time || (e.kind && e.kind !== 'event')) && (
                            <span className="day__item-meta">
                              {e.kind && e.kind !== 'event' && KIND_LABEL[e.kind]
                                ? KIND_LABEL[e.kind]
                                : ''}
                              {e.time
                                ? ` ${e.time}${e.endTime ? `~${e.endTime}` : ''}`
                                : ''}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {note?.memo && <div className="week__memo">{note.memo}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
