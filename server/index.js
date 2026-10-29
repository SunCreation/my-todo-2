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

// Render 같은 프록시 뒤에서 실행할 때 실제 접속자 IP로 로그인 시도 횟수를 세도록 한다.
// 프록시가 없는데 켜면 X-Forwarded-For 헤더를 조작해 제한을 피할 수 있으므로 기본은 끔.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

// 접속을 받을 주소.
//   - sqlite: 로그인이 없으므로 내 컴퓨터(127.0.0.1)에서만 접속 가능하게 한다.
//     (모든 주소로 열면 같은 와이파이의 다른 사람이 내 할 일을 보고 지울 수 있다)
//   - supabase: 로그인으로 보호되고, Render 같은 클라우드에서는 모든 주소로 열어야 하므로 0.0.0.0.
const HOST = process.env.HOST || (DB_PROVIDER === 'sqlite' ? '127.0.0.1' : '0.0.0.0');

const server = app.listen(PORT, HOST, () => {
  console.log(`My Todo 실행 중: http://localhost:${PORT}`);
  console.log(`저장소: ${description}`);
  console.log(`접속 허용 주소: ${HOST}${HOST === '127.0.0.1' ? ' (이 컴퓨터에서만)' : ''}`);
});

// Ctrl+C로 종료할 때 DB 연결을 닫는다.
process.on('SIGINT', () => {
  server.close();
  close();
  process.exit(0);
});
