# PRD - My Todo (할 일 관리 웹 애플리케이션)

## 1. 서비스 개요

- **서비스명:** My Todo
- **서비스 목적:** 사용자가 해야 할 일을 간편하게 등록하고, 카테고리와 마감일을 기준으로 체계적으로 관리하는 웹 애플리케이션을 만든다.
- **대상 사용자:** 공부, 업무, 개인 일정을 관리하려는 사용자

### 참고 서비스 및 적용 방향

| 참고 서비스 | 참고할 특징 |
| --- | --- |
| Microsoft To Do | 간결한 화면, 직관적인 할 일 목록, 체크박스를 통한 완료 처리 |
| TickTick | 카테고리별 할 일 분류, 마감일 설정 및 날짜별 확인 |

두 서비스의 특징을 참고하되, 불필요하게 복잡한 기능을 제외하고 사용하기 쉬운 화면으로 구성한다.

## 2. 기본 기능 (CRUD)

| 기능 | 설명 |
| --- | --- |
| 할 일 추가 (Create) | 새로운 할 일을 입력하고 등록한다. |
| 목록 조회 (Read) | 등록한 할 일을 목록으로 확인한다. |
| 완료 표시 (Update) | 체크박스를 이용하여 완료 또는 미완료 상태를 변경한다. |
| 할 일 삭제 (Delete) | 필요 없는 할 일을 삭제한다. |

- 할 일 제목은 필수이며, 앞뒤 공백을 제거한 뒤 1~200자여야 한다.

## 3. 내가 추가하고 싶은 기능

### 3.1 카테고리 분류

- 카테고리는 **공부(study), 업무(work), 개인(personal)** 세 가지 고정값을 사용한다.
- 사용자가 카테고리를 직접 추가하거나 삭제하는 기능은 제공하지 않는다.
- 할 일을 등록할 때 카테고리를 반드시 하나 선택한다.
- 선택한 카테고리에 해당하는 할 일만 조회할 수 있다.

### 3.2 마감일 관리

- 할 일을 등록할 때 마감일을 설정할 수 있다. 마감일은 선택 사항이다.
- 할 일 목록에 마감일을 표시한다.
- 마감일이 오늘인 미완료 할 일은 "오늘"로 강조하여 표시한다.
- 마감일이 지난 미완료 할 일은 **빨간색**으로 구분하여 표시한다.
- "오늘"은 사용자 브라우저의 로컬 날짜를 기준으로 판단한다.

## 4. 화면 구성

Microsoft To Do의 간결한 화면을 참고하여 다음과 같이 구성한다.

### 4.1 왼쪽 메뉴

| 메뉴 | 표시 대상 | 정렬 |
| --- | --- | --- |
| 전체 할 일 | 모든 할 일 | 미완료 먼저 → 마감일 빠른 순 → 마감일 없음 |
| 오늘 마감 | 마감일이 오늘이거나 이미 지난 **미완료** 할 일 | 마감일 빠른 순 (지난 항목은 빨간색) |
| 완료한 일 | 완료된 할 일 | 최근 수정 순 |
| 공부 / 업무 / 개인 | 해당 카테고리의 할 일 | 전체 할 일과 동일 |

### 4.2 오른쪽 메인 화면

- 선택한 메뉴에 해당하는 할 일 목록 표시
- 할 일 제목, 카테고리, 마감일 표시
- 체크박스를 이용한 완료 처리
- 할 일 삭제 버튼

### 4.3 할 일 등록 영역

- 할 일 제목 입력
- 카테고리 선택
- 마감일 선택
- 추가 버튼

### 화면 디자인 원칙

- 흰색 배경을 기본으로 깔끔하고 단순하게 구성한다.
- Microsoft To Do처럼 왼쪽 메뉴와 오른쪽 할 일 목록을 구분한다.
- 완료된 할 일에는 취소선을 표시한다.
- 중요한 기능을 쉽게 찾을 수 있도록 직관적인 UI를 제공한다.
- PC 웹 브라우저에서 사용하기 편리하도록 구현한다.

## 5. 데이터 모델

테이블은 `categories`, `todos` 두 개로 구성한다. 사용자 테이블은 직접 만들지 않으며, 길 B에서는 Supabase Auth가 관리하는 `auth.users`를 참조한다.

### 5.1 ERD

