const API_BASE = '/api';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('cardle_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const sessionToken = localStorage.getItem('cardle_session');
  if (sessionToken) headers['X-Session-Token'] = sessionToken;

  return headers;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  auth: {
    register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request('/auth/me'),
  },
  game: {
    getDaily: () => request('/game/daily'),
    submitDailyGuess: (guess) => request('/game/daily/guess', { method: 'POST', body: JSON.stringify({ guess }) }),
    startPractice: () => request('/game/practice/start', { method: 'POST' }),
    submitPracticeGuess: (practiceId, gameSessionId, guess) =>
      request(`/game/practice/${practiceId}/guess`, {
        method: 'POST',
        body: JSON.stringify({ guess, gameSessionId }),
      }),
    getShared: (code) => request(`/game/share/${code}`),
    getUserStats: () => request('/game/user/stats'),
  },
};

export function ensureSession() {
  let session = localStorage.getItem('cardle_session');
  if (!session) {
    session = crypto.randomUUID();
    localStorage.setItem('cardle_session', session);
  }
  return session;
}
