# aicc-console

AICC 콘솔 형태의 포트폴리오 프로젝트입니다.  
캠페인/모니터링/동적노드(러너) 흐름을 중심으로 구현합니다.

---

## Tech Stack
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS 
- @tanstack/react-query
- zod + react-hook-form
- Web Worker (동적노드 러너)

---

## Routes (App)
- `/login` : 로그인 (Role 포함)
- `/dashboard` : 대시보드/차트
- `/campaigns` : 캠페인 목록
- `/campaigns/[id]` : 캠페인 상세
- `/monitoring` : 모니터링(캠페인 리스트/상태/제어)

- `/board` : 게시판(보드)
- `/board/dynnode` : 동적노드 목록(페이지네이션)
- `/board/dynnode/new` : 동적노드 작성
- `/board/dynnode/[id]` : 동적노드 상세/수정/삭제/실행

- `/board/notice` : 공지사항 목록
- `/board/notice/new` : 공지사항 작성
- `/board/notice/[id]` : 공지사항 상세/수정/삭제

---

## API (Route Handlers)
> `route.ts` 기반으로 엔드포인트를 구성합니다.

- `api/campaigns/route.ts`
- `api/campaigns/[id]/route.ts`

- `api/dynnode/route.ts`
- `api/dynnode/[id]/route.ts`

- `api/notice/route.ts`
- `api/notice/[id]/route.ts`
- `api/notice/banner/route.ts`  ← 상단 배너용(고정 우선 + 최신 채움)

- `api/monitoring/summary/route.ts`
- `api/monitoring/run/[runId]/route.ts`
- `api/monitoring/campaigns/[id]/stop/route.ts`  ← 캠페인 중지 액션 엔드포인트


내부 상태/스토어:
- `api/_store/campaignStore.ts`

---

## Directory Map

```txt
aicc-console
├─ app
│  ├─ (auth)
│  │  └─ login
│  │     ├─ page.tsx
│  │     └─ layout.tsx
│  └─ (main)
│     ├─ board
│     │  ├─ dynnode
│     │  │  ├─ [id]/page.tsx
│     │  │  ├─ new/page.tsx
│     │  │  └─ page.tsx
│     │  ├─ notice
│     │  │  ├─ [id]/page.tsx
│     │  │  ├─ new/page.tsx
│     │  │  └─ page.tsx
│     │  └─ page.tsx
│     ├─ campaigns
│     │  └─ [id]
│     │     ├─ CampaignDetailClient.tsx
│     │     └─ page.tsx
│     ├─ monitoring
│     │  ├─ CampaignListClient.tsx
│     │  └─ page.tsx
│     ├─ dashboard
│     │  ├─ DashboardCharts.tsx
│     │  └─ page.tsx
│     └─ layout.tsx
│
├─ api
│  ├─ _store/campaignStore.ts
│  ├─ campaigns
│  │  ├─ [id]/route.ts
│  │  └─ route.ts
│  ├─ dynnode
│  │  ├─ [id]/route.ts
│  │  └─ route.ts
│  ├─ notice
│  │  ├─ banner/route.ts
│  │  ├─ [id]/route.ts
│  │  └─ route.ts
│  └─ monitoring
│     ├─ campaigns/[id]/stop/route.ts
│     ├─ run/[runId]/route.ts
│     └─ summary/route.ts
│
├─ components
│  ├─ auth
│  │  ├─ AuthGuard.tsx
│  │  └─ RequireAuth.tsx
│  ├─ dynnode
│  │  ├─ DynnodeRunner.tsx
│  │  └─ runner.worker.ts
│  ├─ notice
│  │  └─ NoticeBanner.tsx
│  ├─ layout/sidebar.tsx
│  └─ ui
│     ├─ alert-dialog.tsx
│     ├─ badge.tsx
│     ├─ button.tsx
│     ├─ card.tsx
│     ├─ collapsible.tsx
│     ├─ input.tsx
│     ├─ list.tsx
│     ├─ select.tsx
│     ├─ separator.tsx
│     ├─ skeleton.tsx
│     ├─ textarea.tsx
│     ├─ toaster.tsx
│     ├─ use-toast.ts
│     ├─ utils.ts
│     └─ visually-hidden.tsx
│
├─ lib
│  ├─ api
│  │  ├─ campaigns.ts
│  │  ├─ dynnode.ts
│  │  └─ notice.ts
│  ├─ auth
│  │  ├─ storage.tsx
│  │  ├─ types.tsx
│  │  └─ useMe.tsx
│  ├─ dynnode/store.ts
│  ├─ notice/store.ts
│  ├─ monitoring/store.ts
│  ├─ schemas/campaigns.tsx
│  ├─ types
│  │  ├─ campaign.tsx
│  │  └─ dynnode.ts
│  ├─ styles.ts
│  └─ ui.ts
│
├─ data
│  ├─ campaigns.json
│  ├─ dynnode.json
│  ├─ notice.json
│  └─ monitoring.json
│
├─ mocks
├─ scenarios
├─ globals.css
├─ layout.tsx
├─ page.tsx
├─ providers.tsx
└─ favicon.ico / icon.svg
```

