import { useState } from 'react';
import type { Session } from '../api/auth';

interface Props {
  apiKey: string;
  session: Session | null;
  onApiKey: (k: string) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onLogout: () => void;
  onClose: () => void;
}

export function Connection({ apiKey, session, onApiKey, onLogin, onLogout, onClose }: Props) {
  const [key, setKey] = useState(apiKey);
  const [email, setEmail] = useState(session?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await onLogin(email, password);
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <h3>Verbindung zu koppla</h3>

        <div className="form">
          <h4>1. Lesen – API-Key</h4>
          <p className="muted small">
            koppla → Einstellungen → Sicherheit &amp; Zugang → API Key. Wird nur in diesem Browser gespeichert.
          </p>
          <label>
            API-Key
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </label>
          <div className="actions">
            <button className="primary" onClick={() => onApiKey(key.trim())} disabled={!key.trim()}>
              Speichern &amp; laden
            </button>
          </div>
        </div>

        <div className="form">
          <h4>2. Bearbeiten – koppla-Login</h4>
          <p className="muted small">
            Status und Termine werden über die interne koppla-Schnittstelle gespeichert. Dafür ist eine Anmeldung mit
            E-Mail und Passwort nötig. Das Passwort wird nicht gespeichert, nur das Sitzungs-Token (bis der Tab
            geschlossen wird).
          </p>
          {session ? (
            <div className="actions" style={{ justifyContent: 'space-between' }}>
              <span className="small">Angemeldet als {session.email}</span>
              <button onClick={onLogout}>Abmelden</button>
            </div>
          ) : (
            <>
              <label>
                E-Mail
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </label>
              <label>
                Passwort
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                />
              </label>
              {error && <div className="error small">{error}</div>}
              <div className="actions">
                <button className="primary" onClick={doLogin} disabled={busy || !email || !password}>
                  {busy ? 'Anmelden …' : 'Anmelden'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}
