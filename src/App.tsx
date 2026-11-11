import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadSession, login, logout, type Session } from './api/auth';
import { clearAttachmentCache } from './api/attachments';
import { ApiError, loadProjectData } from './api/rest';
import { sendDateUpdate, sendStatusReport } from './api/rtc';
import type { ProjectData } from './api/types';
import { Connection } from './components/Connection';
import { EditDialog, type EditResult } from './components/EditDialog';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  GROUP_LABEL,
  applyFilter,
  buildTasks,
  groupTasks,
  type Category,
  type Filter,
  type GroupBy,
  type Task,
} from './model';
import { Board } from './views/Board';
import { Calendar } from './views/Calendar';
import { Charts } from './views/Charts';
import { Grid } from './views/Grid';

// Fest konfiguriertes Projekt (REKO AK BIM). Überschreibbar per VITE_KOPPLA_PROJECT_ID.
const PROJECT_ID = import.meta.env.VITE_KOPPLA_PROJECT_ID || 'UHJvamVjdE5vZGU6MTc3MDg=';

type View = 'grid' | 'board' | 'calendar' | 'charts';
const VIEWS: [View, string][] = [
  ['grid', 'Raster'],
  ['board', 'Board'],
  ['calendar', 'Kalender'],
  ['charts', 'Diagramme'],
];

function store<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function persist(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignorieren */
  }
}

interface Editing {
  task: Task;
  dates?: { start: Date; due: Date };
  status?: 'GREEN' | 'YELLOW' | 'RED' | 'REPORTED_DONE' | 'DONE';
}

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => store('kopplanner.apiKey', ''));
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => store('kopplanner.view', 'board'));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => store('kopplanner.groupBy', 'bucket'));
  const [filter, setFilter] = useState<Filter>(() => store('kopplanner.filter', { text: '', categories: [], hideDone: true }));
  const [showConn, setShowConn] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  useEffect(() => persist('kopplanner.view', view), [view]);
  useEffect(() => persist('kopplanner.groupBy', groupBy), [groupBy]);
  useEffect(() => persist('kopplanner.filter', filter), [filter]);

  const reload = useCallback(async () => {
    if (!apiKey) {
      setShowConn(true);
      return;
    }
    setLoading(true);
    setError(null);
    clearAttachmentCache();
    try {
      setData(await loadProjectData(PROJECT_ID, apiKey));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? 'API-Key ungültig oder abgelaufen (401).'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const tasks = useMemo(() => (data ? buildTasks(data) : []), [data]);
  const visible = useMemo(() => applyFilter(tasks, filter), [tasks, filter]);
  const groups = useMemo(() => groupTasks(visible, groupBy), [visible, groupBy]);

  const open = (task: Task, opts?: { dates?: { start: Date; due: Date }; status?: Editing['status'] }) =>
    setEditing({ task, ...opts });

  const save = async (r: EditResult) => {
    if (!editing || !session) throw new Error('Nicht angemeldet');
    const t = editing.task;
    if (r.kind === 'status') {
      await sendStatusReport(session, setSession, PROJECT_ID, {
        orderId: t.id,
        status: r.status,
        progress: r.progress,
        reason: r.reason,
        comment: r.comment,
      });
    } else {
      await sendDateUpdate(session, setSession, PROJECT_ID, { id: t.id, startAt: r.startAt, finishAt: r.finishAt });
    }
    setEditing(null);
    setToast(`„${t.name}“ in koppla gespeichert.`);
    await reload();
  };

  const toggleCat = (c: Category) =>
    setFilter((f) => ({
      ...f,
      categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
    }));

  const filterActive = filter.categories.length > 0 || filter.hideDone;

  return (
    <div className="app">
      <header className="top">
        <div className="logo">Kopplanner</div>
        <div className="project" title={PROJECT_ID}>
          {data?.project?.name ?? 'Projekt'}
        </div>
        <nav className="tabs">
          {VIEWS.map(([v, l]) => (
            <button key={v} className={`tab ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
              {l}
            </button>
          ))}
        </nav>
        <span className="sp" />
        <input
          className="search"
          placeholder="Aufgaben suchen"
          value={filter.text}
          onChange={(e) => setFilter((f) => ({ ...f, text: e.target.value }))}
        />
        <div className="dropdown">
          <button className={filterActive ? 'active' : ''} onClick={() => setShowFilter((s) => !s)}>
            Filter{filterActive ? ' •' : ''}
          </button>
          {showFilter && (
            <div className="menu" onMouseLeave={() => setShowFilter(false)}>
              {CATEGORIES.map((c) => (
                <label key={c}>
                  <input type="checkbox" checked={filter.categories.includes(c)} onChange={() => toggleCat(c)} />{' '}
                  {CATEGORY_LABEL[c]}
                </label>
              ))}
              <hr />
              <label>
                <input
                  type="checkbox"
                  checked={filter.hideDone}
                  onChange={(e) => setFilter((f) => ({ ...f, hideDone: e.target.checked }))}
                />{' '}
                Abgeschlossene ausblenden
              </label>
            </div>
          )}
        </div>
        {view !== 'calendar' && view !== 'charts' && (
          <label className="groupby">
            Gruppieren nach:
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABEL[g]}
                </option>
              ))}
            </select>
          </label>
        )}
        <button onClick={reload} disabled={loading} title="Neu laden">
          {loading ? '…' : '⟳'}
        </button>
        <button className={session ? 'ok' : ''} onClick={() => setShowConn(true)}>
          {session ? '● Bearbeiten aktiv' : 'Verbindung'}
        </button>
      </header>

      {error && <div className="error banner">{error}</div>}

      <main className="content">
        {!data && !loading && !error && <p className="muted">Bitte API-Key unter „Verbindung“ eintragen.</p>}
        {data && view === 'board' && <Board groups={groups} groupBy={groupBy} tasks={visible} apiKey={apiKey} onOpen={open} />}
        {data && view === 'grid' && <Grid groups={groups} onOpen={open} />}
        {data && view === 'calendar' && <Calendar tasks={visible} onOpen={open} />}
        {data && view === 'charts' && <Charts tasks={visible} />}
      </main>

      <footer className="note">
        {data ? `${visible.length} von ${tasks.length} Aufgaben` : ''} · Lesen: koppla Public REST API · Bearbeiten: interne
        koppla-Schnittstelle (inoffiziell)
        {view === 'board' && ' · Tipp: Bei Gruppierung nach „Fortschritt“ oder „koppla-Status“ Karten per Drag & Drop melden'}
        {view === 'calendar' && ' · Tipp: Aufgabe auf anderen Tag ziehen verschiebt den Termin'}
      </footer>

      {toast && <div className="toast">{toast}</div>}

      {showConn && (
        <Connection
          apiKey={apiKey}
          session={session}
          onApiKey={(k) => {
            setApiKey(k);
            persist('kopplanner.apiKey', k);
            setShowConn(false);
          }}
          onLogin={async (email, pw) => setSession(await login(email, pw))}
          onLogout={() => {
            logout(session);
            setSession(null);
          }}
          onClose={() => setShowConn(false)}
        />
      )}

      {editing && (
        <EditDialog
          task={editing.task}
          canWrite={!!session}
          apiKey={apiKey}
          initialDates={editing.dates}
          initialStatus={editing.status}
          onCancel={() => setEditing(null)}
          onSubmit={save}
        />
      )}
    </div>
  );
}
