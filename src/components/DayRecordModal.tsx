import { useEffect, useState } from 'react';
import type { DayNote } from '../types';
import { StarRating } from './StarRating';
import './EventFormModal.css';

interface Props {
  date: string; // YYYY-MM-DD
  note: DayNote | null; // 기존 기록(없으면 null)
  onSave: (note: DayNote) => void;
  onClose: () => void;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${wd})`;
}

export function DayRecordModal({ date, note, onSave, onClose }: Props) {
  const [rating, setRating] = useState(note?.rating ?? 0);
  const [memo, setMemo] = useState(note?.memo ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = () => {
    onSave({ date, rating, memo: memo.trim(), updatedAt: Date.now() });
    onClose();
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
          <h2 className="modal__title">하루 기록</h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__badge">{formatDate(date)}</div>

        <div className="field">
          <span className="field__label">평점</span>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <label className="field">
          <span className="field__label">메모</span>
          <textarea
            className="field__input field__textarea"
            value={memo}
            autoFocus
            onChange={(e) => setMemo(e.target.value)}
            placeholder="오늘 하루를 기록하세요"
            rows={4}
          />
        </label>

        <div className="modal__footer">
          <div className="modal__footer-right">
            <button className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
            <button className="btn btn--primary" onClick={handleSave}>
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
