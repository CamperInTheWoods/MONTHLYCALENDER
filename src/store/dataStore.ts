// 저장소 추상화 레이어.
// UI/도메인 코드는 이 모듈의 인터페이스에만 의존한다.
// 1단계: IndexedDB(idb) 구현. 2단계: 동일 인터페이스로 서버 API 구현 교체.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Category,
  CalendarEvent,
  DayNote,
  Recurrence,
  Tombstone,
  TombstoneStore,
} from '../types';

// JSON Export/Import용 전체 백업 형식. (4단계에서 UI를 붙일 예정)
export interface BackupData {
  version: number;
  exportedAt: number;
  categories: Category[];
  events: CalendarEvent[];
  recurrences: Recurrence[];
  dayNotes: DayNote[];
  tombstones?: Tombstone[]; // 다른 기기와 병합(동기화)할 때만 사용
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

  // 다른 기기(원격)의 백업과 로컬을 레코드 단위로 병합한다. (id별 updatedAt이 최신인 쪽 채택,
  // 삭제(tombstone)가 더 최신이면 삭제 유지). 병합 결과로 로컬을 덮어쓰고, 그 결과를 반환한다.
  mergeAll(remote: BackupData): Promise<BackupData>;
}

function tombKey(store: TombstoneStore, refId: string): string {
  return `${store}:${refId}`;
}

async function recordTombstone(
  db: IDBPDatabase<LayerCalendarDB>,
  store: TombstoneStore,
  refId: string,
) {
  await db.put('tombstones', {
    key: tombKey(store, refId),
    store,
    refId,
    deletedAt: Date.now(),
  });
}

interface LayerCalendarDB extends DBSchema {
  categories: { key: string; value: Category };
  events: { key: string; value: CalendarEvent; indexes: { byCategory: string } };
  recurrences: { key: string; value: Recurrence };
  dayNotes: { key: string; value: DayNote };
  tombstones: { key: string; value: Tombstone };
}

const DB_NAME = 'layer-calendar';
const DB_VERSION = 3;

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
        if (oldVersion < 3) {
          db.createObjectStore('tombstones', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// id(또는 date)별로 local/remote 중 updatedAt이 더 최신인 쪽을 채택하고,
// 그보다 더 최신인 삭제 기록(tombMap)이 있으면 제외한다.
function mergeEntities<T extends { updatedAt: number }>(
  local: T[],
  remote: T[],
  getKey: (item: T) => string,
  tombMap: Map<string, number>,
): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(getKey(item), item);
  for (const item of remote) {
    const key = getKey(item);
    const cur = map.get(key);
    if (!cur || item.updatedAt > cur.updatedAt) map.set(key, item);
  }
  for (const [key, deletedAt] of tombMap) {
    const cur = map.get(key);
    if (cur && deletedAt >= cur.updatedAt) map.delete(key);
  }
  return [...map.values()];
}

function mergeTombstones(local: Tombstone[], remote: Tombstone[]): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const t of [...local, ...remote]) {
    const cur = map.get(t.key);
    if (!cur || t.deletedAt > cur.deletedAt) map.set(t.key, t);
  }
  return [...map.values()];
}

