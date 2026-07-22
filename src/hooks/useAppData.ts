import { useCallback, useEffect, useState } from 'react';
import { dataStore } from '../store/dataStore';
import { newId } from '../lib/id';
import { COLOR_PRESETS } from '../lib/colors';
import { generateOccurrences } from '../lib/recurrence';
import type { Category, CalendarEvent, DayNote, Recurrence } from '../types';

// 앱 전역 데이터(카테고리/일정) 로딩 및 변경을 담당하는 훅.
// dataStore 추상화만 사용하므로 저장소 구현이 바뀌어도 이 훅은 그대로다.
export function useAppData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dayNotes, setDayNotes] = useState<Map<string, DayNote>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      let cats = await dataStore.getCategories();
      // 최초 실행 시 기본 카테고리 한 개 시드 (일정 등록에 카테고리가 필수이므로)
      if (cats.length === 0) {
        const seed: Category = {
          id: newId(),
          name: '일반',
          color: COLOR_PRESETS[0],
          order: 0,
          updatedAt: Date.now(),
        };
        await dataStore.putCategory(seed);
        cats = [seed];
      }
      const evs = await dataStore.getEvents();
      const notes = await dataStore.getDayNotes();
      if (!active) return;
      setCategories(cats.sort((a, b) => a.order - b.order));
      setEvents(evs);
      setDayNotes(new Map(notes.map((n) => [n.date, n])));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveEvent = useCallback(async (event: CalendarEvent) => {
    await dataStore.putEvent(event);
    setEvents((prev) => {
      const rest = prev.filter((e) => e.id !== event.id);
      return [...rest, event];
    });
  }, []);

  const removeEvent = useCallback(async (id: string) => {
    await dataStore.deleteEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // 여러 일정을 한 번에 저장 (여러 날짜 일괄 등록용)
  const saveEvents = useCallback(async (list: CalendarEvent[]) => {
    await Promise.all(list.map((e) => dataStore.putEvent(e)));
    setEvents((prev) => [...prev, ...list]);
  }, []);

  const saveCategory = useCallback(async (category: Category) => {
    await dataStore.putCategory(category);
    setCategories((prev) => {
      const rest = prev.filter((c) => c.id !== category.id);
      return [...rest, category].sort((a, b) => a.order - b.order);
    });
  }, []);

  // 카테고리 삭제 시 해당 카테고리의 일정도 함께 삭제한다.
  const removeCategory = useCallback(async (id: string) => {
    const targets = (await dataStore.getEvents()).filter(
      (e) => e.categoryId === id,
    );
    await Promise.all(targets.map((e) => dataStore.deleteEvent(e.id)));
    await dataStore.deleteCategory(id);
    setEvents((prev) => prev.filter((e) => e.categoryId !== id));
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // 새 order대로 정렬된 카테고리 배열을 받아 order를 재부여하고 저장한다.
  const reorderCategories = useCallback(async (ordered: Category[]) => {
    const updated = ordered.map((c, i) => ({
      ...c,
      order: i,
      updatedAt: Date.now(),
    }));
    setCategories(updated);
    await Promise.all(updated.map((c) => dataStore.putCategory(c)));
  }, []);

  // 반복 규칙을 저장하고, 발생일마다 개별 일정 인스턴스를 생성한다.
  const saveRecurrence = useCallback(async (recurrence: Recurrence) => {
    await dataStore.putRecurrence(recurrence);
    const instances: CalendarEvent[] = generateOccurrences(recurrence).map(
      (date) => ({
        id: newId(),
        categoryId: recurrence.categoryId,
        title: recurrence.title,
        date,
        time: recurrence.time,
        memo: recurrence.memo,
        recurrenceId: recurrence.id,
        updatedAt: Date.now(),
      }),
    );
    await Promise.all(instances.map((e) => dataStore.putEvent(e)));
    setEvents((prev) => [...prev, ...instances]);
  }, []);

  // 반복 규칙과 그로부터 생성된 모든 인스턴스를 함께 삭제한다.
  const removeRecurrence = useCallback(async (recurrenceId: string) => {
    const targets = (await dataStore.getEvents()).filter(
      (e) => e.recurrenceId === recurrenceId,
    );
    await Promise.all(targets.map((e) => dataStore.deleteEvent(e.id)));
    await dataStore.deleteRecurrence(recurrenceId);
    setEvents((prev) => prev.filter((e) => e.recurrenceId !== recurrenceId));
  }, []);

  // 하루 기록(평점/메모) 저장. 평점 0이고 메모가 비면 기록을 삭제한다.
  const saveDayNote = useCallback(async (note: DayNote) => {
    if (note.rating === 0 && note.memo.trim() === '') {
      await dataStore.deleteDayNote(note.date);
      setDayNotes((prev) => {
        const next = new Map(prev);
        next.delete(note.date);
        return next;
      });
      return;
    }
    await dataStore.putDayNote(note);
    setDayNotes((prev) => new Map(prev).set(note.date, note));
  }, []);

  return {
    categories,
    events,
    dayNotes,
    loading,
    saveEvent,
    saveEvents,
    removeEvent,
    saveCategory,
    removeCategory,
    reorderCategories,
    saveRecurrence,
    removeRecurrence,
    saveDayNote,
  };
}
