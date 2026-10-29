const path = require('node:path');
const express = require('express');
const {
  parseListQuery,
  parseNewTodo,
  parseCompletedUpdate,
  parseId,
} = require('./validation');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// 저장소(repository)를 주입받아 앱을 만든다. 테스트에서는 임시 DB 저장소를 넣는다.
// 저장소 함수는 길 B(Supabase)에서 비동기가 되므로 모두 await로 호출한다.
function createApp({ repository }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  const categoryIds = async () => (await repository.listCategories()).map((c) => c.id);

  app.get('/api/categories', async (req, res) => {
    res.json(await repository.listCategories());
  });

  app.get('/api/todos', async (req, res) => {
    const query = parseListQuery(req.query, await categoryIds());
    res.json(await repository.listTodos(query));
  });

  app.post('/api/todos', async (req, res) => {
    const todo = parseNewTodo(req.body, await categoryIds());
    res.status(201).json(await repository.createTodo(todo));
  });

  app.patch('/api/todos/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const isCompleted = parseCompletedUpdate(req.body);
    const todo = await repository.setCompleted(id, isCompleted);
    if (!todo) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
    res.json(todo);
  });

  app.delete('/api/todos/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const deleted = await repository.deleteTodo(id);
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
