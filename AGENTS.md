# Repository Working Agreement

## Collaboration

- 사용자 이름은 봉춘이고, 에이전트 이름은 춘봉이다.
- 사용자와 대화할 때 한국어 존댓말을 사용한다.
- 사용자는 금융권 이직을 준비하는 프론트엔드 개발자다.

## Snapshot Integration Workflow

외부 폴더의 최신 스냅샷을 이 저장소에 통합할 때 다음 절차를 기본으로 사용한다.

1. 원격 `master`를 갱신하고 외부 폴더와 파일·기능·의존성 차이를 확인한다.
2. `.env*`, `node_modules`, `.next`, DB 백업, 인증서 등 민감 파일과 산출물을 제외한다.
3. `master` 기준 통합 브랜치를 생성하고 외부 스냅샷을 이식한다.
4. `.snapshot-protected-paths`에 등록된 경로는 복사·삭제·교체 대상에서 제외한다.
5. 외부 스냅샷에 없는 기존 파일은 용도를 확인한 뒤 삭제 여부를 결정한다.
6. 비밀정보 검사, `git diff --check`, `npm ci`, `npm run build`, `npm run lint`를 수행한다.
7. MySQL 스키마·시드·API 변경이 있으면 Vercel과 Railway DB 연동을 확인한다.
8. 통합 전 `master`를 날짜가 포함된 백업 태그로 보존한다.
9. 통합 브랜치를 푸시하고 필요하면 Draft PR을 생성한다.
10. 검증이 끝나면 통합 브랜치를 `master`에 fast-forward 병합하고 푸시한다.
11. Vercel Production 배포 상태와 대표 도메인 응답을 확인한다.
12. 추가 기능, 라우트, API, DB 구조를 README에 최신화한다.

`master` 반영이 최종 목적이라는 점을 기본 전제로 하되, 빌드 실패, 비밀정보 노출,
DB 스키마 충돌이 있으면 먼저 해결한 후 병합한다.

## Preferred Zip Snapshot Operation

봉춘은 작업용 컴퓨터에서 만든 zip 또는 압축 해제된 스냅샷 폴더를 가져와 이 저장소의 `master`에 반영하는 방식으로 운영한다. 앞으로 같은 요청이 오면 이 흐름을 기본값으로 삼는다.

- 스냅샷 폴더를 새 Git 히스토리로 그대로 push하지 않는다. 반드시 기존 `origin/master`를 기준으로 통합 브랜치를 만든다.
- 스냅샷의 최신 코드를 이식하되, `.snapshot-protected-paths`에 등록된 경로는 현재 `master` 버전을 보존한다.
- 삭제가 필요한 파일은 `git diff`에 삭제 이력이 남도록 처리한다. 그래야 머지 후 이전 파일이 남지 않는다.
- 반대로 보존해야 하는 이전 기능은 백업 태그나 현재 `master`에서 경로 단위로 복원한다.
- 통합 전에는 `backup/master-before-<작업명>-YYYYMMDD` 형태의 태그를 남긴다.
- 검증 우선순위는 `git diff --check`, 비밀정보/산출물 제외 확인, `npm run build`, 필요 시 `npm run lint` 순서로 둔다.
- Vercel 배포 기준은 `master`이며, build script와 환경변수 요구사항을 README와 실제 Vercel 설정에 맞춘다.
## Protected Integration Area

동적노드 가이드는 이전 master 버전에서 복원해 보존한다.

- `.snapshot-protected-paths`에 등록된 동적노드 전용 경로는 사용자의 명시적 요청 없이 변경하지 않는다.
- 외부 스냅샷 이식 전 보호 경로를 백업하고, 이식 후 현재 `master` 버전으로 복원한다.
- 통합 브랜치에서 `git diff master -- <protected-path>` 결과가 없어야 한다.
- `scripts/db/seed-board.cjs`, `docs/db/mysql-schema.sql`, `README.md`처럼 여러 도메인이 섞인 파일은 전체 파일을 보호하지 않는다. 대신 동적노드 관련 시드·테이블·문서 블록은 현재 구현을 유지하며 외부 스냅샷의 나머지 변경만 선별 반영한다.
- 동적노드 가이드 자체를 최신화하는 작업이라면 보호를 해제하기 전에 변경 목적과 영향을 확인한다.
