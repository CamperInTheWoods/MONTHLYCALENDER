import { useEffect, useState } from 'react';
import type { Category, CalendarEvent, EventKind, Recurrence } from '../types';
import { newId } from '../lib/id';
import { todayKey } from '../lib/date';
import {
  RecurrenceFields,
  defaultDraft,
  draftToEndCondition,
  type RecurrenceDraft,
} from './RecurrenceFields';
import './EventFormModal.css';

const KIND_OPTIONS: { value: EventKind; label: string }[] = [
  { value: 'event', label: '일반' },
  { value: 'task', label: '할 일' },
  { value: 'deadline', label: '마감' },
  { value: 'period', label: '기간' },
];

interface Props {
  // 신규 등록 시 dateKey, 기존 수정 시 event 전달
  dateKey: string;
  event: CalendarEvent | null;
  categories: Category[];
  // 신규 등록 시 기본 선택할 카테고리(활성 탭이 특정 분류면 그 분류)
  defaultCategoryId?: string;
  onSave: (event: CalendarEvent) => void;
  onSaveMany: (events: CalendarEvent[]) => void; // 여러 날짜 일괄 등록
  onSaveRecurrence: (recurrence: Recurrence) => void;
  onDelete: (id: string) => void; // 이 일정만 삭제
  onDeleteRecurrence: (recurrenceId: string) => void; // 반복 전체 삭제
  onClose: () => void;
}

