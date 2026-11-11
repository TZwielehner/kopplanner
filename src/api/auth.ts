// Login für Schreibzugriffe.
// Die koppla-Web-App meldet sich mit E-Mail/Passwort an (POST /auth/login) und
// erhält ein Access-Token, mit dem sie sich an der Echtzeit-Schnittstelle anmeldet.
// Nicht öffentlich dokumentiert – siehe README.
import { API_BASE } from './rest';

export interface Session {
  email: string;
  accessToken: string;
  refreshToken: string;
  sessionId?: string;
}

const KEY = 'kopplanner.session';

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* Speicher nicht verfügbar */
  }
}

export async function login(email: string, password: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login fehlgeschlagen (${res.status})`);
  }
  const data = await res.json();
  if (!data?.accessToken) throw new Error('Login-Antwort enthält kein accessToken');
  const s: Session = {
    email,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    sessionId: data.sessionId,
  };
  saveSession(s);
  return s;
}

export async function refresh(s: Session): Promise<Session> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  });
  if (!res.ok) {
    saveSession(null);
    throw new Error(`Sitzung abgelaufen (${res.status}) – bitte neu anmelden`);
  }
  const data = await res.json();
  const next: Session = { ...s, accessToken: data.accessToken, refreshToken: data.refreshToken ?? s.refreshToken };
  saveSession(next);
  return next;
}

export async function logout(s: Session | null) {
  saveSession(null);
  if (!s?.sessionId) return;
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${s.accessToken}` },
    body: JSON.stringify({ sessionId: s.sessionId }),
  }).catch(() => undefined);
}

/** Ablaufzeit aus dem JWT lesen (ms), falls vorhanden. */
export function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
