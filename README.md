# AICC Management Console

금융권 AICC 운영 환경을 가정해 제작한 통합 관리 콘솔 포트폴리오입니다.

캠페인과 모니터링 중심의 콘솔을 MySQL 기반 운영 포털로 확장했습니다. 인증·권한, 계정 승인, 결재, 알림, 인사, 출장여비, 영업, 사업용 회선, 게시판 데이터를 하나의 콘솔에서 관리합니다.

## 주요 특징

- **MySQL 기반 데이터 관리**: Railway MySQL 또는 로컬 MySQL 연결
- **승인형 계정 시스템**: 회원가입 후 관리자 승인, 역할별 접근 제어
- **운영 업무 통합**: 캠페인, 모니터링, 결재, 알림, 인사, 출장여비, 영업관리
- **외부 연동 준비**: Notion 승인 캘린더 동기화, Railway S3 호환 버킷 첨부파일 저장
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
| Storage | Railway S3-compatible Bucket, AWS SDK S3 Client |
| Integration | Notion API approval calendar sync |
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

### 인사·출장 관리

- 연차 정책, 잔여 연차, 연차 신청 관리
- 출장 신청 시 목적과 장소 필수 입력
- 사용자 권한별 연차 조회 범위 분리: 전체, 팀, 본인
- 승인 완료 출장 건 기반 출장여비 신청
- 시내·시외 출장 구분, 교통비·일비·숙박비 자동 합산
- 출장여비 증빙 첨부파일 업로드 및 다운로드

### 결재와 외부 연동

- 연차·출장·출장여비 결재 대기 목록 통합
- 결재 승인·반려 후 신청자 알림 생성
- 연차·출장 승인 시 Notion 캘린더 동기화
- Notion 환경변수가 없으면 mock 동기화 결과로 흐름 검증 가능
- 동기화 상태는 `approval_calendar_syncs`에 저장

### 영업관리

- 영업 계약 칸반과 Drag & Drop
- 계약 상세 및 품목별 금액 관리
- 영업 활동 및 계약 현황 통계

### 게시판

- 공지사항 CRUD 및 상단 배너
- 동적노드 가이드 CRUD 및 Web Worker 실행
- 동적노드 실행기 JSON DATA 키 입력, 기본 예시 객체, `Ctrl + F5` 실행 단축키
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
| 인사관리 | `/hr/leave` | 연차·출장 신청 관리 |
| 인사관리 | `/hr/trip-expenses` | 출장여비 신청 및 증빙 관리 |
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

NOTION_API_KEY=
NOTION_APPROVAL_CALENDAR_DATABASE_ID=
NOTION_VERSION=2022-06-28

RAILWAY_BUCKET_ENDPOINT=
RAILWAY_BUCKET_REGION=auto
RAILWAY_BUCKET_NAME=
RAILWAY_BUCKET_ACCESS_KEY=
RAILWAY_BUCKET_SECRET_KEY=
```

`AUTH_HEAD_EMAIL`과 `AUTH_HEAD_PASSWORD`를 설정하면 DB 초기화 시 최초 `HEAD` 관리자가 생성됩니다. Notion과 Railway Bucket 값이 없으면 해당 외부 연동은 제한되거나 mock 흐름으로 동작합니다.

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
| `npm run dev` | Webpack 기반 개발 서버 실행 |
| `npm run build` | Webpack 기반 프로덕션 빌드 |
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
| 인사관리 | `/api/hr/leave`, `/api/hr/trip-expenses`, `/api/hr/trip-expenses/[id]/attachments`, `/api/hr/trip-expenses/attachments/[attachmentId]` |
| 영업관리 | `/api/contracts/deals` |
| 게시판 | `/api/notice`, `/api/notice/[id]`, `/api/notice/banner`, `/api/dynnode`, `/api/dynnode/[id]`, `/api/author-guide`, `/api/author-guide/[id]` |
| 상태확인 | `/api/health/db` |

## 데이터베이스

주요 테이블은 다음과 같습니다.

| 영역 | 테이블 |
| --- | --- |
| 인증·권한 | `users`, `teams`, `user_team_memberships`, `employee_profiles` |
| 인사 | `leave_policies`, `leave_balances`, `leave_requests`, `leave_balance_events` |
| 출장여비 | `trip_expense_requests`, `trip_expense_attachments` |
| 결재·알림 | `approval_steps`, `approval_calendar_syncs`, `notifications` |
| 캠페인 | `campaigns`, `monitoring_runs`, `monitoring_events` |
| 영업 | `contract_deals`, `contract_line_items` |
| 회선관리 | `business_lines` |
| 게시판 | `notices`, `dynnode_posts`, `author_guides` |

스키마 파일은 `docs/db/mysql-schema.sql`에 있습니다. `scripts/db/schema.cjs`는 이 SQL을 실행합니다.

## 배포 메모

- Vercel Production은 `master` 브랜치 push를 기준으로 배포됩니다.
- Next.js 16 Turbopack 빌드가 Windows symlink 권한 문제를 일으킬 수 있어 `npm run build`는 `next build --webpack`으로 고정했습니다.
- Vercel Project Settings > Environment Variables에 DB, Auth, Notion, Railway Bucket 환경변수를 등록합니다.
- Railway MySQL을 사용할 경우 Railway의 public host/port 값을 사용합니다. `mysql.railway.internal`은 Railway 내부 서비스 전용이라 Vercel이나 로컬 PC에서는 사용하지 않습니다.

배포 후 DB 상태 확인:

```txt
https://your-vercel-domain/api/health/db
```

정상 응답:

```json
{ "ok": true }
```

## 운영 주의사항

- `.env.local`은 커밋하지 않습니다.
- `backup.sql`은 민감 데이터가 들어갈 수 있으므로 커밋하지 않습니다.
- 운영 DB에 `npm run db:setup`을 실행하기 전 반드시 백업과 스키마 변경 내용을 확인합니다.
- 외부 스냅샷 통합 시 `.snapshot-protected-paths`에 등록된 동적노드 영역은 명시 요청 없이 덮어쓰지 않습니다.
