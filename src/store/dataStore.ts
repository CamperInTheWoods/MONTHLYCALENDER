// 저장소 추상화 레이어.
// UI/도메인 코드는 이 모듈의 인터페이스에만 의존한다.
// 1단계: IndexedDB(idb) 구현. 2단계: 동일 인터페이스로 서버 API 구현 교체.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Category, CalendarEvent, DayNote, Recurrence } from '../types';

// JSON Export/Import용 전체 백업 형식. (4단계에서 UI를 붙일 예정)
export interface BackupData {
  version: number;
  exportedAt: number;
  categories: Category[];
  events: CalendarEvent[];
  recurrences: Recurrence[];
  dayNotes: DayNote[];
}

export const BACKUP_VERSION = 1;

export interface DataStore {
  getCategories(): Promise<Category[]>;
  putCategory(category: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  getEvents(): Promise<CalendarEvent[]>;
  putEvent(event: CalendarEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;

  getRecurrences(): Promise<Recurrence[]>;
  putRecurrence(recurrence: Recurrence): Promise<void>;
  deleteRecurrence(id: string): Promise<void>;

  getDayNotes(): Promise<DayNote[]>;
  putDayNote(note: DayNote): Promise<void>;
  deleteDayNote(date: string): Promise<void>;

  // 전체 데이터 내보내기/가져오기 진입점.
  // 4단계에서 UI(파일 저장/열기)만 연결하면 동작하도록 미리 둔다.
  exportAll(): Promise<BackupData>;
  importAll(data: BackupData): Promise<void>;
}

interface LayerCalendarDB extends DBSchema {
  categories: { key: string; value: Category };
  events: { key: string; value: CalendarEvent; indexes: { byCategory: string } };
  recurrences: { key: string; value: Recurrence };
  dayNotes: { key: string; value: DayNote };
}

const DB_NAME = 'layer-calendar';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<LayerCalendarDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<LayerCalendarDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('categories', { keyPath: 'id' });
          const events = db.createObjectStore('events', { keyPath: 'id' });
          events.createIndex('byCategory', 'categoryId');
          db.createObjectStore('recurrences', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('dayNotes', { keyPath: 'date' });
        }
      },
    });
  }
  return dbPromise;
}

const idbStore: DataStore = {
  async getCategories() {
    return (await getDB()).getAll('categories');
  },
  async putCategory(category) {
    await (await getDB()).put('categories', category);
  },
  async deleteCategory(id) {
    await (await getDB()).delete('categories', id);
  },

  async getEvents() {
    return (await getDB()).getAll('events');
  },
  async putEvent(event) {
    await (await getDB()).put('events', event);
  },
  async deleteEvent(id) {
    await (await getDB()).delete('events', id);
  },

  async getRecurrences() {
    return (await getDB()).getAll('recurrences');
  },
  async putRecurrence(recurrence) {
    await (await getDB()).put('recurrences', recurrence);
  },
  async deleteRecurrence(id) {
    await (await getDB()).delete('recurrences', id);
  },

  async getDayNotes() {
    return (await getDB()).getAll('dayNotes');
  },
  async putDayNote(note) {
    await (await getDB()).put('dayNotes', note);
  },
  async deleteDayNote(date) {
    await (await getDB()).delete('dayNotes', date);
  },

  async exportAll() {
    const db = await getDB();
    const [categories, events, recurrences, dayNotes] = await Promise.all([
      db.getAll('categories'),
      db.getAll('events'),
      db.getAll('recurrences'),
      db.getAll('dayNotes'),
    ]);
    return {
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      categories,
      events,
      recurrences,
      dayNotes,
    };
  },

  // 기존 데이터를 비우고 백업 내용으로 교체한다.
  async importAll(data) {
    const db = await getDB();
    const tx = db.transaction(
      ['categories', 'events', 'recurrences', 'dayNotes'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('categories').clear(),
      tx.objectStore('events').clear(),
      tx.objectStore('recurrences').clear(),
      tx.objectStore('dayNotes').clear(),
    ]);
    await Promise.all([
      ...data.categories.map((c) => tx.objectStore('categories').put(c)),
      ...data.events.map((e) => tx.objectStore('events').put(e)),
      ...data.recurrences.map((r) => tx.objectStore('recurrences').put(r)),
      ...(data.dayNotes ?? []).map((n) => tx.objectStore('dayNotes').put(n)),
    ]);
    await tx.done;
  },
};

export const dataStore: DataStore = idbStore;
