# Review

- **검토자:** 조해창
- **작성자:** 최예월
- **검토일:** 2026-10-30
- **검토 범위:** 코드, 문서(PRD/README/배포 가이드), 스키마(SQLite/Supabase), git 이력 정적 검토
- **검토 환경 제약:** 샌드박스 정책으로 `npm ci`/`npm test`/`npm audit` 실행이 차단되어, 실행 기반 검증(테스트 통과 여부, 의존성 취약점)은 하지 못했다. 아래 평가는 코드 정독을 근거로 한다.

## 총평

PRD에서 요구한 기능(CRUD, 카테고리, 마감일, 길 A/길 B 전환, 인증, RLS)을 대부분 충족한다. 저장소(repository) 계층 분리, 이중 권한 검증(백엔드 + RLS), 입력 검증 설계가 특히 눈에 띈다. 다만 일부 항목은 코드로 확인했을 뿐 실행 검증은 하지 못했다.

## 잘된 점

- **요구사항 충족:** CRUD, 3개 고정 카테고리, 마감일 강조(오늘/기한 지남), 메뉴 5종, API 명세가 PRD와 일치한다. 목록 정렬 규칙(`is_completed, due_date IS NULL, due_date, id`)도 동일하다.
- **저장소 분리:** `server/repositories/sqliteTodoRepository.js`와 `supabaseTodoRepository.js`가 같은 함수 시그니처를 제공하고, `server/app.js`는 `repositoryFor` 주입으로 DB 종류를 모른다.
- **이중 권한 검증:** 백엔드가 토큰을 검증하고 `user_id` 조건을 직접 걸며, DB의 RLS 4개 정책(`todos`)과 `categories` 읽기 전용 정책이 한 번 더 막는다. `anon` 권한을 revoke하고 `service_role` 키는 사용하지 않는다.
- **입력 검증:** 허용 목록 기반 검증, `2026-02-30` 같은 존재하지 않는 날짜 거부, SQLite `CHECK` 제약으로 앱·DB 양쪽에서 방어한다. SQL은 prepared statement/쿼리 빌더만 사용한다.
- **프론트엔드 보안:** 화면 출력에 `textContent`만 사용, `helmet` CSP 적용, 토큰 만료 시 refresh 후 재시도.
- **로그인 보안:** 로그인/회원가입 15분당 10회 제한(`express-rate-limit`), `TRUST_PROXY` 기본값을 끄고 그 이유를 주석에 명시.
- **테스트 설계:** `node:test`만으로 외부 Supabase 없이 가짜 auth로 "A가 B의 할 일을 볼 수 없다"를 검증하고, 재시작 후 데이터 유지도 임시 DB로 확인. 11번째 로그인 시도가 429인지도 테스트한다.
- **비밀값 관리:** 전체 git 이력(8커밋)에 `.env`, `todo.db`가 커밋된 적이 없고, 키·토큰·패스워드 값 패턴도 발견되지 않았다.
- **문서화:** PRD, README, 배포 가이드(`docs/deploy-render.md`)가 있고 스크린샷으로 로컬/Supabase 검증 기록을 남겼다.

## 보완이 필요한 점

1. **README의 통과 기록은 제3자가 재현하기 어렵다.** 스크린샷과 `verify:rls` 출력은 작성자 본인 환경 기준이며, 검토자가 별도 Supabase 환경 없이 재현 검증할 방법이 README에 없다.
2. **`supabaseTodoRepository`에는 단위 테스트가 없다.** 실 DB가 필요한 `verify:rls` 스크립트로만 검증되어, CI 등 자동화 환경에서는 이 경로가 검증되지 않는다.
3. **프론트엔드 테스트가 없다.** 마감일 강조, 로그인 탭 전환 등 UI 로직은 수동 확인에 의존한다.
4. **세션 토큰을 `localStorage`에 저장한다.** 일반적인 방식이지만 XSS 발생 시 토큰이 노출된다. CSP와 `textContent` 사용이 위험을 줄이긴 한다.
5. **Render 배포는 설정만 되어 있고 실제 배포 여부가 확인되지 않는다.** `render.yaml`과 가이드 문서는 있으나, GitHub 저장소의 Website 필드가 비어 있고 README에도 배포 성공 기록이 없다. 배포 가이드의 `my-todo-xxxx.onrender.com`도 placeholder다.
6. **`server/index.js`의 SIGINT 처리가 진행 중인 요청을 기다리지 않는다.** `server.close()` 직후 `process.exit(0)`을 호출한다. 로컬 SQLite 모드에서는 영향이 작지만(동기 쓰기, 자동 커밋), Render처럼 SIGTERM을 보내는 환경에서는 이 핸들러가 SIGTERM을 처리하지 않아 재배포 시 진행 중 요청이 끊길 수 있다.
7. **이 저장소는 원본(`nihao72-netizen/my-todo`)의 포크이며, `origin/main`과 `upstream/main` 사이에 차이가 없다.** 즉 포크 쪽에서 추가로 반영된 변경이 없는 상태다. 실제 작업 이력(8개 커밋)은 원본 저장소 쪽에 있다.

## 검증하지 못한 항목

- `npm test`, `npm audit` 실행 결과 (환경 제약으로 미실행)
- 실제 Supabase 연동 동작, RLS 정책의 실제 작동 여부 (코드/SQL은 정독했으나 실행 검증 없음)
- Render 실배포 여부

## 결론

PRD 요구사항 충족도, 설계 구조, 보안 고려는 우수하다. 테스트 커버리지(특히 Supabase 경로와 프론트엔드)와 배포 완료 여부는 추가 확인이 필요하다.