```text
 [길 A: SQLite]

 +-------------------------+             +------------------------------+
 | categories              |             | todos                        |
 +-------------------------+             +------------------------------+
 | PK id          TEXT     |  1       N  | PK id            INTEGER     |
 |    name        TEXT     |-----------<-| FK category_id   TEXT        |
 |    sort_order  INTEGER  |             |    title         TEXT        |
 +-------------------------+             |    due_date      TEXT  (null)|
                                         |    is_completed  INTEGER     |
                                         |    created_at    TEXT        |
                                         |    updated_at    TEXT        |
                                         +------------------------------+

 [길 B: Supabase] 위 구조 + 아래 관계 추가

 +-------------------------+             +------------------------------+
 | auth.users  (Supabase)  |  1       N  | todos                        |
 +-------------------------+-----------<-| FK user_id       UUID        |
 | PK id          UUID     |             |    ... (나머지 동일)         |
 +-------------------------+             +------------------------------+
```

- `categories` 1 : N `todos`
- `auth.users` 1 : N `todos` (길 B만 해당)

### 5.2 `categories` (고정값)

| 컬럼 | 타입 (SQLite) | 제약 | 설명 |
| --- | --- | --- | --- |
| `id` | TEXT | PK | `study`, `work`, `personal` |
| `name` | TEXT | NOT NULL | 공부, 업무, 개인 |
| `sort_order` | INTEGER | NOT NULL | 메뉴 표시 순서 |

- 앱 실행 시 세 개의 고정값을 미리 저장(seed)한다.
- PK를 영문 코드로 두어 SQLite와 Supabase에서 같은 값을 사용한다.

### 5.3 `todos`

| 컬럼 | 타입 (SQLite) | 제약 | 설명 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK, AUTOINCREMENT | 할 일 고유 번호 |
| `title` | TEXT | NOT NULL, 1~200자 | 할 일 제목 |
| `category_id` | TEXT | FK → `categories.id`, NOT NULL, ON DELETE RESTRICT | 카테고리 |
| `due_date` | TEXT | NULL 허용, `YYYY-MM-DD` | 마감일 (날짜만 저장) |
| `is_completed` | INTEGER | NOT NULL, 기본값 0, 0 또는 1 | 완료 여부 |
| `created_at` | TEXT | NOT NULL, 기본값 현재 시각 (UTC, ISO 8601) | 생성 시각 |
| `updated_at` | TEXT | NOT NULL, 기본값 현재 시각 (UTC, ISO 8601) | 마지막 수정 시각 |
| `user_id` | UUID (길 B만) | FK → `auth.users.id`, NOT NULL, ON DELETE CASCADE | 할 일 소유자 |

- 완료 시각(`completed_at`) 컬럼은 두지 않는다.
- "오늘 마감", "기한 지남"은 컬럼으로 저장하지 않고, 조회 시 `due_date`와 오늘 날짜를 비교하여 계산한다.
- SQLite는 연결할 때마다 `PRAGMA foreign_keys = ON`을 설정하여 FK 제약을 활성화한다.

### 5.4 SQLite → PostgreSQL 타입 대응

| 컬럼 | SQLite (길 A) | PostgreSQL (길 B) |
| --- | --- | --- |
| `todos.id` | INTEGER AUTOINCREMENT | `bigint generated always as identity` |
| `due_date` | TEXT | `date` |
| `is_completed` | INTEGER (0/1) | `boolean` |
| `created_at`, `updated_at` | TEXT | `timestamptz default now()` |
| `user_id` | 없음 | `uuid default auth.uid()` |

컬럼 이름과 의미는 두 DB에서 동일하게 유지하여, 백엔드 API의 요청·응답 형식과 프론트엔드 코드가 바뀌지 않도록 한다.

