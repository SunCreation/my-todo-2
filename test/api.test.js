const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../server/db/sqlite');
const { createSqliteTodoRepository } = require('../server/repositories/sqliteTodoRepository');
const { createApp } = require('../server/app');

const TODAY = '2026-10-29';

// 임시 DB로 서버를 띄우고, 테스트가 끝나면 닫는다.
async function startServer(dbPath = ':memory:') {
  const db = openDatabase(dbPath);
  const repository = createSqliteTodoRepository(db);
  const app = createApp({ repositoryFor: () => repository });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;

  async function api(method, url, body) {
    const res = await fetch(base + url, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }

  return { api, stop };
}

describe('My Todo API', () => {
  let api;
  let stop;

  before(async () => {
    ({ api, stop } = await startServer());
  });
  after(() => stop());

  const create = async (title, category_id, due_date) =>
    (await api('POST', '/api/todos', { title, category_id, due_date })).body;

  test('카테고리 3개를 순서대로 반환한다', async () => {
    const { status, body } = await api('GET', '/api/categories');
    assert.equal(status, 200);
    assert.deepEqual(body.map((c) => [c.id, c.name]), [
      ['study', '공부'],
      ['work', '업무'],
      ['personal', '개인'],
    ]);
  });

  test('할 일을 추가하면 201과 저장된 할 일을 반환한다', async () => {
    const res = await api('POST', '/api/todos', {
      title: '  영어 단어 외우기  ',
      category_id: 'study',
      due_date: TODAY,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, '영어 단어 외우기'); // 앞뒤 공백 제거
    assert.equal(res.body.category_id, 'study');
    assert.equal(res.body.due_date, TODAY);
    assert.equal(res.body.is_completed, false);
    assert.ok(res.body.id > 0);
  });

  test('잘못된 입력은 400으로 거부한다', async () => {
    const cases = [
      { title: '', category_id: 'study' },
      { title: '   ', category_id: 'study' },
      { title: 'x'.repeat(201), category_id: 'study' },
      { title: '할 일', category_id: 'game' },
      { title: '할 일' },
      { title: '할 일', category_id: 'work', due_date: '2026-02-30' },
      { title: '할 일', category_id: 'work', due_date: '2026/10/29' },
    ];
    for (const body of cases) {
      const res = await api('POST', '/api/todos', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.ok(res.body.error);
    }
    const badJson = await api('POST', '/api/todos', '{not json');
    assert.equal(badJson.status, 400);
  });

  test('마감일 없이 추가할 수 있다', async () => {
    const todo = await create('장보기', 'personal', '');
    assert.equal(todo.due_date, null);
  });

  test('완료 상태를 변경하고, 없는 id는 404를 반환한다', async () => {
    const todo = await create('보고서 제출', 'work', '2026-10-30');

    const done = await api('PATCH', `/api/todos/${todo.id}`, { is_completed: true });
    assert.equal(done.status, 200);
    assert.equal(done.body.is_completed, true);

    const undone = await api('PATCH', `/api/todos/${todo.id}`, { is_completed: false });
    assert.equal(undone.body.is_completed, false);

    assert.equal((await api('PATCH', `/api/todos/${todo.id}`, { is_completed: 'yes' })).status, 400);
    assert.equal((await api('PATCH', '/api/todos/99999', { is_completed: true })).status, 404);
    assert.equal((await api('PATCH', '/api/todos/abc', { is_completed: true })).status, 400);
  });

  test('할 일을 삭제하고, 다시 삭제하면 404를 반환한다', async () => {
    const todo = await create('삭제할 일', 'personal', null);
    assert.equal((await api('DELETE', `/api/todos/${todo.id}`)).status, 204);
    assert.equal((await api('DELETE', `/api/todos/${todo.id}`)).status, 404);
  });
});

describe('메뉴별 조회', () => {
  let api;
  let stop;
  const ids = {};

  before(async () => {
    ({ api, stop } = await startServer());
    const create = async (key, title, category_id, due_date) => {
      ids[key] = (await api('POST', '/api/todos', { title, category_id, due_date })).body.id;
    };
    await create('overdue', '기한 지난 일', 'work', '2026-10-27');
    await create('today', '오늘 마감', 'study', TODAY);
    await create('future', '다음 주 마감', 'study', '2026-11-05');
    await create('noDue', '마감일 없음', 'personal', null);
    await create('doneOverdue', '기한 지났지만 완료', 'work', '2026-10-20');
    await api('PATCH', `/api/todos/${ids.doneOverdue}`, { is_completed: true });
  });
  after(() => stop());

  const list = async (query) => (await api('GET', `/api/todos?${query}`)).body.map((t) => t.id);

  test('전체: 미완료 먼저, 마감일 빠른 순, 마감일 없음은 뒤, 완료는 마지막', async () => {
    assert.deepEqual(await list('view=all'), [
      ids.overdue, ids.today, ids.future, ids.noDue, ids.doneOverdue,
    ]);
  });

  test('오늘 마감: 오늘 마감 + 기한 지난 미완료만, 마감일 빠른 순', async () => {
    assert.deepEqual(await list(`view=today&today=${TODAY}`), [ids.overdue, ids.today]);
  });

  test('오늘 마감: today 기준 날짜가 바뀌면 결과도 바뀐다', async () => {
    assert.deepEqual(await list('view=today&today=2026-10-28'), [ids.overdue]);
  });

  test('완료한 일: 완료된 할 일만', async () => {
    assert.deepEqual(await list('view=done'), [ids.doneOverdue]);
  });

  test('카테고리별: 해당 카테고리만', async () => {
    assert.deepEqual(await list('view=category&category=study'), [ids.today, ids.future]);
    assert.deepEqual(await list('view=category&category=work'), [ids.overdue, ids.doneOverdue]);
  });

  test('잘못된 조회 조건은 400', async () => {
    assert.equal((await api('GET', '/api/todos?view=week')).status, 400);
    assert.equal((await api('GET', '/api/todos?view=category&category=game')).status, 400);
    assert.equal((await api('GET', '/api/todos?view=today&today=2026-13-01')).status, 400);
  });
});

test('앱을 재시작해도 SQLite 파일의 데이터가 유지된다', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-todo-'));
  const dbPath = path.join(dir, 'todo.db');
  try {
    const first = await startServer(dbPath);
    const created = (await first.api('POST', '/api/todos', {
      title: '재시작 후에도 남아야 함',
      category_id: 'work',
      due_date: TODAY,
    })).body;
    await first.api('PATCH', `/api/todos/${created.id}`, { is_completed: true });
    await first.stop();

    const second = await startServer(dbPath);
    const todos = (await second.api('GET', '/api/todos')).body;
    await second.stop();

    assert.equal(todos.length, 1);
    assert.equal(todos[0].title, '재시작 후에도 남아야 함');
    assert.equal(todos[0].is_completed, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 길 B의 백엔드 권한 검증 흐름을 실제 Supabase 없이 확인한다.
// 가짜 auth: "Bearer token-<이름>" 이면 그 사용자로 인정하고, 사용자마다 별도 저장소를 쓴다.
describe('로그인이 필요한 모드 (길 B 흐름)', () => {
  let base;
  let server;
  const dbs = [];

  before(async () => {
    const express = require('express');
    const repos = {};
    const repoOf = (userId) => {
      if (!repos[userId]) {
        const db = openDatabase(':memory:');
        dbs.push(db);
        repos[userId] = createSqliteTodoRepository(db);
      }
      return repos[userId];
    };
    const router = express.Router();
    router.post('/login', (req, res) => res.json({ access_token: `token-${req.body.email}` }));
    const auth = {
      router,
      requireUser(req, res, next) {
        const match = /^Bearer token-(.+)$/.exec(req.get('authorization') ?? '');
        if (!match) return res.status(401).json({ error: '로그인이 필요합니다.' });
        req.user = { id: match[1] };
        next();
      },
    };
    const app = createApp({ auth, repositoryFor: (req) => repoOf(req.user.id) });
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    base = `http://localhost:${server.address().port}`;
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    dbs.forEach((db) => db.close());
  });

  const call = (method, url, token, body) => fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  test('config가 로그인 필요를 알려 준다', async () => {
    assert.deepEqual(await (await call('GET', '/api/config')).json(), { authRequired: true });
  });

  test('토큰 없이 할 일 API를 부르면 401', async () => {
    assert.equal((await call('GET', '/api/todos')).status, 401);
    assert.equal((await call('GET', '/api/categories')).status, 401);
    assert.equal((await call('POST', '/api/todos', null, { title: 'x', category_id: 'work' })).status, 401);
    assert.equal((await call('GET', '/api/todos', 'wrong-token')).status, 401);
  });

  test('로그인 API는 토큰 없이 호출할 수 있다', async () => {
    const res = await call('POST', '/api/auth/login', null, { email: 'a' });
    assert.equal(res.status, 200);
  });

  test('사용자마다 자기 할 일만 보이고, 남의 할 일은 수정·삭제할 수 없다', async () => {
    const created = await (await call('POST', '/api/todos', 'token-a', { title: 'A의 할 일', category_id: 'work' })).json();

    assert.equal((await (await call('GET', '/api/todos', 'token-a')).json()).length, 1);
    assert.equal((await (await call('GET', '/api/todos', 'token-b')).json()).length, 0);
    assert.equal((await call('PATCH', `/api/todos/${created.id}`, 'token-b', { is_completed: true })).status, 404);
    assert.equal((await call('DELETE', `/api/todos/${created.id}`, 'token-b')).status, 404);

    const [stillThere] = await (await call('GET', '/api/todos', 'token-a')).json();
    assert.equal(stillThere.is_completed, false);
  });
});

describe('보안 설정', () => {
  test('보안 헤더가 붙고 서버 종류(X-Powered-By)는 숨긴다', async () => {
    const db = openDatabase(':memory:');
    const repository = createSqliteTodoRepository(db);
    const app = createApp({ repositoryFor: () => repository });
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const res = await fetch(`http://localhost:${server.address().port}/`);
    await new Promise((resolve) => server.close(resolve));
    db.close();

    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const csp = res.headers.get('content-security-policy');
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  });

  test('로그인은 같은 IP에서 15분에 10번까지, 11번째는 429', async () => {
    // 실제 인증 모듈을 쓴다. 잘못된 이메일 형식으로 보내므로 Supabase에 요청이 나가기 전에 400으로 끝난다.
    const { createSupabaseAuth } = require('../server/auth/supabaseAuth');
    const auth = createSupabaseAuth({ url: 'http://127.0.0.1:9', anonKey: 'test-key' });
    const app = createApp({ auth, repositoryFor: () => null });
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const login = () => fetch(`http://localhost:${server.address().port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '123456' }),
    });

    try {
      for (let i = 1; i <= 10; i += 1) {
        assert.equal((await login()).status, 400, `${i}번째 시도`);
      }
      const blocked = await login();
      assert.equal(blocked.status, 429);
      assert.match((await blocked.json()).error, /로그인 시도가 너무 많습니다/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
