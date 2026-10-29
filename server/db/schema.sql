-- My Todo - SQLite 스키마 (길 A)
-- 앱을 실행할 때마다 실행되므로 모든 구문은 여러 번 실행해도 안전하게 작성한다.

-- 카테고리: 공부 / 업무 / 개인 고정값
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL
);

-- 할 일
CREATE TABLE IF NOT EXISTS todos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL
                CHECK (length(trim(title)) BETWEEN 1 AND 200),
  category_id   TEXT    NOT NULL
                REFERENCES categories (id) ON DELETE RESTRICT,
  -- 날짜만 저장 (YYYY-MM-DD). date()로 정규화한 값과 같아야 실제 존재하는 날짜다.
  due_date      TEXT
                CHECK (due_date IS NULL OR date(due_date) IS due_date),
  is_completed  INTEGER NOT NULL DEFAULT 0
                CHECK (is_completed IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_category_id ON todos (category_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date    ON todos (due_date);

-- 고정 카테고리 seed. 이미 있으면 이름과 순서를 기준값으로 맞춘다.
INSERT INTO categories (id, name, sort_order) VALUES
  ('study',    '공부', 1),
  ('work',     '업무', 2),
  ('personal', '개인', 3)
ON CONFLICT (id) DO UPDATE SET
  name       = excluded.name,
  sort_order = excluded.sort_order;
