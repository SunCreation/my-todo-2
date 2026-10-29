// 길 B 보안 확인: 계정 A, B로 "다른 사람의 할 일에 접근할 수 없는지"를 검사한다.
//
// 실행: Supabase 모드로 서버를 켠 상태에서  npm run verify:rls
// 테스트 계정은 .env의 TEST_A_EMAIL / TEST_A_PASSWORD / TEST_B_EMAIL / TEST_B_PASSWORD 를 쓰고,
// 없으면 회원가입한다. (Supabase의 Confirm email이 꺼져 있어야 바로 가입된다)
//
// 두 가지 경로로 확인한다.
//   1) 백엔드 API를 거치는 요청 (앱이 실제로 쓰는 경로)
//   2) Supabase에 직접 보내는 요청 (백엔드의 검사를 건너뛰어도 DB의 RLS가 막는지)

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? '✅ 통과' : '❌ 실패'}  ${label}${detail ? `  (${detail})` : ''}`);
}

async function backend(method, path, token, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// Supabase REST(PostgREST)에 직접 요청. token이 없으면 로그인하지 않은 사용자(anon)로 요청한다.
async function direct(method, path, token, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function loginOrSignup(label, email, password) {
  let res = await backend('POST', '/api/auth/login', null, { email, password });
  if (res.status !== 200) {
    res = await backend('POST', '/api/auth/signup', null, { email, password });
    if (res.status !== 201) {
      throw new Error(`${label} 계정 로그인/가입 실패: ${res.status} ${JSON.stringify(res.body)}`);
    }
    console.log(`계정 ${label} 새로 가입: ${email}`);
  } else {
    console.log(`계정 ${label} 로그인: ${email}`);
  }
  return res.body;
}

async function main() {
  const { TEST_A_EMAIL, TEST_A_PASSWORD, TEST_B_EMAIL, TEST_B_PASSWORD } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_A_EMAIL || !TEST_B_EMAIL) {
    throw new Error('.env에 SUPABASE_URL, SUPABASE_ANON_KEY, TEST_A_*, TEST_B_* 값이 필요합니다.');
  }
  const config = await backend('GET', '/api/config');
  if (!config.body?.authRequired) {
    throw new Error(`${BASE_URL} 서버가 Supabase 모드가 아닙니다. .env의 DB_PROVIDER=supabase 로 서버를 다시 켜 주세요.`);
  }

  console.log(`\n[준비] 서버 ${BASE_URL}\n`);
  const a = await loginOrSignup('A', TEST_A_EMAIL, TEST_A_PASSWORD);
  const b = await loginOrSignup('B', TEST_B_EMAIL, TEST_B_PASSWORD);

  const title = `[RLS 테스트] A의 할 일 ${new Date().toISOString().slice(0, 19)}`;
  const created = await backend('POST', '/api/todos', a.access_token, { title, category_id: 'work' });
  check('A가 할 일을 추가한다', created.status === 201, `id=${created.body?.id}`);
  const id = created.body.id;

  console.log('\n[1] 로그인하지 않은 요청');
  check('백엔드: 토큰 없이 목록 조회 → 401', (await backend('GET', '/api/todos')).status === 401);
  check('백엔드: 가짜 토큰으로 목록 조회 → 401', (await backend('GET', '/api/todos', 'fake-token')).status === 401);
  const anon = await direct('GET', 'todos?select=id,title');
  check('Supabase 직접: 로그인 없이 todos 조회 → 거부', anon.status === 401 || anon.status === 403 || (Array.isArray(anon.body) && anon.body.length === 0), `status=${anon.status}`);

  console.log('\n[2] B가 백엔드를 통해 A의 할 일에 접근');
  const bList = await backend('GET', '/api/todos', b.access_token);
  check('B의 목록에 A의 할 일이 보이지 않는다', bList.status === 200 && !bList.body.some((t) => t.id === id), `B의 할 일 ${bList.body.length}개`);
  check('B가 A의 할 일을 완료 처리 → 404', (await backend('PATCH', `/api/todos/${id}`, b.access_token, { is_completed: true })).status === 404);
  check('B가 A의 할 일을 삭제 → 404', (await backend('DELETE', `/api/todos/${id}`, b.access_token)).status === 404);

  console.log('\n[3] B가 Supabase에 직접 요청 (백엔드 검사를 건너뛰고 RLS만으로 막히는지)');
  const dSelect = await direct('GET', `todos?id=eq.${id}&select=id,title`, b.access_token);
  check('B 토큰으로 A의 할 일 조회 → 0건', dSelect.status === 200 && dSelect.body.length === 0, `${dSelect.body.length}건`);
  const dUpdate = await direct('PATCH', `todos?id=eq.${id}`, b.access_token, { is_completed: true, title: 'B가 바꿈' });
  check('B 토큰으로 A의 할 일 수정 → 0건 변경', dUpdate.status === 200 && dUpdate.body.length === 0, `${dUpdate.body.length}건`);
  const dDelete = await direct('DELETE', `todos?id=eq.${id}`, b.access_token);
  check('B 토큰으로 A의 할 일 삭제 → 0건 삭제', dDelete.status === 200 && dDelete.body.length === 0, `${dDelete.body.length}건`);
  const dInsert = await direct('POST', 'todos', b.access_token, { title: 'A 명의로 끼워넣기', category_id: 'work', user_id: a.user.id });
  check('B 토큰으로 A의 user_id를 넣어 추가 → 거부', dInsert.status === 403 || dInsert.status === 401, `status=${dInsert.status}`);
  const dCategory = await direct('POST', 'categories', b.access_token, { id: 'hack', name: '해킹', sort_order: 9 });
  check('로그인 사용자가 카테고리 추가 → 거부', dCategory.status === 403 || dCategory.status === 401, `status=${dCategory.status}`);

  console.log('\n[4] A의 할 일은 그대로인가');
  const aList = await backend('GET', '/api/todos', a.access_token);
  const mine = aList.body.find((t) => t.id === id);
  check('A의 할 일이 그대로 남아 있다 (제목·미완료 유지)', mine && mine.title === title && mine.is_completed === false);

  console.log(`\n결과: ${failures === 0 ? '모두 통과' : `${failures}개 실패`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(`\n오류: ${err.message}`);
  process.exitCode = 1;
});
