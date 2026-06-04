# AICC Management Console

금융권 AICC 운영 환경을 가정해 제작한 통합 관리 콘솔 포트폴리오입니다.

캠페인과 모니터링 중심의 기존 콘솔을 MySQL 기반 운영 포털로 확장했습니다.
인증·권한, 계정 승인, 결재, 알림, 인사, 영업, 사업용 회선, 게시판 데이터를 하나의 콘솔에서 관리합니다.

## 주요 특징

- **MySQL 기반 데이터 관리**: Railway MySQL 또는 로컬 MySQL 연결
- **승인형 계정 시스템**: 회원가입 후 관리자 승인, 역할별 접근 제어
- **운영 업무 통합**: 캠페인, 모니터링, 결재, 알림, 인사, 영업관리
- **포트폴리오 게스트 모드**: 읽기 전용 `VIEWER` 계정 제공
- **배포 환경 대응**: Vercel + Railway MySQL 구성 및 DB 상태 확인 API
- **초기 데이터 자동화**: 스키마 생성과 도메인별 시드 스크립트 제공

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, Radix UI, lucide-react |
| Server State | TanStack Query |
| Form / Validation | React Hook Form, Zod |
| Database | MySQL 8, mysql2 |
| Auth | HttpOnly Cookie, HMAC 세션 토큰, bcryptjs |
| Visualization | Chart.js, Recharts |
| Interaction | dnd-kit, Web Worker |
| Deployment | Vercel, Railway MySQL |

## 핵심 기능

### 인증과 권한

- 이메일 기반 로그인 및 회원가입
- 회원가입 계정의 승인·반려 처리
- HttpOnly 쿠키 기반 1일 세션
- 게스트 전용 읽기 모드
- 관리자 계정 승인, 역할 변경, 삭제

| 역할 | 주요 권한 |
| --- | --- |
| `HEAD` | 전체 운영 권한, 계정 승인 및 역할 관리 |
| `ADMIN` | 운영 관리 및 계정 승인 관리 |
| `OPERATOR` | 일반 운영 업무 조회·수정 |
| `VIEWER` | 포트폴리오 게스트용 읽기 전용 |

### 운영관리

- KPI 및 상태 분포 대시보드
- 캠페인 목록, 상세, 상태 변경
- 캠페인 실행 모니터링 및 중지
- 결재함과 승인 단계 관리
- 읽지 않은 알림 및 결재 대기 건수 표시
- 사업용 회선 관리

### 인사·영업관리

- 연차 정책, 잔여 연차, 연차 신청 관리
- 영업 계약 칸반과 Drag & Drop
- 계약 상세 및 품목별 금액 관리
- 영업 활동 및 계약 현황 통계

### 게시판

- 공지사항 CRUD 및 상단 배너
- 동적노드 가이드 CRUD 및 Web Worker 실행
- 저작가이드 CRUD

## 화면 라우트

| 영역 | 경로 | 설명 |
| --- | --- | --- |
| 인증 | `/login` | 로그인 |
| 인증 | `/signup` | 승인형 회원가입 |
| 인증 | `/guest` | 읽기 전용 게스트 진입 |
| 대시보드 | `/dashboard` | KPI, 추이, 상태 분포 |
| 계정관리 | `/admin/users` | 계정 승인 및 역할 관리 |
| 결재 | `/approvals` | 결재 요청 및 승인 현황 |
| 알림 | `/notifications` | 사용자 알림 목록 |
| 캠페인 | `/campaigns` | 캠페인 목록 및 관리 |
| 캠페인 | `/campaigns/[id]` | 캠페인 상세 |
| 모니터링 | `/campaigns/monitoring` | 캠페인 실행 모니터링 |
| 회선관리 | `/business-lines` | 사업용 회선 관리 |
| 인사관리 | `/hr/leave` | 연차 신청 관리 |
| 영업관리 | `/sales/contracts` | 계약 칸반 및 상세 관리 |
| 영업관리 | `/sales/activity-stats` | 계약 현황 통계 |
| 게시판 | `/board/notice` | 공지사항 |
| 게시판 | `/board/dynnode` | 동적노드 가이드 |
| 게시판 | `/board/author-guide` | 저작가이드 |

## 시작하기

### 요구사항

- Node.js 20 이상
- npm
- MySQL 8 또는 Railway MySQL

### 설치

```bash
git clone https://github.com/6bell8/AICC-Management-Console.git
cd AICC-Management-Console
npm ci
```

### 환경변수

프로젝트 루트에 `.env.local`을 생성합니다. 기본 형식은 `.env.example`을 참고합니다.

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=aicc_console

AUTH_SESSION_SECRET=replace_with_a_long_random_secret
AUTH_HEAD_EMAIL=head@example.com
AUTH_HEAD_PASSWORD=replace_with_head_password
AUTH_HEAD_NAME=Head Admin
AUTH_GUEST_EMAIL=portfolio-guest@aicc.local
AUTH_GUEST_NAME=Portfolio Guest
```

`AUTH_HEAD_EMAIL`과 `AUTH_HEAD_PASSWORD`를 설정하면 DB 초기화 시 최초 `HEAD` 관리자가 생성됩니다.

### DB 초기화와 실행

```bash
npm run db:setup
npm run db:check
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)에 접속합니다.

> `db:setup`은 스키마 생성과 전체 시드 작업을 실행합니다. 기존 데이터가 있는 운영 DB에서는 실행 전 반드시 백업과 스크립트 내용을 확인하세요.

