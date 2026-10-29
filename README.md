# My Todo

카테고리(공부 / 업무 / 개인)와 마감일로 할 일을 관리하는 웹 애플리케이션입니다.
요구사항은 [PRD.md](PRD.md)를 참고하세요.

- **길 A:** 내 컴퓨터의 SQLite 파일(`todo.db`)에 저장, 로그인 없음
- **길 B:** Supabase(PostgreSQL)에 저장, Supabase Auth 로그인 + RLS로 내 할 일만 접근

## 실행 방법

Node.js 22.9 이상이 필요합니다.

```bash
npm install
cp .env.example .env   # 값을 채운다
npm start
```

브라우저에서 <http://localhost:3000> 을 엽니다. 저장소는 `.env`의 `DB_PROVIDER`로 고릅니다.

| `DB_PROVIDER` | 저장 위치 | 필요한 설정 |
| --- | --- | --- |
| `sqlite` | 프로젝트 폴더의 `todo.db` (처음 실행 시 자동 생성) | 없음 |
| `supabase` | Supabase `todos` 테이블 | `SUPABASE_URL`, `SUPABASE_ANON_KEY` + [supabase/schema.sql](supabase/schema.sql)을 SQL Editor에서 1회 실행 |

## 테스트

```bash
npm test             # API 자동 테스트 (임시 DB 사용, todo.db에 영향 없음)
npm run verify:rls   # Supabase 모드로 서버를 켠 상태에서, 계정 A·B로 RLS 확인
```

## 검증 기록

### 길 A - 로컬 SQLite (2026-10-29)

- 할 일 추가·조회·완료·삭제가 화면에서 정상 동작함을 확인했다.
- 서버를 종료했다가 다시 실행한 뒤 새로고침해도 할 일 7개가 완료 상태까지 그대로 남아 있었다.
- 자동 테스트(`npm test`) 통과: CRUD, 입력 검증, 메뉴별 조회, 재시작 후 데이터 유지.

| 서버 끄기 전 | 서버를 껐다 켠 후 |
| --- | --- |
| ![서버 끄기 전](docs/screenshots/local-before-restart.jpg) | ![서버 재시작 후](docs/screenshots/local-after-restart.jpg) |

삭제 확인: "삭제 테스트"를 추가한 뒤 ✕ 버튼으로 삭제했다. (8개 → 7개)

| 삭제 전 | 삭제 후 |
| --- | --- |
| ![로컬 삭제 전](docs/screenshots/local-delete-before.png) | ![로컬 삭제 후](docs/screenshots/local-delete-after.png) |

서버 재시작 후 API로 조회한 결과:

```text
My Todo 실행 중: http://localhost:3000
DB 파일: ...\261026\todo.db
재시작 후 저장된 할 일: 7개
 - [    ] 공부 테스트 2
 - [    ] 업무테스트
 - [    ] 공부 테스트
 - [완료] 안녕
 - [완료] 하세요
 - [완료] ㅇㄹㅇㄴㅁ
 - [완료] 개인테스트
```

### 길 B - Supabase (2026-10-29)

- **클라우드 전환:** `DB_PROVIDER=supabase`로 바꾸자 화면 코드 변경 없이 Supabase `todos` 테이블에 저장되었다.
- **데이터 유지:** 계정 A로 할 일 4개 추가, 1개 완료, 1개 삭제 후 서버를 껐다 켜고 새로고침해도 그대로 남아 있었다.
- **RLS 확인:** 계정 B로 로그인하면 A의 할 일이 보이지 않았고, B가 A의 할 일을 수정·삭제하려는 요청은 백엔드를 거쳐도(404), Supabase에 직접 보내도(0건 변경) 모두 실패했다. A의 할 일은 그대로였다.
- **로그인하지 않은 접근:** 백엔드 API는 401, Supabase 직접 조회도 `permission denied`(401)로 거부되었다.

| 로그인 화면 | 계정 A: 추가·완료·삭제 후 |
| --- | --- |
| ![로그인](docs/screenshots/supabase-1-login.png) | ![A 재시작 전](docs/screenshots/supabase-2-user-a-before-restart.png) |

| 계정 A: 서버를 껐다 켠 후 | 계정 B: A의 할 일이 보이지 않음 |
| --- | --- |
| ![A 재시작 후](docs/screenshots/supabase-3-user-a-after-restart.png) | ![B](docs/screenshots/supabase-4-user-b.png) |

