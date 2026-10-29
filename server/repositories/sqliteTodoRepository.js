// 길 A: SQLite 저장소.
// 길 B에서는 같은 함수 이름을 가진 Supabase 저장소로 이 파일만 교체한다.

// 미완료 먼저 → 마감일 빠른 순 → 마감일 없음 → 등록 순
const DEFAULT_ORDER = 'is_completed ASC, due_date IS NULL, due_date ASC, id ASC';
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// SQLite의 0/1을 API 응답에서는 true/false로 바꾼다. (PostgreSQL boolean과 같은 형태)
function toTodo(row) {
  return row && { ...row, is_completed: row.is_completed === 1 };
}

function createSqliteTodoRepository(db) {
  const stmts = {
    listCategories: db.prepare('SELECT id, name, sort_order FROM categories ORDER BY sort_order'),
    listAll: db.prepare(`SELECT * FROM todos ORDER BY ${DEFAULT_ORDER}`),
    listByCategory: db.prepare(`SELECT * FROM todos WHERE category_id = ? ORDER BY ${DEFAULT_ORDER}`),
    // 오늘 마감 + 기한 지남. due_date가 NULL이면 비교 결과가 NULL이라 자동으로 제외된다.
    listDueByToday: db.prepare(
      'SELECT * FROM todos WHERE is_completed = 0 AND due_date <= ? ORDER BY due_date ASC, id ASC'
    ),
    listDone: db.prepare('SELECT * FROM todos WHERE is_completed = 1 ORDER BY updated_at DESC, id DESC'),
    insert: db.prepare(
      'INSERT INTO todos (title, category_id, due_date) VALUES (?, ?, ?) RETURNING *'
    ),
    setCompleted: db.prepare(
      `UPDATE todos SET is_completed = ?, updated_at = ${NOW} WHERE id = ? RETURNING *`
    ),
    delete: db.prepare('DELETE FROM todos WHERE id = ?'),
  };

  return {
    listCategories() {
      return stmts.listCategories.all();
    },

    // view: all | today | done | category
    listTodos({ view, category, today }) {
      let rows;
      if (view === 'today') rows = stmts.listDueByToday.all(today);
      else if (view === 'done') rows = stmts.listDone.all();
      else if (view === 'category') rows = stmts.listByCategory.all(category);
      else rows = stmts.listAll.all();
      return rows.map(toTodo);
    },

    createTodo({ title, category_id, due_date }) {
      return toTodo(stmts.insert.get(title, category_id, due_date));
    },

    // 해당 id가 없으면 null
    setCompleted(id, isCompleted) {
      return toTodo(stmts.setCompleted.get(isCompleted ? 1 : 0, id)) ?? null;
    },

    // 삭제했으면 true, 해당 id가 없으면 false
    deleteTodo(id) {
      return stmts.delete.run(id).changes > 0;
    },
  };
}

module.exports = { createSqliteTodoRepository };
