# aicc-console

AICC 콘솔 형태의 포트폴리오 프로젝트입니다.  
캠페인/모니터링/대시보드/게시판(동적노드·공지·저작가이드) + 영업관리(contracts 칸반) 흐름을 중심으로 구현합니다.

---

## Tech Stack
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS + shadcn/ui
- @tanstack/react-query
- zod + react-hook-form
- lucide-react
- dnd-kit (칸반 Drag & Drop)
- Web Worker (동적노드 러너)
- (차트) Recharts 기반 대시보드 차트 컴포넌트

---

## Routes (App)

### Auth
- `/login` : 로그인 (Role 포함)

### Dashboard
- `/dashboard` : 대시보드(KPI + 추이/상태 분포 차트 + 최근 변경 리스트)

### Campaigns
- `/campaigns` : 캠페인 목록(검색/필터/페이지네이션/상태 토글 액션)
- `/campaigns/[id]` : 캠페인 상세

### Monitoring
- `/monitoring` : 모니터링(캠페인 리스트/상태/제어)

### Board
- `/board` : 게시판 홈
- `/board/dynnode` : 동적노드 목록(페이지네이션)
- `/board/dynnode/new` : 동적노드 작성
- `/board/dynnode/[id]` : 동적노드 상세/수정/삭제/실행

- `/board/notice` : 공지사항 목록
- `/board/notice/new` : 공지사항 작성
- `/board/notice/[id]` : 공지사항 상세/수정/삭제

- `/board/author-guide` : 저작가이드(CRUD, 공지/동적노드 패턴 재사용)

### Sales
- `/sales/activity-stats` : 영업 지표(카드/차트/요약)
- `/sales/contracts` : 영업현황관리(칸반 + 카드 클릭 시 Dialog/Modal 편집 + 가격책정/자동합계)

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

## Directory Map (현재 구조 기준)

```txt
aicc-console
├─ app
│  ├─ (auth)
│  ├─ (main)
│  │  ├─ board
│  │  │  ├─ author-guide
│  │  │  ├─ dynnode
│  │  │  ├─ notice
│  │  │  └─ layout.tsx
│  │  ├─ campaigns
│  │  │  ├─ [id]
│  │  │  ├─ CampaignListClient.tsx
│  │  │  ├─ CampaignsClient.tsx
│  │  │  └─ page.tsx
│  │  ├─ dashboard
│  │  │  ├─ DashboardCharts.tsx
│  │  │  ├─ DashboardClient.tsx
│  │  │  └─ page.tsx
│  │  ├─ monitoring
│  │  └─ sales
│  │     ├─ activity-stats
│  │     ├─ contracts
│  │     └─ layout.tsx
│  ├─ api
│  ├─ components
│  ├─ lib
│  ├─ globals.css
│  ├─ layout.tsx
│  ├─ page.tsx
│  └─ providers.tsx
│
├─ components
│  └─ (공용 UI/도메인 컴포넌트)
│
├─ data
│  ├─ authorGuide.json
│  ├─ campaigns.json
│  ├─ contracts.json
│  ├─ dynnode.json
│  ├─ monitoring.json
│  └─ notice.json
│
├─ lib
│  └─ (api 호출/타입/유틸/스토어)
└─ node_modules ...
