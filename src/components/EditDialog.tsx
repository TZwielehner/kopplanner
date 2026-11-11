import { useMemo, useState } from 'react';
import { STATUS_LABEL, addDays, dueDate, fmtDate, toInputDate, toKopplaIso, type Task } from '../model';

export type EditResult =
  | {
      kind: 'status';
      status: 'GREEN' | 'YELLOW' | 'RED' | 'REPORTED_DONE' | 'DONE';
      progress: number;
      reason: string | null;
      comment: string | null;
    }
  | { kind: 'dates'; startAt: string; finishAt: string };

const REASONS: Record<string, string> = {
  STAFF: 'Personal',
  PRELIMINARY_WORK: 'Vorleistung',
  MATERIAL: 'Material',
  REWORK: 'Nacharbeit',
  OTHER: 'Sonstiges',
};

const STATUS_OPTIONS = ['GREEN', 'YELLOW', 'RED', 'REPORTED_DONE', 'DONE'] as const;

function parseInput(v: string) {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d);
}

interface Props {
  task: Task;
  canWrite: boolean;
  /** Vorschlag, z. B. aus Drag & Drop im Kalender */
  initialDates?: { start: Date; due: Date };
  initialStatus?: (typeof STATUS_OPTIONS)[number];
  onCancel: () => void;
  onSubmit: (r: EditResult) => Promise<void>;
}

export function EditDialog({ task, canWrite, initialDates, initialStatus, onCancel, onSubmit }: Props) {
  const [tab, setTab] = useState<'status' | 'dates'>(initialDates ? 'dates' : 'status');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(
    initialStatus ?? ((STATUS_OPTIONS as readonly string[]).includes(task.status) ? (task.status as never) : 'GREEN'),
  );
  const [progress, setProgress] = useState(task.progress);
  const [reason, setReason] = useState<string>('');
  const [comment, setComment] = useState('');
  const [start, setStart] = useState(toInputDate(initialDates?.start ?? task.start));
  const [due, setDue] = useState(toInputDate(initialDates?.due ?? dueDate(task)));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsReason = status === 'YELLOW' || status === 'RED';
  const effProgress = status === 'DONE' || status === 'REPORTED_DONE' ? 100 : progress;

  const validation = useMemo(() => {
    if (tab === 'status') {
      if (needsReason && !reason) return 'Bei Verzug/Problem bitte einen Grund wählen.';
      if (needsReason && !comment.trim()) return 'Bei Verzug/Problem bitte einen Kommentar angeben.';
      return null;
    }
    if (!start || !due) return 'Start und Fälligkeit angeben.';
    if (parseInput(due) < parseInput(start)) return 'Fälligkeit liegt vor dem Start.';
    return null;
  }, [tab, needsReason, reason, comment, start, due]);

  const result = (): EditResult => {
    if (tab === 'status') {
      return {
        kind: 'status',
        status,
        progress: effProgress,
        reason: needsReason ? reason : null,
        comment: comment.trim() || null,
      };
    }
    // koppla: finishAt ist exklusiv -> Folgetag 00:00
    return {
      kind: 'dates',
      startAt: toKopplaIso(parseInput(start)),
      finishAt: toKopplaIso(addDays(parseInput(due), 1)),
    };
  };

  const diff: [string, string, string][] =
    tab === 'status'
      ? [
          ['Status', STATUS_LABEL[task.status] ?? task.status, STATUS_LABEL[status]],
          ['Fortschritt', `${task.progress} %`, `${effProgress} %`],
          ...(needsReason ? ([['Grund', '–', REASONS[reason] ?? '–']] as [string, string, string][]) : []),
          ...(comment.trim() ? ([['Kommentar', '–', comment.trim()]] as [string, string, string][]) : []),
        ]
      : [
          ['Start', fmtDate(task.start), fmtDate(parseInput(start))],
          ['Fällig', fmtDate(dueDate(task)), fmtDate(parseInput(due))],
        ];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(result());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true">
        <h3>{task.name}</h3>
        <div className="muted small">
          {task.bucketPath} · {task.tradeName}
          {task.order.isFixed && ' · fixiert'}
        </div>

        {!confirming ? (
          <>
            <div className="seg">
              <button className={tab === 'status' ? 'on' : ''} onClick={() => setTab('status')}>
                Status melden
              </button>
              <button className={tab === 'dates' ? 'on' : ''} onClick={() => setTab('dates')}>
                Termin ändern
              </button>
            </div>

            {tab === 'status' ? (
              <div className="form">
                <label>
                  Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as never)}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fortschritt: {effProgress} %
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={effProgress}
                    disabled={status === 'DONE' || status === 'REPORTED_DONE'}
                    onChange={(e) => setProgress(Number(e.target.value))}
                  />
                </label>
                {needsReason && (
                  <label>
                    Grund
                    <select value={reason} onChange={(e) => setReason(e.target.value)}>
                      <option value="">– wählen –</option>
                      {Object.entries(REASONS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Kommentar
                  <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                </label>
                {task.report && (
                  <div className="muted small">
                    Letzte Meldung: {STATUS_LABEL[task.report.status] ?? task.report.status},{' '}
                    {fmtDate(new Date(task.report.reportedAt))}
                    {task.report.createdBy && ` von ${task.report.createdBy.firstName} ${task.report.createdBy.lastName}`}
                    {task.report.comment && ` – „${task.report.comment}“`}
                  </div>
                )}
              </div>
            ) : (
              <div className="form">
                <div className="row2">
                  <label>
                    Start
                    <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                  </label>
                  <label>
                    Fällig am
                    <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                  </label>
                </div>
                {task.order.isFixed && (
                  <div className="warn small">Dieser Auftrag ist in koppla fixiert.</div>
                )}
                <div className="muted small">
                  Abhängige Aufträge können in koppla mitverschoben werden.
                </div>
              </div>
            )}

            {validation && <div className="warn small">{validation}</div>}
            {!canWrite && <div className="warn small">Zum Speichern bitte unter „Verbindung“ bei koppla anmelden.</div>}
            <div className="actions">
              <button onClick={onCancel}>Abbrechen</button>
              <button className="primary" disabled={!!validation || !canWrite} onClick={() => setConfirming(true)}>
                Weiter
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="small">Diese Änderung wird direkt in koppla gespeichert:</p>
            <table className="diff">
              <thead>
                <tr>
                  <th />
                  <th>vorher</th>
                  <th>nachher</th>
                </tr>
              </thead>
              <tbody>
                {diff.map(([k, a, b]) => (
                  <tr key={k} className={a !== b ? 'changed' : ''}>
                    <td>{k}</td>
                    <td>{a}</td>
                    <td>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && <div className="error small">{error}</div>}
            <div className="actions">
              <button disabled={busy} onClick={() => setConfirming(false)}>
                Zurück
              </button>
              <button className="primary" disabled={busy} onClick={submit}>
                {busy ? 'Speichere …' : 'In koppla speichern'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
