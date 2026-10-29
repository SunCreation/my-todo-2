// 길 B: Supabase Auth를 백엔드에서 호출한다.
// 화면은 Supabase를 직접 부르지 않고 /api/auth/* 로만 로그인하며, 받은 토큰을 이후 요청에 붙인다.
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { ValidationError } = require('../validation');

// 같은 IP에서 15분 동안 limit번까지만 허용한다.
function limitPer15Minutes(limit, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: message },
  });
}

// 서버에서는 세션을 저장하거나 자동 갱신하지 않는다. (요청마다 토큰을 받아서 쓴다)
const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

// Supabase 오류 코드를 사용자에게 보여 줄 한국어 메시지로 바꾼다.
const AUTH_MESSAGES = {
  invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
  user_already_exists: '이미 가입된 이메일입니다.',
  weak_password: '비밀번호가 너무 약합니다. 6자 이상으로 입력해 주세요.',
  email_not_confirmed: '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.',
  email_address_invalid: '사용할 수 없는 이메일 주소입니다.',
  over_email_send_rate_limit: '인증 메일 발송 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.',
  over_request_rate_limit: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  refresh_token_not_found: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
};

function authError(res, error, fallbackStatus = 400) {
  const status = error.status >= 400 && error.status < 500 ? error.status : fallbackStatus;
  res.status(status).json({ error: AUTH_MESSAGES[error.code] ?? error.message });
}

function parseCredentials(body) {
  const { email, password } = body ?? {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new ValidationError('이메일을 올바르게 입력해 주세요.');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new ValidationError('비밀번호는 6자 이상이어야 합니다.');
  }
  return { email: email.trim(), password };
}

// 화면에 돌려줄 세션 정보 (토큰과 최소한의 사용자 정보만)
function toSession(session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: { id: session.user.id, email: session.user.email },
  };
}

function createSupabaseAuth({ url, anonKey }) {
  // accessToken을 주면 그 사용자 권한으로 DB에 접근하는 클라이언트가 된다. (RLS 적용)
  const newClient = (accessToken) =>
    createClient(url, anonKey, accessToken
      ? { ...CLIENT_OPTIONS, global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : CLIENT_OPTIONS);

  // 비밀번호 대입 공격 방지: 로그인·회원가입은 15분에 10번까지.
  // 모든 로그인이 이 서버를 거쳐 Supabase로 가므로, 여기서 막지 않으면
  // 한 사람의 반복 요청이 Supabase의 IP별 제한에 걸려 모든 사용자가 로그인하지 못하게 된다.
  const authAttemptLimit = limitPer15Minutes(10, '로그인 시도가 너무 많습니다. 15분 후에 다시 시도해 주세요.');
  // 토큰 재발급은 화면이 자동으로 호출하므로 조금 넉넉하게 둔다.
  const refreshLimit = limitPer15Minutes(60, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');

  const router = express.Router();

  router.post('/signup', authAttemptLimit, async (req, res) => {
    const { email, password } = parseCredentials(req.body);
    const { data, error } = await newClient().auth.signUp({ email, password });
    if (error) return authError(res, error);
    // 이메일 인증을 켜 둔 프로젝트는 세션 없이 사용자만 만들어진다.
    if (!data.session) {
      return res.status(202).json({
        needsConfirmation: true,
        message: '가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.',
      });
    }
    res.status(201).json(toSession(data.session));
  });

  router.post('/login', authAttemptLimit, async (req, res) => {
    const { email, password } = parseCredentials(req.body);
    const { data, error } = await newClient().auth.signInWithPassword({ email, password });
    if (error) return authError(res, error, 401);
    res.json(toSession(data.session));
  });

  // access token(기본 1시간)이 만료되면 refresh token으로 새로 발급받는다.
  router.post('/refresh', refreshLimit, async (req, res) => {
    const refreshToken = req.body?.refresh_token;
    if (typeof refreshToken !== 'string' || !refreshToken) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    const { data, error } = await newClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return authError(res, error ?? {}, 401);
    res.json(toSession(data.session));
  });

  // 백엔드 권한 검증: 토큰이 없거나 Supabase가 인정하지 않는 토큰이면 401.
  // 통과하면 req.user(로그인 사용자)와 req.supabase(그 사용자 권한의 DB 클라이언트)를 붙인다.
  async function requireUser(req, res, next) {
    const match = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
    if (!match) return res.status(401).json({ error: '로그인이 필요합니다.' });

    const client = newClient(match[1]);
    const { data, error } = await client.auth.getUser(match[1]);
    if (error || !data.user) {
      return res.status(401).json({ error: '로그인이 만료되었거나 올바르지 않습니다.' });
    }

    req.user = { id: data.user.id, email: data.user.email };
    req.supabase = client;
    next();
  }

  return { router, requireUser };
}

module.exports = { createSupabaseAuth };