## 6. API 명세

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/categories` | 카테고리 목록 |
| GET | `/api/todos?view=all\|today\|done\|category&category=study&today=YYYY-MM-DD` | 메뉴별 할 일 목록 |
| POST | `/api/todos` | 할 일 추가 (`title`, `category_id`, `due_date`) |
| PATCH | `/api/todos/:id` | 완료 상태 변경 (`is_completed`) |
| DELETE | `/api/todos/:id` | 할 일 삭제 |
| GET | `/api/config` | 로그인 필요 여부 (`authRequired`) |
| POST | `/api/auth/signup` | 회원가입 (길 B) |
| POST | `/api/auth/login` | 로그인, 토큰 발급 (길 B) |
| POST | `/api/auth/refresh` | 만료된 토큰 재발급 (길 B) |

- 응답의 `is_completed`는 `true`/`false`로 반환한다.
- 잘못된 입력은 `400`, 존재하지 않는 할 일은 `404`를 반환한다.
- 길 B에서는 `/api/config`, `/api/auth/*`를 제외한 모든 API에 로그인 토큰이 필요하며, 없으면 `401`을 반환한다.

## 7. 데이터 저장 방식

### 길 A - 로컬 데이터베이스

- 내 컴퓨터에서 실행되는 SQLite를 사용한다.
- 할 일 데이터를 `todo.db`에 저장한다.
- 브라우저를 새로고침하거나 앱을 종료한 뒤 다시 실행해도 데이터가 유지되어야 한다.

### 길 B - 클라우드 데이터베이스

- Supabase의 PostgreSQL로 저장소를 전환한다.
- 기존 Todo 기능과 화면은 그대로 유지한다.
- 길 A의 SQLite 데이터를 Supabase로 이전하는 기능은 구현하지 않는다. 길 B는 빈 DB에서 시작한다.
- Supabase Auth를 이용하여 로그인 기능을 추가한다.
  - 로그인·회원가입도 백엔드 API(`/api/auth/*`)가 Supabase Auth를 호출한다. 프론트엔드는 Supabase를 직접 호출하지 않으며, Supabase 주소와 키를 알지 못한다.
  - 프론트엔드는 백엔드에서 받은 토큰을 `Authorization: Bearer <access token>` 헤더로 보낸다.
- `.env`의 `DB_PROVIDER` 값(`sqlite` / `supabase`)으로 길 A와 길 B를 전환한다.
- 접근 권한은 두 겹으로 검증한다.
  - **DB (RLS):** `todos`는 `user_id = auth.uid()`인 행만 조회·추가·수정·삭제할 수 있다. `categories`는 로그인한 사용자가 읽기만 할 수 있다.
  - **백엔드:** 모든 `/api` 요청에서 `Authorization: Bearer <access token>`을 검증하고, 토큰이 없거나 유효하지 않으면 `401`을 반환한다. 다른 사용자의 할 일을 수정·삭제하려 하면 `404`를 반환한다.
- 백엔드는 사용자의 토큰으로 Supabase에 접근하여 RLS가 적용되도록 한다. RLS를 우회하는 `service_role` 키는 사용자 데이터 처리에 사용하지 않는다.

## 8. 개발 환경 및 규칙

- **프론트엔드:** HTML, CSS, JavaScript
- **백엔드:** Node.js, Express
- **로컬 DB:** SQLite
- **클라우드 DB:** Supabase (PostgreSQL)
- **개발 도구:** VS Code, Claude Code
- **형상 관리:** Git, GitHub

### 개발 규칙

1. 무료로 사용할 수 있는 도구를 사용한다.
2. 프론트엔드는 백엔드 API를 통해서만 DB 데이터를 요청한다.
3. 비밀번호와 DB 접속 정보는 `.env` 파일로 관리한다.
4. `.env`, `todo.db`는 `.gitignore`에 등록하여 GitHub에 업로드하지 않는다.
5. 로그인 기능은 직접 구현하지 않고 검증된 인증 서비스를 사용한다.
6. DB 접근 코드는 저장소(repository) 모듈로 분리하여, 길 B 전환 시 해당 모듈만 교체한다.

## 9. 완료 기준

- 할 일 추가, 조회, 완료 처리, 삭제가 정상 작동한다.
- 카테고리별 할 일 분류 및 조회가 가능하다.
- 마감일을 설정하고 목록에서 확인할 수 있다.
- "오늘 마감" 메뉴에 오늘 마감 및 기한이 지난 미완료 할 일이 표시되고, 기한이 지난 항목은 빨간색으로 표시된다.
- SQLite에 저장한 데이터가 새로고침 및 앱 재시작 후에도 유지된다.
- Supabase로 전환한 후에도 같은 기능이 정상 작동한다.
- 사용자별 데이터 접근 제한이 정상 작동한다.
  - 로그인하지 않은 요청은 `401`로 거부된다.
  - 사용자 A의 계정으로 사용자 B의 할 일을 조회할 수 없고, 수정·삭제 요청은 실패한다.
- 실행 화면과 검증 결과를 기록하여 GitHub에 제출한다.
