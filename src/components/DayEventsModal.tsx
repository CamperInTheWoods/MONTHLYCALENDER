import { useEffect } from 'react';
import type { Category, CalendarEvent } from '../types';
import './EventFormModal.css';
import './DayRecordModal.css';

interface Props {
  date: string; // YYYY-MM-DD
  events: CalendarEvent[]; // 그날 걸치는 일정 전체
  categories: Category[];
  onSelectEvent: (event: CalendarEvent) => void; // 일정 클릭 -> 수정
  onToggleDone: (event: CalendarEvent) => void; // 할 일 완료 토글
  onAddEvent: () => void; // 일정 추가
  onClose: () => void;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${wd})`;
}

const KIND_LABEL: Record<string, string> = {
  task: '할 일',
  deadline: '마감',
  period: '기간',
};

export function DayEventsModal({
  date,
  events,
  categories,
  onSelectEvent,
  onToggleDone,
  onAddEvent,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const colorOf = (id: string) =>
    categories.find((c) => c.id === id)?.color ?? '#999';

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal__header">
          <h2 className="modal__title">{formatDate(date)}</h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="field">
          <div className="day__events-head">
            <span className="field__label">일정</span>
            <button className="btn btn--ghost day__add" onClick={onAddEvent}>
              + 추가
            </button>
          </div>
          {events.length === 0 ? (
            <div className="day__empty">일정이 없습니다.</div>
          ) : (
            <ul className="day__list" style={{ maxHeight: '60vh' }}>
              {events.map((e) => (
                <li
                  key={e.id}
                  className={`day__row ${e.kind === 'task' && e.done ? 'is-done' : ''}`}
                >
                  {e.kind === 'task' ? (
                    <button
                      className="day__check"
                      onClick={() => onToggleDone(e)}
                      aria-label={e.done ? '완료 취소' : '완료'}
                      style={{ color: colorOf(e.categoryId) }}
                    >
                      {e.done ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="4" width="16" height="16" rx="3" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <span
                      className="day__dot"
                      style={{ backgroundColor: colorOf(e.categoryId) }}
                    />
                  )}
                  <button className="day__item" onClick={() => onSelectEvent(e)}>
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
        </div>
      </div>
    </div>
  );
}
