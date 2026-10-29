-- My Todo - Supabase(PostgreSQL) 스키마 (길 B)
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 한다.
-- 여러 번 실행해도 안전하게 작성했다.

-- ---------- 테이블 ----------

-- 카테고리: 공부 / 업무 / 개인 고정값
create table if not exists public.categories (
  id          text    primary key,
  name        text    not null,
  sort_order  integer not null
);

-- 할 일. user_id는 로그인한 사용자(auth.users)를 가리킨다.
create table if not exists public.todos (
  id            bigint      generated always as identity primary key,
  user_id       uuid        not null default auth.uid()
                            references auth.users (id) on delete cascade,
  title         text        not null
                            check (char_length(btrim(title)) between 1 and 200),
  category_id   text        not null
                            references public.categories (id) on delete restrict,
  due_date      date,
  is_completed  boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_todos_user_id     on public.todos (user_id);
create index if not exists idx_todos_category_id on public.todos (category_id);
create index if not exists idx_todos_due_date    on public.todos (due_date);

-- 수정할 때마다 updated_at을 현재 시각으로 바꾼다.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- 고정 카테고리 seed
insert into public.categories (id, name, sort_order) values
  ('study',    '공부', 1),
  ('work',     '업무', 2),
  ('personal', '개인', 3)
on conflict (id) do update set
  name       = excluded.name,
  sort_order = excluded.sort_order;

-- ---------- 접근 권한 ----------

-- 로그인하지 않은 사용자(anon)는 아무것도 할 수 없다.
revoke all on public.categories, public.todos from anon;
grant usage on schema public to authenticated;
grant select on public.categories to authenticated;
grant select, insert, update, delete on public.todos to authenticated;

-- ---------- RLS (행 수준 보안) ----------

alter table public.categories enable row level security;
alter table public.todos      enable row level security;

-- 카테고리: 로그인한 사용자는 읽기만 가능 (추가/수정/삭제 정책 없음 = 불가)
drop policy if exists "categories: 로그인 사용자 읽기" on public.categories;
create policy "categories: 로그인 사용자 읽기"
  on public.categories for select
  to authenticated
  using (true);

-- 할 일: 자기 할 일(user_id = 내 id)만 조회/추가/수정/삭제
drop policy if exists "todos: 내 할 일 조회" on public.todos;
create policy "todos: 내 할 일 조회"
  on public.todos for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "todos: 내 할 일 추가" on public.todos;
create policy "todos: 내 할 일 추가"
  on public.todos for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "todos: 내 할 일 수정" on public.todos;
create policy "todos: 내 할 일 수정"
  on public.todos for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "todos: 내 할 일 삭제" on public.todos;
create policy "todos: 내 할 일 삭제"
  on public.todos for delete
  to authenticated
  using ((select auth.uid()) = user_id);
