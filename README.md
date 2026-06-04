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
- `/login` : 로그인
- `/signup` : 회원가입 신청(관리자 승인제)
- `/guest` : 포트폴리오 관람용 게스트 진입
- `/admin/users` : 계정 승인/권한 관리(HEAD, ADMIN 전용)

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

DB 상태 확인:
- `api/health/db/route.ts`

인증/계정 관리:
- `api/auth/signup/route.ts`
- `api/auth/login/route.ts`
- `api/auth/guest/route.ts`
- `api/auth/logout/route.ts`
- `api/auth/me/route.ts`
- `api/admin/users/route.ts`

데이터 저장소:
- 런타임 데이터는 MySQL에 저장합니다.
- `data/*.json`은 초기 시드 원본으로만 사용합니다.

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
```

---

## DB 배포 환경 설정

이 프로젝트는 MySQL을 사용합니다. 로컬 개발은 로컬 MySQL, 배포는 Railway MySQL 또는 외부 MySQL 서버를 사용합니다.

### 로컬 개발

`aicc-console/.env.local`

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database_name
AUTH_SESSION_SECRET=replace_with_a_long_random_secret
AUTH_HEAD_EMAIL=head@example.com
AUTH_HEAD_PASSWORD=replace_with_head_password
AUTH_HEAD_NAME=Head Admin
```

초기 스키마와 시드 데이터 반영:

```bash
npm run db:setup
npm run db:check
```

`AUTH_HEAD_EMAIL`과 `AUTH_HEAD_PASSWORD`가 설정되어 있으면 `npm run db:setup` 시 최초 HEAD 관리자 계정이 생성됩니다. HEAD 계정은 `/admin/users`에서 가입 신청 승인, 반려, 역할 변경, 계정 삭제를 통솔할 수 있습니다.

### Vercel 배포

Vercel Project Settings > Environment Variables에 아래 값을 등록합니다.

```txt
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
```

Railway MySQL을 사용할 경우 Railway의 public host/port 값을 사용합니다. `mysql.railway.internal`은 Railway 내부 서비스 전용이라 Vercel이나 로컬 PC에서는 사용하지 않습니다.

배포 후 확인:

```txt
https://your-vercel-domain/api/health/db
```

정상 응답:

```json
{ "ok": true }
```

### 로컬 MySQL 데이터를 Railway로 옮기기

로컬 DB 백업:

```bash
mysqldump -u root -p DB_NAME > backup.sql
```

Railway MySQL로 복원:

```bash
mysql -h Railway_PUBLIC_HOST -P Railway_PUBLIC_PORT -u Railway_USER -p Railway_DATABASE < backup.sql
```

주의:

- `.env.local`은 커밋하지 않습니다.
- `backup.sql`은 민감 데이터가 들어갈 수 있으므로 커밋하지 않습니다.
- GitHub 접속이 제한된 환경에서는 `.env.local`, `.next/`, `node_modules/`, `backup.sql`을 제외하고 압축 파일로 옮깁니다.