삭제 확인: 계정 A로 "삭제 테스트"를 추가한 뒤 ✕ 버튼으로 삭제했다. (5개 → 4개)

| 삭제 전 | 삭제 후 |
| --- | --- |
| ![Supabase 삭제 전](docs/screenshots/supabase-delete-before.png) | ![Supabase 삭제 후](docs/screenshots/supabase-delete-after.png) |

Supabase 대시보드 Table Editor의 `todos` 표:

- 앱에서 추가한 계정 A의 할 일 4개가 저장되어 있고, 모든 행에 A의 `user_id`가 기록되었다.
- 화면 위쪽에 **RLS policies 4개**(조회·추가·수정·삭제)가 적용되어 있다.
- id 2가 없는 것은 앱에서 "삭제할 할 일"을 삭제했기 때문이다. (삭제가 DB에 반영됨)

![Supabase Table Editor - todos](docs/screenshots/supabase-5-table-editor.jpg)

`npm run verify:rls` 실행 결과:

```text
[1] 로그인하지 않은 요청
✅ 통과  백엔드: 토큰 없이 목록 조회 → 401
✅ 통과  백엔드: 가짜 토큰으로 목록 조회 → 401
✅ 통과  Supabase 직접: 로그인 없이 todos 조회 → 거부  (status=401)

[2] B가 백엔드를 통해 A의 할 일에 접근
✅ 통과  B의 목록에 A의 할 일이 보이지 않는다  (B의 할 일 0개)
✅ 통과  B가 A의 할 일을 완료 처리 → 404
✅ 통과  B가 A의 할 일을 삭제 → 404

[3] B가 Supabase에 직접 요청 (백엔드 검사를 건너뛰고 RLS만으로 막히는지)
✅ 통과  B 토큰으로 A의 할 일 조회 → 0건  (0건)
✅ 통과  B 토큰으로 A의 할 일 수정 → 0건 변경  (0건)
✅ 통과  B 토큰으로 A의 할 일 삭제 → 0건 삭제  (0건)
✅ 통과  B 토큰으로 A의 user_id를 넣어 추가 → 거부  (status=403)
✅ 통과  로그인 사용자가 카테고리 추가 → 거부  (status=403)

[4] A의 할 일은 그대로인가
✅ 통과  A의 할 일이 그대로 남아 있다 (제목·미완료 유지)

결과: 모두 통과
```

## DB에 접근하는 코드는 어디에 있나

DB를 부르는 코드는 모두 `server/` 아래에 있고, 브라우저에서 실행되는 `public/` 코드는 백엔드 API(`/api/...`)만 호출한다.

- 길 A: [server/repositories/sqliteTodoRepository.js](server/repositories/sqliteTodoRepository.js)
- 길 B: [server/repositories/supabaseTodoRepository.js](server/repositories/supabaseTodoRepository.js), [server/auth/supabaseAuth.js](server/auth/supabaseAuth.js)

화면 코드는 누구나 브라우저 개발자 도구로 열어 볼 수 있다. 그래서 DB 주소와 키를 화면 코드에 두면 누구나 DB에 직접 요청할 수 있게 된다. 키는 서버의 `.env`에만 두고, 서버가 로그인 토큰을 확인한 뒤 그 사용자 권한으로만 DB에 접근한다.

## 배포

Render에 백엔드를 올리는 데 필요한 준비물은 [docs/deploy-render.md](docs/deploy-render.md)에 정리했다.

## 폴더 구조

```text
server/
  index.js                 서버 시작 (DB_PROVIDER에 따라 SQLite / Supabase 선택)
  app.js                   Express 앱과 API 라우트
  validation.js            요청 값 검증
  db/schema.sql            SQLite 테이블 생성 스키마 + 카테고리 seed
  db/sqlite.js             SQLite 연결 (FK 활성화, 스키마 적용)
  auth/supabaseAuth.js     로그인·회원가입 API, 토큰 검증 (길 B)
  repositories/
    sqliteTodoRepository.js    SQLite 저장소 (길 A)
    supabaseTodoRepository.js  Supabase 저장소 (길 B)
supabase/
  schema.sql               Supabase 테이블 + RLS 정책
public/
  index.html, style.css, app.js   화면 (로그인 화면 포함)
scripts/
  verify-rls.js            계정 A·B로 RLS 확인
test/
  api.test.js              API 자동 테스트
docs/
  screenshots/             검증 화면
  deploy-render.md         Render 배포 준비물
```
