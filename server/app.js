const path = require('node:path');
const express = require('express');
const {
  parseListQuery,
  parseNewTodo,
  parseCompletedUpdate,
  parseId,
} = require('./validation');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// repositoryFor(req): 요청마다 사용할 저장소를 돌려준다.
//   - 길 A(SQLite): 항상 같은 저장소
//   - 길 B(Supabase): 로그인한 사용자 권한의 저장소
// auth: 길 B에서만 넘긴다. 주어지면 /api/auth/* 를 열고, 나머지 /api 는 로그인을 요구한다.
// 저장소 함수는 길 B에서 비동기이므로 모두 await로 호출한다.
function createApp({ repositoryFor, auth = null }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  // 화면이 로그인 화면을 보여줄지 결정할 때 사용한다.
  app.get('/api/config', (req, res) => {
    res.json({ authRequired: Boolean(auth) });
  });

  if (auth) {
    app.use('/api/auth', auth.router);
    app.use('/api', auth.requireUser);
    app.get('/api/me', (req, res) => res.json(req.user));
  }

  app.use('/api', (req, res, next) => {
    req.repository = repositoryFor(req);
    next();
  });

  const categoryIds = async (req) => (await req.repository.listCategories()).map((c) => c.id);

  app.get('/api/categories', async (req, res) => {
    res.json(await req.repository.listCategories());
  });

  app.get('/api/todos', async (req, res) => {
    const query = parseListQuery(req.query, await categoryIds(req));
    res.json(await req.repository.listTodos(query));
  });

  app.post('/api/todos', async (req, res) => {
    const todo = parseNewTodo(req.body, await categoryIds(req));
    res.status(201).json(await req.repository.createTodo(todo));
  });

  app.patch('/api/todos/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const isCompleted = parseCompletedUpdate(req.body);
    const todo = await req.repository.setCompleted(id, isCompleted);
    if (!todo) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
    res.json(todo);
  });

  app.delete('/api/todos/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const deleted = await req.repository.deleteTodo(id);
    if (!deleted) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
    res.status(204).end();
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: '없는 API 경로입니다.' });
  });

  // 검증 실패(400)와 JSON 파싱 실패(400)는 메시지를 그대로, 그 외는 500으로 응답한다.
  app.use((err, req, res, next) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    const message = status >= 500
      ? '서버 오류가 발생했습니다.'
      : err.type === 'entity.parse.failed' ? '요청 본문이 올바른 JSON이 아닙니다.' : err.message;
    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = { createApp };
