# 레이어 캘린더 (Layer Calendar)

카테고리별 일정을 "레이어"로 겹쳐 보거나 따로 보는 달력 앱. 일정 관리에 더해
날씨·기온·별점·운동 같은 여러 "보기 모드"로 하루하루를 색으로 훑어볼 수 있다.

## 주요 기능

- **카테고리 레이어 / 탭** — 카테고리별 색, 드래그로 순서(=겹침 우선순위) 변경, "전체" 겹쳐보기
- **일정 종류** — 일반 · 할 일(체크) · 마감(셀 하단 막대) · 기간(시작~끝, 시작=페이드아웃/끝=마감 스타일)
- **여러 날짜 일괄 등록**, 반복 일정(요일/격주/월간/순번요일 + 종료조건), 시작·끝 시간
- **세로 스크롤 달력** — 주 단위 스냅, 좌우 화살표로 먼 달 점프, "오늘" 복귀, "멀리 보기"(1년 훑기)
- **보기 모드** (한 번에 하나)
  - 일반 / 별점(평점 색) / 날씨(분류 색+아이콘+기온) / 기온(온도 색) / 운동(부위 슬롯)
  - 날씨·기온은 [Open-Meteo](https://open-meteo.com/)로 위치 기반 조회 (설정에 도시 입력)
- **하루 기록** — 날짜 클릭 시 그날 일정 모달 / 별점 모드에선 평점·메모 모달
- **주 요약** — 주차 숫자 클릭 시 그 주 7일 정리
- **카테고리 브리핑** — 그 카테고리의 다가오는 일정 목록
- **운동 모드** — 카테고리에 켜면 어깨·가슴·등·하체 고정 슬롯, 운동일부터 3일 페이드아웃, "PT" 포함 시 주황 테두리
- **테마** — 라이트 / 회색 / 다크 (왼쪽 아래 버튼 순환)
- **데이터 내보내기/가져오기(JSON)** — 기기 간 수동 이전용
- **GitHub 자동 동기화** — 설정 켜두면 여러 기기 데이터가 GitHub 저장소를 통해 자동으로 맞춰짐 (아래 별도 섹션 참고)

## 기술

- Vite + React + TypeScript
- 로컬 저장: IndexedDB (`idb`) — 저장소 접근은 `src/store/dataStore.ts` 로 추상화
- 기기 간 동기화: 별도 백엔드 없이 브라우저에서 GitHub Contents API를 직접 호출
  (`src/lib/githubSync.ts`, `src/hooks/useGithubSync.ts`) — 아래 "GitHub 자동 동기화" 참고
- 색상은 CSS 변수(디자인 토큰)로 관리, 이모지 없이 SVG 라인 아이콘

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드 -> dist/
npm run preview  # 빌드 결과 미리보기
```

## 데이터 저장과 기기 간 이전

일정·평점 등 데이터는 **브라우저 IndexedDB(기기별 로컬)** 에 저장된다. git으로는
코드만 옮겨지고 데이터는 따라가지 않는다. 기기 간 이전은 두 가지 방법이 있다.

### 수동: JSON 내보내기/가져오기

1. 설정(왼쪽 위 톱니) → **내보내기(JSON)** 로 백업 파일 저장
2. 다른 기기의 앱에서 설정 → **가져오기** 로 그 파일 불러오기

### 자동: GitHub 동기화 (설정에서 켜야 동작)

**중요: 이 앱은 코드에 git 명령을 직접 실행하지 않는다.** 브라우저 JS는 로컬
git/파일시스템에 접근할 권한이 없으므로, "동기화"는 브라우저에서 **GitHub REST
Contents API를 HTTPS로 직접 호출**해 저장소의 특정 JSON 파일 하나를
읽고/커밋하는 방식으로 구현되어 있다 (`src/lib/githubSync.ts`). 즉:

- **앱을 켤 때**: 그 파일을 GET으로 가져와 로컬 IndexedDB와 병합
- **일정/카테고리/메모 등을 바꿀 때**: 3초 디바운스 후 다시 GET → 병합 → PUT으로 커밋
  (`src/hooks/useGithubSync.ts`)
- **충돌 해결**: 전체 파일을 통째로 덮어쓰지 않는다. 카테고리/일정/메모/반복규칙을
  레코드(id) 단위로 비교해 `updatedAt`이 더 최신인 쪽을 채택하는 **last-write-wins
  병합**이다 (`dataStore.mergeAll`, `src/store/dataStore.ts`). 삭제는 "삭제
  기록(tombstone)"으로 남겨서, 상대 기기가 그 레코드를 아직 갖고 있어도(오래된
  버전) 삭제가 되살아나지 않게 한다.
- **동기화 대상 파일**: 리포 안의 한 JSON 파일(경로는 설정에서 지정, 기본값
  `sync/layer-calendar-data.json`). `backups/*.json`(수동 내보내기로 커밋해둔 것)과는
  별개이며 자동 동기화는 이 파일을 건드리지 않는다.
- **설정 위치**: 앱 안의 설정(⚙️) 모달 → "GitHub 자동 동기화" 섹션에서
  owner/repo/branch/파일경로/Personal Access Token(repo 쓰기 권한) 입력.
  이 값들은 `localStorage`에 **기기별로** 저장되고(`src/lib/githubSync.ts`의
  `loadSyncConfig`/`saveSyncConfig`), 백업 JSON이나 git에는 포함되지 않는다.
  즉 기기를 새로 추가할 때마다 그 기기에서 토큰을 다시 입력해야 한다.
- **동기화가 안 될 때**: 토큰 미설정/오프라인이면 조용히 실패하고 로컬 사용에는
  지장이 없다(콘솔 경고 + 설정 모달에 상태 텍스트로만 표시).

이 저장소를 처음 여는 Claude Code 세션이라면: 달력이 자동으로 새로고침되거나
데이터가 바뀌는 것처럼 보이는 원인이 바로 이 기능이다. 원격 push/pull이 아니라
**브라우저에서 직접 호출하는 GitHub API 폴링/커밋**이므로, git 훅이나 CI가 관여하지
않는다.

## 폴더 구조

```
src/
  lib/
    githubSync.ts   GitHub Contents API 호출(pull/push) — 동기화 대상 리포와는 별개
  store/
    dataStore.ts     IndexedDB 저장소 추상화 + mergeAll(레코드 단위 병합)
  hooks/
    useGithubSync.ts 시작 시 pull+병합, 변경 시 디바운스 push 오케스트레이션
    useAppData.ts    카테고리/일정/메모 로딩 및 CRUD (삭제 시 tombstone 기록)
  components/  달력 그리드, 탭바, 설정 모달(동기화 설정 UI 포함), 각종 모달
  styles/      디자인 토큰(테마)
  types.ts     데이터 모델 (Tombstone 타입 포함)
```
