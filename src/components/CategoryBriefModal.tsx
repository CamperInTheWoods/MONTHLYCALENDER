import { useEffect } from 'react';
import type { Category, CalendarEvent } from '../types';
import { todayKey } from '../lib/date';
import './EventFormModal.css';
import './DayRecordModal.css';

interface Props {
  category: Category;
  events: CalendarEvent[]; // 전체 일정
  onSelectEvent: (event: CalendarEvent) => void;
  onClose: () => void;
}

const KIND_LABEL: Record<string, string> = {
  task: '할 일',
  deadline: '마감',
  period: '기간',
};

function formatDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()];
  return `${m}/${d}(${wd})`;
}
// 기간 끝 날짜는 요일 없이 짧게
function formatShort(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

export function CategoryBriefModal({
  category,
  events,
  onSelectEvent,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const today = todayKey();
  // 이 카테고리의 다가오는 일정(오늘 이후, 기간은 끝나지 않은 것)
  const upcoming = events
    .filter((e) => e.categoryId === category.id)
    .filter((e) =>
      e.kind === 'period' ? (e.endDate ?? e.date) >= today : e.date >= today,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal__header">
          <h2 className="modal__title">
            <span
              className="day__dot"
              style={{ backgroundColor: category.color, marginRight: 8 }}
            />
            {category.name} 브리핑
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__badge">다가오는 일정 {upcoming.length}개</div>

        {upcoming.length === 0 ? (
          <div className="day__empty">예정된 일정이 없습니다.</div>
        ) : (
          <ul className="day__list" style={{ maxHeight: '60vh' }}>
            {upcoming.map((e) => (
              <li key={e.id} className="day__row">
                <span
                  className="brief__date"
                  style={{ color: e.date === today ? 'var(--color-accent)' : undefined }}
                >
                  {formatDate(e.date)}
                  {e.kind === 'period' && e.endDate ? `~${formatShort(e.endDate)}` : ''}
                </span>
                <button className="day__item" onClick={() => onSelectEvent(e)}>
                  <span className="day__item-title">{e.title}</span>
                  {(e.time || (e.kind && e.kind !== 'event')) && (
                    <span className="day__item-meta">
                      {e.kind && e.kind !== 'event' && KIND_LABEL[e.kind]
                        ? KIND_LABEL[e.kind]
                        : ''}
                      {e.time ? ` ${e.time}${e.endTime ? `~${e.endTime}` : ''}` : ''}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
