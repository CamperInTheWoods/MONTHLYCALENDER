// GitHub Contents API를 이용한 기기 간 동기화. 브라우저에서 CORS로 직접 호출 가능해
// 별도 백엔드 없이 개인 저장소에 데이터를 커밋/조회하는 방식으로 동작한다.
import type { BackupData } from '../store/dataStore';

export interface GithubSyncConfig {
  enabled: boolean;
  owner: string;
  repo: string;
  path: string;
  branch: string;
  token: string;
}

const KEY = 'layer-calendar-github-sync';

const DEFAULTS: GithubSyncConfig = {
  enabled: false,
  owner: '',
  repo: '',
  path: 'sync/layer-calendar-data.json',
  branch: 'main',
  token: '',
};

// 동기화 설정(특히 토큰)은 백업 JSON에 포함되지 않는 별도 localStorage 키에 기기별로 저장한다.
export function loadSyncConfig(): GithubSyncConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSyncConfig(config: GithubSyncConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config));
}

export function isSyncConfigured(config: GithubSyncConfig): boolean {
  return !!(config.enabled && config.owner && config.repo && config.token);
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function contentsUrl(cfg: GithubSyncConfig): string {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
}

// 원격 파일을 가져온다. 아직 없으면 null.
export async function pullRemote(
  cfg: GithubSyncConfig,
): Promise<{ data: BackupData; sha: string } | null> {
  const res = await fetch(`${contentsUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub pull 실패 (${res.status})`);
  const json = await res.json();
  const data = JSON.parse(fromBase64(json.content)) as BackupData;
  return { data, sha: json.sha as string };
}

// 원격 파일을 생성/갱신한다. sha가 있으면 그 버전 위에 갱신(없으면 신규 생성).
// 반환값은 갱신 후의 새 sha.
export async function pushRemote(
  cfg: GithubSyncConfig,
  data: BackupData,
  sha: string | null,
): Promise<string> {
  const res = await fetch(contentsUrl(cfg), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `동기화 ${new Date().toISOString()}`,
      content: toBase64(JSON.stringify(data, null, 2)),
      branch: cfg.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub push 실패 (${res.status}) ${body}`);
  }
  const json = await res.json();
  return json.content.sha as string;
}
