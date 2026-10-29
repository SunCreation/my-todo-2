// 길 B: Supabase(PostgreSQL) 저장소. sqliteTodoRepository와 같은 함수와 같은 응답 형태를 제공한다.
// client는 로그인한 사용자의 토큰을 담고 있어서 모든 요청에 RLS가 적용된다.
// 그에 더해 백엔드에서도 user_id 조건을 직접 걸어, RLS 설정이 잘못되더라도 남의 할 일을 다루지 않게 한다.

const COLUMNS = 'id, title, category_id, due_date, is_completed, created_at, updated_at';

function unwrap({ data, error }) {
  if (error) throw Object.assign(new Error(`Supabase 오류: ${error.message}`), { cause: error });
  return data;
}

function createSupabaseTodoRepository(client, userId) {
  const myTodos = () => client.from('todos').select(COLUMNS).eq('user_id', userId);

  return {
    async listCategories() {
      return unwrap(await client.from('categories').select('id, name, sort_order').order('sort_order'));
    },

    // view: all | today | done | category  (정렬 기준은 SQLite와 동일)
    async listTodos({ view, category, today }) {
      let query = myTodos();
      if (view === 'today') {
        // 오늘 마감 + 기한 지남. due_date가 null이면 비교에서 자동으로 제외된다.
        query = query.eq('is_completed', false).lte('due_date', today)
          .order('due_date').order('id');
      } else if (view === 'done') {
        query = query.eq('is_completed', true)
          .order('updated_at', { ascending: false }).order('id', { ascending: false });
      } else {
        if (view === 'category') query = query.eq('category_id', category);
        query = query.order('is_completed')
          .order('due_date', { nullsFirst: false }).order('id');
      }
      return unwrap(await query);
    },

    async createTodo({ title, category_id, due_date }) {
      return unwrap(await client.from('todos')
        .insert({ user_id: userId, title, category_id, due_date })
        .select(COLUMNS)
        .single());
    },

    // 해당 id가 없거나 내 할 일이 아니면 null
    async setCompleted(id, isCompleted) {
      const rows = unwrap(await client.from('todos')
        .update({ is_completed: isCompleted })
        .eq('id', id).eq('user_id', userId)
        .select(COLUMNS));
      return rows[0] ?? null;
    },

    // 삭제했으면 true, 해당 id가 없거나 내 할 일이 아니면 false
    async deleteTodo(id) {
      const rows = unwrap(await client.from('todos')
        .delete()
        .eq('id', id).eq('user_id', userId)
        .select('id'));
      return rows.length > 0;
    },
  };
}

module.exports = { createSupabaseTodoRepository };
