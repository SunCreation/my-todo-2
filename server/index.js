const path = require('node:path');
const { openDatabase } = require('./db/sqlite');
const { createSqliteTodoRepository } = require('./repositories/sqliteTodoRepository');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = path.resolve(process.env.DB_PATH || 'todo.db');

const db = openDatabase(DB_PATH);
const app = createApp({ repository: createSqliteTodoRepository(db) });

const server = app.listen(PORT, () => {
  console.log(`My Todo 실행 중: http://localhost:${PORT}`);
  console.log(`DB 파일: ${DB_PATH}`);
});

// Ctrl+C로 종료할 때 DB 연결을 닫는다.
process.on('SIGINT', () => {
  server.close();
  db.close();
  process.exit(0);
});