## npm 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run db:check` | MySQL 연결 확인 |
| `npm run db:schema` | 테이블 스키마 생성 |
| `npm run db:setup` | 스키마 생성 후 전체 시드 실행 |
| `npm run db:seed:auth` | 관리자 및 게스트 계정 시드 |
| `npm run db:seed:campaigns` | 캠페인 데이터 시드 |
| `npm run db:seed:contracts` | 계약 데이터 시드 |
| `npm run db:seed:business-lines` | 사업용 회선 데이터 시드 |
| `npm run db:seed:board` | 게시판 데이터 시드 |
| `npm run db:seed:monitoring` | 모니터링 데이터 시드 |

## API 구성

Next.js Route Handlers를 사용하며, 인증이 필요한 API는 세션 쿠키를 확인합니다.

| 영역 | 엔드포인트 |
| --- | --- |
| 인증 | `/api/auth/login`, `/api/auth/signup`, `/api/auth/guest`, `/api/auth/logout`, `/api/auth/me` |
| 계정관리 | `/api/admin/users`, `/api/admin/teams`, `/api/admin/hr-profiles` |
| 결재·알림 | `/api/approvals`, `/api/notifications` |
| 캠페인 | `/api/campaigns`, `/api/campaigns/[id]` |
| 모니터링 | `/api/monitoring/summary`, `/api/monitoring/run`, `/api/monitoring/run/[runId]`, `/api/monitoring/campaigns/[id]/stop` |
| 회선관리 | `/api/business-lines` |
| 인사관리 | `/api/hr/leave` |
| 영업관리 | `/api/contracts/deals` |
| 게시판 | `/api/notice`, `/api/notice/[id]`, `/api/notice/banner`, `/api/dynnode`, `/api/dynnode/[id]`, `/api/author-guide`, `/api/author-guide/[id]` |
| 상태확인 | `/api/health/db` |

## 데이터베이스

주요 테이블은 다음과 같습니다.

- 캠페인·모니터링: `campaigns`, `monitoring_runs`, `monitoring_run_events`
- 인증·조직: `users`, `teams`, `user_team_memberships`, `employee_profiles`
- 인사·결재·알림: `leave_policies`, `leave_balances`, `leave_requests`, `leave_balance_events`, `approval_steps`, `notifications`
- 영업·회선: `contract_deals`, `contract_line_items`, `business_lines`
- 게시판: `notices`, `author_guides`, `dynnode_posts`

전체 스키마는 [`docs/db/mysql-schema.sql`](docs/db/mysql-schema.sql), 배포 방법은 [`docs/db/deployment.md`](docs/db/deployment.md)를 참고하세요.

`data/*.json` 파일은 DB 초기 시드 원본으로 사용하며, 런타임 데이터는 MySQL에 저장합니다.

## 프로젝트 구조

```text
.
├─ app
│  ├─ (auth)                 # 로그인, 회원가입, 게스트
│  ├─ (main)                 # 인증된 운영 화면
│  │  ├─ admin
│  │  ├─ approvals
│  │  ├─ board
│  │  ├─ business-lines
│  │  ├─ campaigns
│  │  ├─ dashboard
│  │  ├─ hr
│  │  ├─ notifications
│  │  └─ sales
│  ├─ api                    # Route Handlers
│  ├─ components             # 공용 UI 및 도메인 컴포넌트
│  └─ lib
│     ├─ api                 # 클라이언트 API 함수
│     ├─ auth                # 세션 및 권한
│     ├─ db                  # MySQL 데이터 접근
│     └─ types               # 도메인 타입
├─ data                      # 초기 시드 JSON
├─ docs/db                   # DB 스키마와 배포 문서
├─ scripts/db                # 스키마 및 시드 자동화
└─ proxy.ts                  # 인증 경로 보호
```

## Railway MySQL / Vercel 배포

Vercel 환경변수에 `DB_*`와 `AUTH_*` 값을 등록합니다. Railway MySQL을 Vercel 또는 로컬에서 사용할 때는 Railway의 **Public TCP Proxy host/port**를 사용해야 합니다.

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
AUTH_SESSION_SECRET
AUTH_HEAD_EMAIL
AUTH_HEAD_PASSWORD
AUTH_HEAD_NAME
AUTH_GUEST_EMAIL
AUTH_GUEST_NAME
```

배포 후 DB 연결 상태를 확인합니다.

```text
GET https://your-domain/api/health/db
```

정상 응답:

```json
{ "ok": true }
```

## 보안 및 운영 주의사항

- `.env`, `.env.local`, `backup.sql`, `.mysql-data/`는 커밋하지 않습니다.
- 운영 환경에서는 충분히 긴 `AUTH_SESSION_SECRET`을 사용합니다.
- `VIEWER` 역할은 쓰기 API가 차단되는 읽기 전용 역할입니다.
- 운영 DB에 `db:setup` 또는 시드 명령을 실행하기 전 반드시 백업합니다.
- Railway의 `mysql.railway.internal` 주소는 Railway 내부 서비스에서만 사용합니다.

## 현재 검증 상태

- `npm ci`: 통과
- `npm run build`: 통과
- MySQL 연결: `npm run db:check` 및 `/api/health/db` 제공
- ESLint: 기존 코드와 통합 기능의 규칙 위반 정리 진행 중
