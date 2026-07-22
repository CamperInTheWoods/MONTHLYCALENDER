import { useEffect, useRef, useState } from 'react';
import type { Category } from '../types';
import './TabBar.css';

export type ActiveTab = 'all' | string; // 'all' 또는 categoryId

interface Props {
  categories: Category[];
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onReorder: (ordered: Category[]) => void;
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
  onBriefCategory: (category: Category) => void;
}

const DRAG_THRESHOLD = 6;

export function TabBar({
  categories,
  activeTab,
  onSelectTab,
  onReorder,
  onAddCategory,
  onEditCategory,
  onBriefCategory,
}: Props) {
  // 드래그 중 실시간 순서 반영용 로컬 복사본. props 변경 시 동기화.
  const [order, setOrder] = useState(categories);
  useEffect(() => setOrder(categories), [categories]);

  const tabRefs = useRef(new Map<string, HTMLElement>());
  const drag = useRef<{
    id: string;
    startX: number;
    moved: boolean;
  } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    drag.current = { id, startX: e.clientX, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDragId(d.id);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    // 포인터 위치가 속한 탭 인덱스를 찾아 실시간 재배치
    const ids = order.map((c) => c.id);
    const fromIdx = ids.indexOf(d.id);
    let toIdx = fromIdx;
    for (let i = 0; i < order.length; i++) {
      const el = tabRefs.current.get(order[i].id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) {
        toIdx = i;
        break;
      }
      toIdx = i;
    }
    if (toIdx !== fromIdx) {
      const next = [...order];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      setOrder(next);
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragId(null);
    if (d?.moved) onReorder(order);
  };

  const handleClick = (id: string) => {
    // 드래그였다면 선택을 막는다.
    if (dragId) return;
    onSelectTab(id);
  };

  return (
    <div className="tabbar">
      <button
        className={`tab tab--all ${activeTab === 'all' ? 'is-active' : ''}`}
        onClick={() => onSelectTab('all')}
      >
        전체
      </button>

      {order.map((c) => (
        <button
          key={c.id}
          ref={(el) => {
            if (el) tabRefs.current.set(c.id, el);
            else tabRefs.current.delete(c.id);
          }}
          className={`tab ${activeTab === c.id ? 'is-active' : ''} ${
            dragId === c.id ? 'is-dragging' : ''
          }`}
          style={
            {
              '--tab-color': c.color,
            } as React.CSSProperties
          }
          onPointerDown={(e) => onPointerDown(e, c.id)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => handleClick(c.id)}
        >
          <span className="tab__dot" style={{ backgroundColor: c.color }} />
          {c.name}
          {activeTab === c.id && (
            <>
              <span
                className="tab__edit"
                role="button"
                aria-label={`${c.name} 브리핑`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onBriefCategory(c);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M8 13h8M8 17h6" />
                </svg>
              </span>
              <span
                className="tab__edit"
                role="button"
                aria-label={`${c.name} 편집`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCategory(c);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </span>
            </>
          )}
        </button>
      ))}

      <button className="tab tab--add" onClick={onAddCategory} aria-label="카테고리 추가">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
