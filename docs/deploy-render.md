# Render 배포 준비물

이 Todo 앱의 백엔드(Express 서버, 화면 파일 포함)를 Render에 올려 인터넷에서 접속할 수 있게 할 때 필요한 것들이다.
DB는 이미 Supabase(클라우드)에 있으므로, Render에는 서버 코드만 올린다.

## 준비물 한눈에 보기

| 항목 | 값 |
| --- | --- |
| 코드 보관 위치 | GitHub 저장소 `nihao72-netizen/my-todo` (Render가 여기서 코드를 가져간다) |
| 서비스 종류 | **Web Service** |
| 런타임 | Node (버전은 `package.json`의 `engines`: 22.9 이상) |
| 빌드 명령 | `npm ci` |
| 시작 명령 | `npm start` |
| 요금제 | Free |
| 리전 | Singapore (한국에서 가장 가까움) |
| 헬스 체크 경로 | `/api/config` |

## 환경변수 (Render 대시보드 > Environment 에 입력)

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `DB_PROVIDER` | `supabase` | 필수. Render의 디스크는 재배포 때 지워지므로 SQLite 모드는 쓰지 않는다 |
| `SUPABASE_URL` | 내 `.env`의 값 | 필수 |
| `SUPABASE_ANON_KEY` | 내 `.env`의 값 | 필수 |
| `PORT` | 입력하지 않음 | Render가 자동으로 넣어 주고, 서버는 `process.env.PORT`를 읽는다 |

- `.env` 파일은 GitHub에 올리지 않았으므로, 값은 Render 화면에 직접 입력한다.
- `TEST_A_*`, `TEST_B_*` 테스트 계정 정보는 서버 실행에 필요 없으므로 넣지 않는다.
- RLS를 우회하는 `service_role`(secret) 키는 넣지 않는다.

## 배포 순서 (도전할 경우)

1. GitHub 저장소가 최신 코드로 push되어 있는지 확인한다.
2. <https://render.com> 에 GitHub 계정으로 가입한다.
3. **New + → Web Service**를 누르고 `my-todo` 저장소를 연결한다.
4. 위 표대로 빌드·시작 명령, 요금제, 리전을 입력한다.
5. **Environment Variables**에 위 3개 값을 입력한다.
6. **Create Web Service**를 누르고 로그에 `My Todo 실행 중`이 나올 때까지 기다린다.

## 배포 후 확인 방법

1. 접속 주소(`https://my-todo-xxxx.onrender.com`)를 브라우저로 열면 로그인 화면이 나온다.
2. `https://my-todo-xxxx.onrender.com/api/config`를 열면 `{"authRequired":true}`가 보인다.
3. 테스트 계정으로 로그인해 할 일을 추가하고, Supabase Table Editor의 `todos`에 행이 생기는지 본다.
4. 내 컴퓨터에서 배포된 서버를 대상으로 RLS 확인을 실행한다.

   ```bash
   BASE_URL=https://my-todo-xxxx.onrender.com npm run verify:rls
   ```

## 알아 둘 점

- 무료 요금제는 15분 동안 요청이 없으면 서버가 잠들고, 다음 접속 때 깨어나는 데 30초~1분 정도 걸린다.
- 나중에 Supabase의 **Confirm email**을 다시 켠다면, Supabase **Authentication → URL Configuration**의 Site URL을 Render 주소로 바꿔야 인증 메일의 링크가 올바른 곳으로 간다.
- 코드를 GitHub에 push하면 Render가 자동으로 다시 배포한다.
