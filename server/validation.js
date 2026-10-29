const VIEWS = ['all', 'today', 'done', 'category'];
const TITLE_MAX = 200;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// 'YYYY-MM-DD' 형식이면서 실제로 존재하는 날짜인지 확인한다. (2026-02-30 같은 값 거부)
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// 서버 컴퓨터의 로컬 날짜. 브라우저가 today를 보내지 않았을 때만 사용한다.
function localToday() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function parseListQuery(query, categoryIds) {
  const view = query.view ?? 'all';
  if (!VIEWS.includes(view)) {
    throw new ValidationError(`view는 ${VIEWS.join(', ')} 중 하나여야 합니다.`);
  }

  const category = query.category;
  if (view === 'category' && !categoryIds.includes(category)) {
    throw new ValidationError('존재하지 않는 카테고리입니다.');
  }

  const today = query.today ?? localToday();
  if (!isValidDate(today)) {
    throw new ValidationError('today는 YYYY-MM-DD 형식의 날짜여야 합니다.');
  }

  return { view, category, today };
}

function parseNewTodo(body, categoryIds) {
  const { title, category_id, due_date } = body ?? {};

  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new ValidationError('할 일 제목을 입력해 주세요.');
  }
  const trimmed = title.trim();
  if (trimmed.length > TITLE_MAX) {
    throw new ValidationError(`할 일 제목은 ${TITLE_MAX}자 이하로 입력해 주세요.`);
  }

  if (!categoryIds.includes(category_id)) {
    throw new ValidationError('카테고리를 선택해 주세요.');
  }

  const dueDate = due_date === undefined || due_date === null || due_date === '' ? null : due_date;
  if (dueDate !== null && !isValidDate(dueDate)) {
    throw new ValidationError('마감일은 YYYY-MM-DD 형식의 날짜여야 합니다.');
  }

  return { title: trimmed, category_id, due_date: dueDate };
}

function parseCompletedUpdate(body) {
  const isCompleted = body?.is_completed;
  if (typeof isCompleted !== 'boolean') {
    throw new ValidationError('is_completed는 true 또는 false여야 합니다.');
  }
  return isCompleted;
}

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError('잘못된 할 일 id입니다.');
  }
  return Number(value);
}

module.exports = {
  ValidationError,
  isValidDate,
  parseListQuery,
  parseNewTodo,
  parseCompletedUpdate,
  parseId,
};
