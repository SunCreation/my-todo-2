const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// SQLite 파일을 열고 스키마와 고정 카테고리를 준비한다.
function openDatabase(filename) {
  const db = new Database(filename);
  // SQLite는 FK 검사가 기본으로 꺼져 있으므로 연결마다 켠다.
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}

module.exports = { openDatabase };