---

## Current Status
- 인증/보호 라우팅: 로그인 플로우 + 권한(Role) 구조 구성
- 캠페인/모니터링/대시보드 기본 화면 구성

- **동적노드 게시판**
  - 목록(`/board/dynnode`)에 URL 쿼리 기반 페이지네이션(`page`, `pageSize`) 적용
    - React Query: `queryKey`에 `page/pageSize` 포함 + `keepPreviousData`로 페이지 전환 UX 개선
  - 작성(`/board/dynnode/new`) / 상세(`/board/dynnode/[id]`) CRUD 유지
  - 로딩 UX: 목록/작성/상세에 Skeleton 적용

- **공지사항 게시판**
  - 목록(`/board/notice`) / 작성(`/board/notice/new`) / 상세(`/board/notice/[id]`) CRUD 구현
  - 저장/삭제 성공/실패: toast 적용(커스텀 Button variant 사용)
  - Route Handler: 동적 라우트 `params` Promise 이슈 대응

- **공지 상단 배너(보드 공통)**
  - `/api/notice/banner` 기반으로 고정 우선 + 최신 공지 채움(최대 5개)
  - `NoticeBanner` 컴포넌트: Collapsible(접기/펼치기) + 아이콘(ChevronDown) 토글


---

## Notes
- 동적 라우트 Route Handler에서 `params`가 Promise로 들어오는 케이스 대응(Next.js App Router)
  - `type Ctx = { params: Promise<{ id: string }> }`
  - `const { id } = await params` 형태로 통일
- 러너는 **return 기반이 아니라 console.log 기반 출력**을 우선으로 설계
  - 예: `userMap.put('name','홍길동'); console.log(userMap.get('name'));`
  - 실무 스타일: `var res = JSON.parse(userMap.get('api:API01')); var data = res.body;`
- 공지 배너는 “표시/정렬 로직”을 FE가 아니라 **서버 배너 API**가 책임(고정 우선 + 최신 채움)


---

## Next Actions (Top Priority)
1) 공지 배너 접기/펼치기 상태 유지
   - `localStorage`에 open 상태 저장/복원(페이지 이동 후에도 유지)

2) 게시판 확장: **저작가이드** (단순 CRUD)
   - 공지/동적노드와 동일 패턴으로 세팅/구조 복제

3) 모니터링 화면 ‘캠페인 중지’ 버튼 동작 연결
   - `api/monitoring/campaigns/[id]/stop/route.ts` 호출 연결
   - 성공/실패 toast + UI 상태 반영(로딩/비활성/상태 업데이트)

4) (선택) 공지 배너 UX 고도화
   - “접힘 상태에서는 1건만 노출 / 펼치면 5건” 같은 미니 모드
   - 티커(자동 롤링)는 옵션으로 분리


---

## Git Workflow

> 여러 작업 환경에서 동일한 규칙으로 작업하기 위한 표준 워크플로우입니다.

### Branch Strategy
- `main`: 안정(공개/배포) 기준 브랜치
- 작업 브랜치(권장): `feat/<topic>`, `fix/<topic>`, `refactor/<topic>`, `chore/<topic>`
- 날짜가 필요하면 suffix로만: `feat/<topic>-<mmdd>`

### Daily Flow
```bash
git checkout main
git pull origin main
git checkout -b feat/<topic>

# work...
git add -A
git commit -m "[add] <what changed>"
git push -u origin feat/<topic>

git checkout main
git pull origin main
git merge --no-ff feat/<topic>
git push origin main
```

### Archive (Mail/Submit ZIP)
- 파일명: `aicc-console_<MMDD>.zip` (예: `aicc-console_0120.zip`)
- `git archive`는 **추적 파일만 포함**합니다.
- `.env.local`은 기본 제외(필요하면 `.env.example` 제공 또는 별도 전달)

```bash
# 기본(권장): 현재 HEAD 기준
git archive -o aicc-console_0120.zip HEAD

# 특정 브랜치/커밋 기준
git archive -o aicc-console_0120.zip feat/dynnode
# git archive -o aicc-console_0120.zip <commitSha>

# 특정 폴더만 압축
git archive -o aicc-console_0120.zip HEAD app data
```

