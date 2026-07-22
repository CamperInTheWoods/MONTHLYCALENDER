import { useEffect, useRef, useState } from 'react';
import { dataStore } from '../store/dataStore';
import {
  isSyncConfigured,
  loadSyncConfig,
  pullRemote,
  pushRemote,
  type GithubSyncConfig,
} from '../lib/githubSync';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

// 앱 시작 시 1회 원격과 병합, 이후 로컬 데이터가 바뀔 때마다(디바운스) pull→merge→push.
// deps가 바뀔 때마다 재동기화를 예약한다(데이터가 바뀔 때만 deps를 넘기면 됨).
export function useGithubSync(deps: unknown[], onMerged: () => void) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const initialPullDone = useRef(false);
  const pushTimerRef = useRef<number | null>(null);
  const pushingRef = useRef(false);

  useEffect(() => {
    const cfg = loadSyncConfig();
    if (!isSyncConfigured(cfg)) return;
    (async () => {
      setStatus('syncing');
      try {
        const remote = await pullRemote(cfg);
        if (remote) {
          await dataStore.mergeAll(remote.data);
          onMerged();
        }
        setStatus('synced');
      } catch (err) {
        console.warn('GitHub 동기화(초기 pull) 실패', err);
        setStatus('error');
      } finally {
        initialPullDone.current = true;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPush(cfg: GithubSyncConfig, attempt = 0) {
    if (pushingRef.current) return;
    pushingRef.current = true;
    setStatus('syncing');
    try {
      // 다른 기기가 그새 올린 변경이 있을 수 있으니, push 전에 항상 다시 받아 병합한다.
      const remote = await pullRemote(cfg);
      const merged = remote
        ? await dataStore.mergeAll(remote.data)
        : await dataStore.exportAll();
      await pushRemote(cfg, merged, remote?.sha ?? null);
      setStatus('synced');
    } catch (err) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800));
        pushingRef.current = false;
        await runPush(cfg, attempt + 1);
        return;
      }
      console.warn('GitHub 동기화(push) 실패', err);
      setStatus('error');
    } finally {
      pushingRef.current = false;
    }
  }

  useEffect(() => {
    const cfg = loadSyncConfig();
    if (!isSyncConfigured(cfg)) return;
    if (!initialPullDone.current) return;
    if (pushTimerRef.current != null) window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(() => {
      pushTimerRef.current = null;
      void runPush(cfg);
    }, 3000);
    return () => {
      if (pushTimerRef.current != null) window.clearTimeout(pushTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { status };
}
