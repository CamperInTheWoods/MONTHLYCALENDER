import type { RecurrenceType, EndCondition } from '../types';
import { WEEKDAY_LABELS } from '../lib/date';
import './RecurrenceFields.css';

// 반복 설정 폼의 작업용 상태. 저장 시 Recurrence로 변환한다.
export interface RecurrenceDraft {
  type: RecurrenceType;
  weekdays: number[]; // weekly/biweekly
  monthDate: number; // monthlyDate
  nthWeek: number; // monthlyNthWeekday (1~4, -1=마지막)
  weekday: number; // monthlyNthWeekday
  endType: 'never' | 'date' | 'count';
  endDate: string;
  endCount: number;
}

// 시작 날짜로부터 기본 반복 드래프트를 만든다.
export function defaultDraft(startKey: string): RecurrenceDraft {
  const [, , d] = startKey.split('-').map(Number);
  const weekday = new Date(startKey).getDay();
  return {
    type: 'weekly',
    weekdays: [weekday],
    monthDate: d,
    nthWeek: Math.min(Math.ceil(d / 7), 4),
    weekday,
    endType: 'never',
    endDate: startKey,
    endCount: 10,
  };
}

export function draftToEndCondition(draft: RecurrenceDraft): EndCondition {
  if (draft.endType === 'date') return { type: 'date', value: draft.endDate };
  if (draft.endType === 'count') return { type: 'count', value: draft.endCount };
  return { type: 'never' };
}

const TYPE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'weekly', label: '매주 (요일 반복)' },
  { value: 'biweekly', label: '격주 (2주 간격)' },
  { value: 'monthlyDate', label: '매월 특정일' },
  { value: 'monthlyNthWeekday', label: '매월 특정 순번 요일' },
];

const NTH_OPTIONS = [
  { value: 1, label: '첫째' },
  { value: 2, label: '둘째' },
  { value: 3, label: '셋째' },
  { value: 4, label: '넷째' },
  { value: -1, label: '마지막' },
];

interface Props {
  value: RecurrenceDraft;
  onChange: (next: RecurrenceDraft) => void;
}

export function RecurrenceFields({ value, onChange }: Props) {
  const set = (patch: Partial<RecurrenceDraft>) =>
    onChange({ ...value, ...patch });

  const toggleWeekday = (wd: number) => {
    const has = value.weekdays.includes(wd);
    const next = has
      ? value.weekdays.filter((w) => w !== wd)
      : [...value.weekdays, wd].sort();
    set({ weekdays: next });
  };

  return (
    <div className="recur">
      <label className="field">
        <span className="field__label">반복 유형</span>
        <select
          className="field__input"
          value={value.type}
          onChange={(e) => set({ type: e.target.value as RecurrenceType })}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {(value.type === 'weekly' || value.type === 'biweekly') && (
        <div className="field">
          <span className="field__label">요일</span>
          <div className="recur__weekdays">
            {WEEKDAY_LABELS.map((label, wd) => (
              <button
                key={wd}
                type="button"
                className={`recur__wd ${
                  value.weekdays.includes(wd) ? 'is-on' : ''
                }`}
                onClick={() => toggleWeekday(wd)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.type === 'monthlyDate' && (
        <label className="field">
          <span className="field__label">매월 며칠</span>
          <input
            className="field__input"
            type="number"
            min={1}
            max={31}
            value={value.monthDate}
            onChange={(e) => set({ monthDate: Number(e.target.value) })}
          />
        </label>
      )}

      {value.type === 'monthlyNthWeekday' && (
        <div className="field-row">
          <label className="field">
            <span className="field__label">순번</span>
            <select
              className="field__input"
              value={value.nthWeek}
              onChange={(e) => set({ nthWeek: Number(e.target.value) })}
            >
              {NTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">요일</span>
            <select
              className="field__input"
              value={value.weekday}
              onChange={(e) => set({ weekday: Number(e.target.value) })}
            >
              {WEEKDAY_LABELS.map((label, wd) => (
                <option key={wd} value={wd}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="field">
        <span className="field__label">종료</span>
        <div className="recur__end">
          <label className="recur__end-row">
            <input
              type="radio"
              name="endType"
              checked={value.endType === 'never'}
              onChange={() => set({ endType: 'never' })}
            />
            <span>없음 (무기한)</span>
          </label>
          <label className="recur__end-row">
            <input
              type="radio"
              name="endType"
              checked={value.endType === 'date'}
              onChange={() => set({ endType: 'date' })}
            />
            <span>종료 날짜</span>
            <input
              className="field__input recur__end-input"
              type="date"
              value={value.endDate}
              disabled={value.endType !== 'date'}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          </label>
          <label className="recur__end-row">
            <input
              type="radio"
              name="endType"
              checked={value.endType === 'count'}
              onChange={() => set({ endType: 'count' })}
            />
            <span>반복 횟수</span>
            <input
              className="field__input recur__end-input"
              type="number"
              min={1}
              value={value.endCount}
              disabled={value.endType !== 'count'}
              onChange={(e) => set({ endCount: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
