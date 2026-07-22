import { useEffect, useState } from 'react';
import type { Category } from '../types';
import { newId } from '../lib/id';
import { COLOR_PRESETS } from '../lib/colors';
import './EventFormModal.css';
import './CategoryFormModal.css';

interface Props {
  // 신규 생성 시 category=null, 수정 시 기존 category 전달
  category: Category | null;
  // 신규 생성 시 부여할 order (탭 맨 끝)
  nextOrder: number;
  eventCount: number; // 삭제 확인용: 이 카테고리에 속한 일정 수
  onSave: (category: Category) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function CategoryFormModal({
  category,
  nextOrder,
  eventCount,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? COLOR_PRESETS[0]);
  const [workout, setWorkout] = useState(category?.workout ?? false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isEdit = category !== null;
  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: category?.id ?? newId(),
      name: name.trim(),
      color,
      order: category?.order ?? nextOrder,
      workout,
      updatedAt: Date.now(),
    });
  };

  const handleDelete = () => {
    if (!category) return;
    const msg =
      eventCount > 0
        ? `'${category.name}' 카테고리와 일정 ${eventCount}개가 함께 삭제됩니다. 계속할까요?`
        : `'${category.name}' 카테고리를 삭제할까요?`;
    if (window.confirm(msg)) onDelete(category.id);
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
          <h2 className="modal__title">
            {isEdit ? '카테고리 수정' : '카테고리 추가'}
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <label className="field">
          <span className="field__label">이름</span>
          <input
            className="field__input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="카테고리 이름"
          />
        </label>

        <div className="field">
          <span className="field__label">색상</span>
          <div className="color-picker">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`color-swatch ${color === preset ? 'is-selected' : ''}`}
                style={{ backgroundColor: preset }}
                onClick={() => setColor(preset)}
                aria-label={preset}
              />
            ))}
            <label className="color-swatch color-swatch--custom" title="커스텀 색상">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
        </div>

        <label className="modal__repeat-toggle">
          <input
            type="checkbox"
            checked={workout}
            onChange={(e) => setWorkout(e.target.checked)}
          />
          <span>운동 모드 (어깨·가슴·등·하체 부위별 슬롯 표시)</span>
        </label>

        <div className="modal__footer">
          {isEdit && (
            <button className="btn btn--danger" onClick={handleDelete}>
              삭제
            </button>
          )}
          <div className="modal__footer-right">
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
