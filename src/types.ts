// 데이터 모델 (기획서 9장 기준)
// 2단계 동기화 대비: 모든 엔티티에 id, 변경 엔티티에 updatedAt 포함.

export interface Category {
  id: string;
  name: string;
  color: string; // hex
  order: number; // 탭 순서 = z-index 우선순위 (작을수록 왼쪽/위)
  workout?: boolean; // 운동 모드: 부위별(머리/어깨/가슴/하체) 고정 슬롯 표시
  updatedAt: number;
}

// 일정 종류. 'event'=기본 일정(색 칩), 'task'=완료 체크 가능한 할 일,
// 'deadline'=마감일 표시(셀 하단 막대), 'period'=기간 일정(시작~끝).
export type EventKind = 'event' | 'task' | 'deadline' | 'period';

export interface CalendarEvent {
  id: string;
  categoryId: string;
  title: string;
  date: string; // YYYY-MM-DD (기간 일정이면 시작일)
  endDate?: string | null; // YYYY-MM-DD (kind==='period'의 끝일)
  time: string | null; // HH:mm (시작)
  endTime?: string | null; // HH:mm (끝, 선택)
  memo: string | null;
  recurrenceId: string | null; // 반복 규칙에서 파생된 경우 해당 규칙 id
  kind?: EventKind; // 미지정 시 'event'로 취급 (기존 데이터 호환)
  done?: boolean; // kind==='task'일 때만 의미 있음
  updatedAt: number;
}

// 하루 단위 기록(평점/메모). 날짜당 하나. 일정과 별개.
export interface DayNote {
  date: string; // YYYY-MM-DD (키)
  rating: number; // 0~5, 0=평점 없음
  memo: string;
  updatedAt: number;
}

export type RecurrenceType =
  | 'weekly'
  | 'biweekly'
  | 'monthlyDate'
  | 'monthlyNthWeekday';

export type EndCondition =
  | { type: 'date'; value: string }
  | { type: 'count'; value: number }
  | { type: 'never' };

export interface Recurrence {
  id: string;
  categoryId: string;
  title: string;
  type: RecurrenceType;
  weekdays: number[] | null; // weekly/biweekly용 (0=일 ~ 6=토)
  monthDate: number | null; // monthlyDate용 (1~31)
  nthWeek: number | null; // monthlyNthWeekday용 (1~4, -1=마지막)
  weekday: number | null; // monthlyNthWeekday용 (0=일 ~ 6=토)
  startDate: string; // YYYY-MM-DD
  endCondition: EndCondition;
  time: string | null;
  memo: string | null;
  updatedAt: number;
}

// 삭제 기록(무덤). 다른 기기와 병합할 때, 상대가 더 오래된 레코드를 들고 있어도
// 삭제가 되살아나지(resurrect) 않도록 남겨둔다.
export type TombstoneStore = 'categories' | 'events' | 'recurrences' | 'dayNotes';
export interface Tombstone {
  key: string; // `${store}:${refId}` (idb keyPath)
  store: TombstoneStore;
  refId: string; // 원본 id (dayNotes는 date)
  deletedAt: number;
}
