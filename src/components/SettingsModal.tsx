import { useEffect, useRef, useState } from 'react';
import { geocode, type GeoResult } from '../lib/weather';
import { dataStore, type BackupData } from '../store/dataStore';
import { todayKey } from '../lib/date';
import {
  loadSyncConfig,
  saveSyncConfig,
  type GithubSyncConfig,
} from '../lib/githubSync';
import type { SyncStatus } from '../hooks/useGithubSync';
import './EventFormModal.css';

interface Props {
  location: GeoResult | null;
  showWeekNumber: boolean;
  syncStatus: SyncStatus;
  onShowWeekNumberChange: (v: boolean) => void;
  onSave: (location: GeoResult | null) => void;
  onClose: () => void;
}

const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  idle: '꺼짐',
  syncing: '동기화 중…',
  synced: '동기화됨',
  error: '동기화 실패 (설정/네트워크 확인)',
};

export function SettingsModal({
  location,
  showWeekNumber,
  syncStatus,
  onShowWeekNumberChange,
  onSave,
  onClose,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleExport = async () => {
    const data = await dataStore.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layer-calendar-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as BackupData;
      if (!Array.isArray(data.categories) || !Array.isArray(data.events)) {
        alert('올바른 백업 파일이 아닙니다.');
        return;
      }
      if (
        !window.confirm(
          '현재 이 기기의 데이터를 백업 파일 내용으로 교체합니다. 계속할까요?',
        )
      )
        return;
      await dataStore.importAll(data);
      window.location.reload();
    } catch {
      alert('가져오기에 실패했습니다. 파일을 확인하세요.');
    }
  };

  const [sync, setSync] = useState<GithubSyncConfig>(() => loadSyncConfig());
  const handleSyncSave = () => {
    saveSyncConfig(sync);
    // 켜짐/꺼짐 전환은 앱 시작 시 1회 로직에 반영돼야 하므로 새로고침해 확실히 적용한다.
    window.location.reload();
  };

  const [query, setQuery] = useState(location?.name ?? '');
  const [found, setFound] = useState<GeoResult | null>(location);
  const [status, setStatus] = useState<'idle' | 'loading' | 'notfound' | 'error'>(
    'idle',
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSearch = async () => {
    const name = query.trim();
    if (!name) return;
    setStatus('loading');
    try {
      const r = await geocode(name);
      if (!r) {
        setFound(null);
        setStatus('notfound');
      } else {
        setFound(r);
        setStatus('idle');
      }
    } catch {
      setStatus('error');
    }
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
          <h2 className="modal__title">설정 · 위치</h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__badge">
          날씨모드에 사용할 위치입니다. 도시명을 입력하고 검색하세요.
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">도시명</span>
            <input
              className="field__input"
              value={query}
              autoFocus
              placeholder="예: 서울, Tokyo, Paris"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </label>
          <button
            className="btn btn--ghost"
            onClick={handleSearch}
            style={{ alignSelf: 'flex-end' }}
          >
            검색
          </button>
        </div>

        {status === 'loading' && (
          <div className="modal__badge">검색 중…</div>
        )}
        {status === 'notfound' && (
          <div className="modal__badge">해당 도시를 찾지 못했습니다.</div>
        )}
        {status === 'error' && (
          <div className="modal__badge">검색 실패. 인터넷 연결을 확인하세요.</div>
        )}
        {found && status === 'idle' && (
          <div className="modal__badge">
            선택됨: {found.name}
            {found.country ? `, ${found.country}` : ''} (
            {found.lat.toFixed(2)}, {found.lon.toFixed(2)})
          </div>
        )}

        <label className="modal__repeat-toggle">
          <input
            type="checkbox"
            checked={showWeekNumber}
            onChange={(e) => onShowWeekNumberChange(e.target.checked)}
          />
          <span>달력 왼쪽에 주차 표시</span>
        </label>

        <div className="field">
          <span className="field__label">데이터 (다른 기기로 옮기기)</span>
          <div className="field-row">
            <button className="btn btn--ghost" onClick={handleExport}>
              내보내기(JSON)
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => fileRef.current?.click()}
            >
              가져오기
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>

        <div className="field">
          <span className="field__label">
            GitHub 자동 동기화 (현재: {SYNC_STATUS_LABEL[syncStatus]})
          </span>
          <label className="modal__repeat-toggle">
            <input
              type="checkbox"
              checked={sync.enabled}
              onChange={(e) => setSync({ ...sync, enabled: e.target.checked })}
            />
            <span>켜기 (일정 변경 시 자동으로 백업 파일을 커밋)</span>
          </label>
          <div className="field-row">
            <label className="field">
              <span className="field__label">owner</span>
              <input
                className="field__input"
                value={sync.owner}
                placeholder="예: CamperInTheWoods"
                onChange={(e) => setSync({ ...sync, owner: e.target.value.trim() })}
              />
            </label>
            <label className="field">
              <span className="field__label">repo</span>
              <input
                className="field__input"
                value={sync.repo}
                placeholder="예: MONTHLYCALENDER"
                onChange={(e) => setSync({ ...sync, repo: e.target.value.trim() })}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span className="field__label">branch</span>
              <input
                className="field__input"
                value={sync.branch}
                onChange={(e) => setSync({ ...sync, branch: e.target.value.trim() })}
              />
            </label>
            <label className="field">
              <span className="field__label">파일 경로</span>
              <input
                className="field__input"
                value={sync.path}
                onChange={(e) => setSync({ ...sync, path: e.target.value.trim() })}
              />
            </label>
          </div>
          <label className="field">
            <span className="field__label">Personal Access Token (repo 쓰기 권한)</span>
            <input
              className="field__input"
              type="password"
              value={sync.token}
              placeholder="ghp_..."
              onChange={(e) => setSync({ ...sync, token: e.target.value.trim() })}
            />
          </label>
          <div className="field-row">
            <button className="btn btn--ghost" onClick={handleSyncSave}>
              동기화 설정 저장
            </button>
          </div>
        </div>

        <div className="modal__footer">
          {location && (
            <button
              className="btn btn--danger"
              onClick={() => onSave(null)}
            >
              위치 지우기
            </button>
          )}
          <div className="modal__footer-right">
            <button className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
            <button
              className="btn btn--primary"
              onClick={() => onSave(found)}
              disabled={!found}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
