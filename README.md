# aicc-console

AICC 운영 콘솔을 ERP/백오피스 형태로 구현한 포트폴리오 프로젝트입니다.

캠페인, 계약/영업관리, 인사/근태, 공간예약, 게시판, 카카오톡 연동, 운영 자산 관리 흐름을 Next.js App Router와 MySQL 기반으로 구성합니다.

---

## Tech Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- MySQL
- @tanstack/react-query
- zod + react-hook-form
- lucide-react
- Web Worker
- Vercel 배포
- Railway MySQL 연동

---

## 주요 기능

### 인증/권한

- 승인제 회원가입
- HEAD / ADMIN / OPERATOR / VIEWER 권한
- 계정 승인 관리
- 조직도 / 팀 현황 관리
- 권한 위임 관리
- 비밀번호 초기화

### 대시보드

- 권한별 대시보드 구성
- 운영 소식 토글
- 공지사항 미리보기
- 경조사 현황 미리보기
- 활동 히트맵

### 게시판

- 공지사항
- 저작가이드
- 동적노드 게시판
- 게시판 공통 검색/필터
- 게시글 미리보기 패널
- 공지사항 첨부 문서 URL 슬롯
- 공지사항 변경 이력

### 동적노드 게시판

- 동적노드 목록 페이지네이션
- 제목/요약/코드 검색
- 공개/임시 상태 필터
- 우측 미리보기 패널
- 미리보기 패널 접기/펼치기
- 접힘 상태에서 세로 탭 UI 제공
- 부드러운 패널 전환 애니메이션
- 목록 로딩/미리보기 로딩 스켈레톤
- 동적노드 상세 수정/삭제
- Web Worker 기반 코드 실행기
- `console.log()` 로그 캡처
- 실행 결과/오류 출력
- `Ctrl + F10` 단축키 실행
- `userMap key` 입력을 통한 동적 JSON DATA 주입

예시:

```js
var res = JSON.parse(userMap.get('api:API01'));
var data = res.body;

console.log(data);
```

`userMap key` 값을 `api:TEST01`로 바꾸면 아래처럼 테스트할 수 있습니다.

```js
var res = JSON.parse(userMap.get('api:TEST01'));
```

### 카카오톡 연동

- 카카오 OpenBuilder 스킬 웹훅
- 카카오 user key 기반 AICC 계정 연동
- AICC 웹에서 1회용 코드 확인 후 카카오 계정 연결
- 공간예약 명령 처리
- 예약 가능 공간 확인
- 예약 생성/취소
- 웰컴 블록/버튼형 응답 설계

### 공간예약

- 회의실/교육장 등록
- HEAD 권한 공간 등록/삭제
- 공간 예약 등록
- 중복 예약 방지
- 예약 보드
- 주간 타임라인
- 카카오톡 공간예약 MVP 연동

### 인사/근태

- 마이페이지
- 프로필 상세 정보
- 연차/근태 신청
- 팀 캘린더
- 개인/팀 일정 관리
- 경조사 관리
- 권한 위임 관리
- 재직증명서 출력

### 운영 자산 관리

- 라이선스/운영 문서 목록
- 카테고리/검색 필터
- 규정 문서 관리 구조
- 추후 파일 저장소 연동을 고려한 URL 기반 설계

### 영업관리

- 계약 현황 관리
- 계약 라인 아이템
- 계약 금액 자동 계산
- 칸반 기반 상태 관리
- 영업 활동 통계

---

## 주요 경로

### Auth

- `/login`
- `/signup`
- `/admin/users`

### Dashboard

- `/dashboard`

### Board

- `/board`
- `/board/notice`
- `/board/notice/new`
- `/board/notice/[id]`
- `/board/author-guide`
- `/board/author-guide/new`
- `/board/author-guide/[id]`
- `/board/dynnode`
- `/board/dynnode/new`
- `/board/dynnode/[id]`

### HR

- `/mypage`
- `/mypage/certificate`
- `/hr/family-events`
- `/hr/permission-delegations`

### Reservations

- `/reservations`

### Sales

- `/sales/activity-stats`
- `/sales/contracts`

### Admin

- `/admin/users`
- `/admin/org`
- `/admin/settings`
- `/admin/kakao-links`
- `/admin/audit-logs`

---

## API

### Auth/Admin

- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/signup/route.ts`
- `app/api/admin/users/route.ts`

### Board

- `app/api/notice/route.ts`
- `app/api/notice/[id]/route.ts`
- `app/api/notice/banner/route.ts`
- `app/api/author-guide/route.ts`
- `app/api/author-guide/[id]/route.ts`
- `app/api/dynnode/route.ts`
- `app/api/dynnode/[id]/route.ts`

### Kakao

- `app/api/kakao/webhook/route.ts`

### Reservations

- `app/api/room-reservations/route.ts`

### Profile/HR

- `app/api/profile/details/route.ts`
- `app/api/hr/family-events/route.ts`
- `app/api/hr/permission-delegations/route.ts`

### Health

- `app/api/health/db/route.ts`

---

## 데이터베이스

MySQL 기반으로 운영합니다.

주요 테이블:

- `users`
- `teams`
- `employee_profiles`
- `employee_profile_details`
- `leave_requests`
- `leave_balances`
- `trip_expense_requests`
- `business_lines`
- `meeting_resources`
- `meeting_reservations`
- `notifications`
- `security_audit_logs`
- `notices`
- `campaigns`
- `contract_deals`
- `contract_line_items`
- `kakao_user_links`
- `kakao_message_logs`

DB 스키마 참고:

```txt
docs/db/mysql-schema.sql
```

---

## 환경변수

로컬과 배포 환경에서 MySQL 환경변수를 사용합니다.

```env
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=
```

카카오 테스트용 fallback 계정은 과거 MVP 단계에서 사용했지만, 현재 방향은 카카오 계정 연동 화면과 1회용 인증 코드 기반 연결입니다.

---

## 실행

로컬 개발 서버:

```bash
npm run dev
```

기본 주소:

```txt
http://localhost:3000
```

타입 체크:

```bash
npx.cmd tsc --noEmit
```

Windows 환경에서 Turbopack symlink 권한 문제가 있을 수 있어 빌드는 Webpack 기준으로 확인합니다.

```bash
npx.cmd next build --webpack
```

---

## 배포

Vercel 배포를 기준으로 합니다.

Vercel 환경변수:

```txt
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
```

Railway MySQL을 사용할 경우 Railway의 public host/port 값을 사용합니다.

DB 연결 확인:

```txt
https://your-vercel-domain/api/health/db
```

정상 응답:

```json
{ "ok": true }
```

---

## Git 업로드 시 제외 권장

- `node_modules`
- `.next`
- `.git`
- `.env`
- `.env.local`
- `.env.production`
- `.log`
- `.zip`
- `backup.sql`

---

## 작업 방향

이 프로젝트는 금융권 이직 포트폴리오 성격을 고려해 실제 ERP처럼 보이는 구조와 운영 흐름을 목표로 합니다.

개발 원칙:

- 기존 테마와 primary color 유지
- 옅은 border와 부드러운 hover 중심 UI
- 과한 카드 남발 지양
- 기능은 실제 업무 흐름처럼 구성
- DB 테이블 추가는 신중하게 진행
- MySQL 구조 재사용 우선
- 카카오톡은 입력/알림 채널, 실제 업무 로직은 AICC Console API가 담당
