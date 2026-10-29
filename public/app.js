// My Todo 프론트엔드. 데이터는 모두 백엔드 API(/api)를 통해서만 주고받는다.

const VIEW_TITLES = { all: '전체 할 일', today: '오늘 마감', done: '완료한 일' };
const EMPTY_TEXTS = {
  all: '할 일이 없습니다. 위에서 새 할 일을 추가해 보세요.',
  today: '오늘까지 마감인 할 일이 없습니다.',
  done: '아직 완료한 일이 없습니다.',
  category: '이 카테고리에 할 일이 없습니다.',
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const state = {
  categories: [],
  view: 'all',
  category: null,
};

const el = {
  mainMenu: document.getElementById('main-menu'),
  categoryMenu: document.getElementById('category-menu'),
  todayCount: document.getElementById('today-count'),
  viewTitle: document.getElementById('view-title'),
  todayText: document.getElementById('today-text'),
  form: document.getElementById('add-form'),
  titleInput: document.getElementById('title-input'),
  categorySelect: document.getElementById('category-select'),
  dueInput: document.getElementById('due-input'),
  error: document.getElementById('error'),
  list: document.getElementById('todo-list'),
  empty: document.getElementById('empty'),
  template: document.getElementById('todo-template'),
};

// ---------- 날짜 ----------

// 브라우저의 로컬 날짜를 YYYY-MM-DD로 만든다. ("오늘"의 기준)
function localToday() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const yearPart = y === new Date().getFullYear() ? '' : `${y}년 `;
  return `${yearPart}${m}월 ${d}일 (${WEEKDAYS[date.getDay()]})`;
}

// ---------- API ----------

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `요청에 실패했습니다. (${res.status})`);
  return data;
}

function showError(message) {
  el.error.textContent = message;
  el.error.hidden = !message;
}

// ---------- 화면 그리기 ----------

function categoryName(id) {
  return state.categories.find((c) => c.id === id)?.name ?? id;
}

function renderCategories() {
  el.categoryMenu.replaceChildren(
    ...state.categories.map((c) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'menu-item';
      button.dataset.view = 'category';
      button.dataset.category = c.id;
      const dot = document.createElement('span');
      dot.className = 'category-dot';
      dot.setAttribute('aria-hidden', 'true');
      button.append(dot, c.name);
      li.append(button);
      return li;
    })
  );

  el.categorySelect.replaceChildren(
    ...state.categories.map((c) => new Option(c.name, c.id))
  );
}

function renderMenuSelection() {
  document.querySelectorAll('.menu-item').forEach((button) => {
    const active = button.dataset.view === state.view
      && (state.view !== 'category' || button.dataset.category === state.category);
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  el.viewTitle.textContent = state.view === 'category'
    ? categoryName(state.category)
    : VIEW_TITLES[state.view];
}

function renderTodo(todo, today) {
  const li = el.template.content.firstElementChild.cloneNode(true);
  const overdue = !todo.is_completed && todo.due_date && todo.due_date < today;
  const dueToday = !todo.is_completed && todo.due_date === today;

  li.dataset.id = todo.id;
  li.dataset.category = todo.category_id;
  li.classList.toggle('is-done', todo.is_completed);
  li.classList.toggle('is-overdue', Boolean(overdue));

  const checkbox = li.querySelector('input[type="checkbox"]');
  checkbox.checked = todo.is_completed;
  checkbox.setAttribute('aria-label', `${todo.title} 완료`);

  li.querySelector('.todo-title').textContent = todo.title;
  li.querySelector('.chip').textContent = categoryName(todo.category_id);

  const due = li.querySelector('.due');
  if (!todo.due_date) {
    due.remove();
  } else if (overdue) {
    due.classList.add('overdue');
    due.textContent = `기한 지남 · ${formatDate(todo.due_date)}`;
  } else if (dueToday) {
    due.classList.add('today');
    due.textContent = '오늘 마감';
  } else {
    due.textContent = `마감 ${formatDate(todo.due_date)}`;
  }

  return li;
}

function renderTodos(todos, today) {
  el.list.replaceChildren(...todos.map((todo) => renderTodo(todo, today)));
  el.empty.hidden = todos.length > 0;
  el.empty.textContent = EMPTY_TEXTS[state.view];
}

function renderTodayCount(todos, today) {
  const overdue = todos.some((t) => t.due_date < today);
  el.todayCount.hidden = todos.length === 0;
  el.todayCount.textContent = todos.length;
  el.todayCount.classList.toggle('overdue', overdue);
  el.todayCount.title = overdue ? '기한 지난 할 일 포함' : '';
}

// 현재 메뉴의 목록과 "오늘 마감" 개수를 다시 불러온다.
async function refresh() {
  const today = localToday();
  el.todayText.textContent = `오늘은 ${formatDate(today)}`;

  const params = new URLSearchParams({ view: state.view, today });
  if (state.view === 'category') params.set('category', state.category);

  try {
    const [todos, dueTodos] = await Promise.all([
      api('GET', `/api/todos?${params}`),
      api('GET', `/api/todos?${new URLSearchParams({ view: 'today', today })}`),
    ]);
    renderTodos(todos, today);
    renderTodayCount(dueTodos, today);
  } catch (err) {
    showError(err.message);
  }
}

// ---------- 이벤트 ----------

function selectView(view, category = null) {
  state.view = view;
  state.category = category;
  showError('');
  renderMenuSelection();

  // 등록 영역 기본값을 현재 메뉴에 맞춘다.
  if (view === 'category') el.categorySelect.value = category;
  resetDueInput();

  refresh();
}

// "오늘 마감" 메뉴에서는 오늘 날짜를, 그 외에는 빈 값을 기본 마감일로 둔다.
function resetDueInput() {
  el.dueInput.value = state.view === 'today' ? localToday() : '';
}

document.querySelector('.sidebar').addEventListener('click', (event) => {
  const button = event.target.closest('.menu-item');
  if (button) selectView(button.dataset.view, button.dataset.category ?? null);
});

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = el.titleInput.value.trim();
  if (!title) {
    el.titleInput.value = '';
    showError('할 일 제목을 입력해 주세요.');
    el.titleInput.focus();
    return;
  }

  const submit = el.form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await api('POST', '/api/todos', {
      title,
      category_id: el.categorySelect.value,
      due_date: el.dueInput.value || null,
    });
    showError('');
    el.titleInput.value = '';
    resetDueInput();
    el.titleInput.focus();
    await refresh();
  } catch (err) {
    showError(err.message);
  } finally {
    submit.disabled = false;
  }
});

el.list.addEventListener('change', async (event) => {
  if (event.target.type !== 'checkbox') return;
  const id = event.target.closest('.todo').dataset.id;
  try {
    await api('PATCH', `/api/todos/${id}`, { is_completed: event.target.checked });
    showError('');
  } catch (err) {
    showError(err.message);
  }
  await refresh();
});

el.list.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-button');
  if (!button) return;
  const item = button.closest('.todo');
  const title = item.querySelector('.todo-title').textContent;
  if (!confirm(`"${title}"을(를) 삭제할까요?`)) return;
  try {
    await api('DELETE', `/api/todos/${item.dataset.id}`);
    showError('');
  } catch (err) {
    showError(err.message);
  }
  await refresh();
});

// ---------- 시작 ----------

async function init() {
  try {
    state.categories = await api('GET', '/api/categories');
    renderCategories();
    selectView('all');
  } catch (err) {
    showError(`서버에 연결할 수 없습니다. ${err.message}`);
  }
}

init();