export function EventFormModal({
  dateKey,
  event,
  categories,
  defaultCategoryId,
  onSave,
  onSaveMany,
  onSaveRecurrence,
  onDelete,
  onDeleteRecurrence,
  onClose,
}: Props) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [categoryId, setCategoryId] = useState(
    event?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? '',
  );
  const [date, setDate] = useState(event?.date ?? dateKey);
  const [endDate, setEndDate] = useState(event?.endDate ?? dateKey); // 기간 끝일
  const [time, setTime] = useState(event?.time ?? '');
  const [endTime, setEndTime] = useState(event?.endTime ?? '');
  const [memo, setMemo] = useState(event?.memo ?? '');
  // 여러 날짜 일괄 등록용 (신규 + 비반복일 때만 사용)
  const [dates, setDates] = useState<string[]>([event?.date ?? dateKey]);
  const [newDate, setNewDate] = useState(dateKey);
  // 일정 종류 (일반 / 할 일 / 마감)
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'event');
  // 반복 설정 (신규 등록 시, 일반 일정에만 사용)
  const [repeat, setRepeat] = useState(false);
  const [draft, setDraft] = useState<RecurrenceDraft>(() =>
    defaultDraft(event?.date ?? dateKey),
  );

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isEdit = event !== null;
  const isRecurringInstance = event?.recurrenceId != null;
  // 과거 일정이면 "오늘도 하기" 제공
  const isPast = isEdit && event!.date < todayKey();
  const isPeriod = kind === 'period';
  // 여러 날짜 모드: 신규 등록이고 반복/기간이 아닐 때
  const multiDate = !isEdit && !repeat && !isPeriod;
  const needsWeekday =
    repeat && (draft.type === 'weekly' || draft.type === 'biweekly');
  const canSave =
    title.trim().length > 0 &&
    categoryId !== '' &&
    (!needsWeekday || draft.weekdays.length > 0) &&
    (!multiDate || dates.length > 0) &&
    (!isPeriod || endDate >= date);

  const addDate = () => {
    if (!newDate || dates.includes(newDate)) return;
    setDates((prev) => [...prev, newDate].sort());
  };
  const removeDate = (d: string) => setDates((prev) => prev.filter((x) => x !== d));

  // 한 날짜에 대한 일정 객체 생성 (기간이면 endDate 포함)
  const buildEvent = (d: string): CalendarEvent => ({
    id: newId(),
    categoryId,
    title: title.trim(),
    date: d,
    endDate: isPeriod ? endDate : null,
    time: time || null,
    endTime: endTime || null,
    memo: memo.trim() || null,
    recurrenceId: null,
    kind,
    done: false,
    updatedAt: Date.now(),
  });

  const handleSave = () => {
    if (!canSave) return;
    if (!isEdit && repeat) {
      const rec: Recurrence = {
        id: newId(),
        categoryId,
        title: title.trim(),
        type: draft.type,
        weekdays:
          draft.type === 'weekly' || draft.type === 'biweekly'
            ? draft.weekdays
            : null,
        monthDate: draft.type === 'monthlyDate' ? draft.monthDate : null,
        nthWeek: draft.type === 'monthlyNthWeekday' ? draft.nthWeek : null,
        weekday: draft.type === 'monthlyNthWeekday' ? draft.weekday : null,
        startDate: date,
        endCondition: draftToEndCondition(draft),
        time: time || null,
        memo: memo.trim() || null,
        updatedAt: Date.now(),
      };
      onSaveRecurrence(rec);
      return;
    }
    if (multiDate) {
      if (dates.length === 1) onSave(buildEvent(dates[0]));
      else onSaveMany(dates.map(buildEvent));
      return;
    }
    if (!isEdit) {
      // 신규 기간 일정 (multiDate가 아닌 경우)
      onSave(buildEvent(date));
      return;
    }
    // 수정
    onSave({
      id: event!.id,
      categoryId,
      title: title.trim(),
      date,
      endDate: isPeriod ? endDate : null,
      time: time || null,
      endTime: endTime || null,
      memo: memo.trim() || null,
      recurrenceId: event?.recurrenceId ?? null,
      kind,
      done: kind === 'task' ? (event?.done ?? false) : false,
      updatedAt: Date.now(),
    });
  };

  // 과거 일정을 오늘 날짜로 복제 생성한다(원본은 그대로).
  const handleDoToday = () => {
    if (!canSave) return;
    const today = todayKey();
    onSave({
      id: newId(),
      categoryId,
      title: title.trim(),
      date: today,
      endDate: isPeriod ? today : null,
      time: time || null,
      endTime: endTime || null,
      memo: memo.trim() || null,
      recurrenceId: null,
      kind,
      done: false,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal__header">
          <h2 className="modal__title">{isEdit ? '일정 수정' : '일정 추가'}</h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {isRecurringInstance && (
          <div className="modal__badge">반복 일정에서 생성된 일정입니다</div>
        )}

        <label className="field">
          <span className="field__label">제목</span>
          <input
            className="field__input"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정 제목"
          />
        </label>

        <label className="field">
          <span className="field__label">카테고리</span>
          <select
            className="field__input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {multiDate ? (
          <div className="field">
            <span className="field__label">날짜 (여러 개 추가 가능)</span>
            <div className="field-row">
              <input
                className="field__input"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <button
                type="button"
                className="btn btn--ghost"
                onClick={addDate}
                style={{ alignSelf: 'flex-end' }}
              >
                추가
              </button>
            </div>
            {dates.length > 0 && (
              <div className="datechips">
                {dates.map((d) => (
                  <span key={d} className="datechip">
                    {d.slice(5).replace('-', '/')}
                    <button
                      type="button"
                      className="datechip__x"
                      onClick={() => removeDate(d)}
                      aria-label="삭제"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : isPeriod ? (
          <div className="field-row">
            <label className="field">
              <span className="field__label">시작 날짜</span>
              <input
                className="field__input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">끝 날짜</span>
              <input
                className="field__input"
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
        ) : (
          <label className="field">
            <span className="field__label">{repeat ? '시작 날짜' : '날짜'}</span>
            <input
              className="field__input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}

        <div className="field-row">
          <label className="field">
            <span className="field__label">시작 시간 (선택)</span>
            <input
              className="field__input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">끝 시간 (선택)</span>
            <input
              className="field__input"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">메모 (선택)</span>
          <textarea
            className="field__input field__textarea"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
          />
        </label>

        {/* 종류 선택: 반복 인스턴스가 아니고 반복을 켜지 않은 경우에만 노출 */}
        {!isRecurringInstance && !repeat && (
          <div className="field">
            <span className="field__label">종류</span>
            <div className="kind-seg">
              {KIND_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`kind-seg__btn ${kind === o.value ? 'is-on' : ''}`}
                  onClick={() => setKind(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 반복 토글: 신규 등록이고 일반 일정일 때만 노출 (반복은 일반 일정 전용) */}
        {!isEdit && kind === 'event' && (
          <label className="modal__repeat-toggle">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
            />
            <span>반복 일정</span>
          </label>
        )}

        {!isEdit && repeat && (
          <RecurrenceFields value={draft} onChange={setDraft} />
        )}

        <div className="modal__footer">
          {isEdit &&
            (isRecurringInstance ? (
              <div className="modal__delete-group">
                <button
                  className="btn btn--danger"
                  onClick={() => onDelete(event!.id)}
                >
                  이 일정만 삭제
                </button>
                <button
                  className="btn btn--danger"
                  onClick={() => {
                    if (window.confirm('이 반복 일정 전체를 삭제할까요?'))
                      onDeleteRecurrence(event!.recurrenceId!);
                  }}
                >
                  반복 전체 삭제
                </button>
              </div>
            ) : (
              <button
                className="btn btn--danger"
                onClick={() => onDelete(event!.id)}
              >
                삭제
              </button>
            ))}
          <div className="modal__footer-right">
            {isPast && (
              <button
                className="btn btn--ghost"
                onClick={handleDoToday}
                disabled={!canSave}
              >
                오늘도 하기
              </button>
            )}
            <button className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSave}
              disabled={!canSave}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
