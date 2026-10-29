const path = require('node:path');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';

// 길 A: 로컬 SQLite 파일에 저장, 로그인 없음
function startSqlite() {
  const { openDatabase } = require('./db/sqlite');
  const { createSqliteTodoRepository } = require('./repositories/sqliteTodoRepository');

  const dbPath = path.resolve(process.env.DB_PATH || 'todo.db');
  const db = openDatabase(dbPath);
  const repository = createSqliteTodoRepository(db);

  return {
    app: createApp({ repositoryFor: () => repository }),
    description: `SQLite (${dbPath})`,
    close: () => db.close(),
  };
}

// 길 B: Supabase에 저장, Supabase Auth 로그인 필요
function startSupabase() {
  const { createSupabaseAuth } = require('./auth/supabaseAuth');
  const { createSupabaseTodoRepository } = require('./repositories/supabaseTodoRepository');

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('.env에 SUPABASE_URL과 SUPABASE_ANON_KEY를 설정해 주세요.');
    process.exit(1);
  }

  const auth = createSupabaseAuth({ url, anonKey });
  return {
    app: createApp({
      auth,
      repositoryFor: (req) => createSupabaseTodoRepository(req.supabase, req.user.id),
    }),
    description: `Supabase (${url})`,
    close: () => {},
  };
}

if (!['sqlite', 'supabase'].includes(DB_PROVIDER)) {
  console.error(`DB_PROVIDER는 sqlite 또는 supabase여야 합니다. (현재: ${DB_PROVIDER})`);
  process.exit(1);
}

const { app, description, close } = DB_PROVIDER === 'supabase' ? startSupabase() : startSqlite();

const server = app.listen(PORT, () => {
  console.log(`My Todo 실행 중: http://localhost:${PORT}`);
  console.log(`저장소: ${description}`);
});

// Ctrl+C로 종료할 때 DB 연결을 닫는다.
process.on('SIGINT', () => {
  server.close();
  close();
  process.exit(0);
});