const idbStore: DataStore = {
  async getCategories() {
    return (await getDB()).getAll('categories');
  },
  async putCategory(category) {
    await (await getDB()).put('categories', category);
  },
  async deleteCategory(id) {
    const db = await getDB();
    await db.delete('categories', id);
    await recordTombstone(db, 'categories', id);
  },

  async getEvents() {
    return (await getDB()).getAll('events');
  },
  async putEvent(event) {
    await (await getDB()).put('events', event);
  },
  async deleteEvent(id) {
    const db = await getDB();
    await db.delete('events', id);
    await recordTombstone(db, 'events', id);
  },

  async getRecurrences() {
    return (await getDB()).getAll('recurrences');
  },
  async putRecurrence(recurrence) {
    await (await getDB()).put('recurrences', recurrence);
  },
  async deleteRecurrence(id) {
    const db = await getDB();
    await db.delete('recurrences', id);
    await recordTombstone(db, 'recurrences', id);
  },

  async getDayNotes() {
    return (await getDB()).getAll('dayNotes');
  },
  async putDayNote(note) {
    await (await getDB()).put('dayNotes', note);
  },
  async deleteDayNote(date) {
    const db = await getDB();
    await db.delete('dayNotes', date);
    await recordTombstone(db, 'dayNotes', date);
  },

  async exportAll() {
    const db = await getDB();
    const [categories, events, recurrences, dayNotes, tombstones] = await Promise.all([
      db.getAll('categories'),
      db.getAll('events'),
      db.getAll('recurrences'),
      db.getAll('dayNotes'),
      db.getAll('tombstones'),
    ]);
    return {
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      categories,
      events,
      recurrences,
      dayNotes,
      tombstones,
    };
  },

  // 기존 데이터를 비우고 백업 내용으로 교체한다.
  async importAll(data) {
    const db = await getDB();
    const tx = db.transaction(
      ['categories', 'events', 'recurrences', 'dayNotes', 'tombstones'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('categories').clear(),
      tx.objectStore('events').clear(),
      tx.objectStore('recurrences').clear(),
      tx.objectStore('dayNotes').clear(),
      tx.objectStore('tombstones').clear(),
    ]);
    await Promise.all([
      ...data.categories.map((c) => tx.objectStore('categories').put(c)),
      ...data.events.map((e) => tx.objectStore('events').put(e)),
      ...data.recurrences.map((r) => tx.objectStore('recurrences').put(r)),
      ...(data.dayNotes ?? []).map((n) => tx.objectStore('dayNotes').put(n)),
      ...(data.tombstones ?? []).map((t) => tx.objectStore('tombstones').put(t)),
    ]);
    await tx.done;
  },

  // 원격(다른 기기) 백업을 로컬과 레코드 단위로 병합해 로컬을 갱신하고, 병합 결과를 반환한다.
  async mergeAll(remote) {
    const db = await getDB();
    const [localCats, localEvs, localRecs, localNotes, localTombs] = await Promise.all([
      db.getAll('categories'),
      db.getAll('events'),
      db.getAll('recurrences'),
      db.getAll('dayNotes'),
      db.getAll('tombstones'),
    ]);

    const mergedTombs = mergeTombstones(localTombs, remote.tombstones ?? []);
    const tombMapFor = (store: TombstoneStore) => {
      const m = new Map<string, number>();
      for (const t of mergedTombs) if (t.store === store) m.set(t.refId, t.deletedAt);
      return m;
    };

    const mergedCats = mergeEntities(
      localCats,
      remote.categories,
      (c) => c.id,
      tombMapFor('categories'),
    );
    const mergedEvs = mergeEntities(
      localEvs,
      remote.events,
      (e) => e.id,
      tombMapFor('events'),
    );
    const mergedRecs = mergeEntities(
      localRecs,
      remote.recurrences,
      (r) => r.id,
      tombMapFor('recurrences'),
    );
    const mergedNotes = mergeEntities(
      localNotes,
      remote.dayNotes,
      (n) => n.date,
      tombMapFor('dayNotes'),
    );

    const tx = db.transaction(
      ['categories', 'events', 'recurrences', 'dayNotes', 'tombstones'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('categories').clear(),
      tx.objectStore('events').clear(),
      tx.objectStore('recurrences').clear(),
      tx.objectStore('dayNotes').clear(),
      tx.objectStore('tombstones').clear(),
    ]);
    await Promise.all([
      ...mergedCats.map((c) => tx.objectStore('categories').put(c)),
      ...mergedEvs.map((e) => tx.objectStore('events').put(e)),
      ...mergedRecs.map((r) => tx.objectStore('recurrences').put(r)),
      ...mergedNotes.map((n) => tx.objectStore('dayNotes').put(n)),
      ...mergedTombs.map((t) => tx.objectStore('tombstones').put(t)),
    ]);
    await tx.done;

    return {
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      categories: mergedCats,
      events: mergedEvs,
      recurrences: mergedRecs,
      dayNotes: mergedNotes,
      tombstones: mergedTombs,
    };
  },
};

export const dataStore: DataStore = idbStore;
