import { useMemo, useState } from 'react';
import { StatusIcon } from '../components/TaskCard';
import { addDays, dueDate, startOfDay, type Task } from '../model';

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MAX_PER_DAY = 4;

function mondayOf(d: Date) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface Props {
  tasks: Task[];
  onOpen: (t: Task, opts?: { dates?: { start: Date; due: Date } }) => void;
}

/**
 * Wie im MS Planner wird jede Aufgabe an ihrem Fälligkeitstag angezeigt.
 * Drag & Drop auf einen anderen Tag verschiebt Start und Fälligkeit um dieselbe Anzahl Tage
 * (Bestätigung im Dialog).
 */
export function Calendar({ tasks, onOpen }: Props) {
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [over, setOver] = useState<string | null>(null);
  const today = startOfDay(new Date());

  const days = useMemo(() => {
    if (mode === 'week') {
      const m = mondayOf(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(m, i));
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const m = mondayOf(first);
    return Array.from({ length: 42 }, (_, i) => addDays(m, i));
  }, [mode, anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const d = startOfDay(dueDate(t));
      const k = d.toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return map;
  }, [tasks]);

  const move = (dir: number) =>
    setAnchor((a) => (mode === 'week' ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));

  const title =
    mode === 'week'
      ? `${days[0].toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const onDrop = (day: Date, id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const due = startOfDay(dueDate(t));
    const shift = Math.round((day.getTime() - due.getTime()) / 86400000);
    if (shift === 0) return;
    onOpen(t, { dates: { start: addDays(startOfDay(t.start), shift), due: day } });
  };

  return (
    <div className="calendar">
      <div className="calbar">
        <button onClick={() => setAnchor(startOfDay(new Date()))}>Heute</button>
        <button onClick={() => move(-1)} aria-label="zurück">
          ‹
        </button>
        <button onClick={() => move(1)} aria-label="vor">
          ›
        </button>
        <b className="caltitle">{title}</b>
        <span className="sp" />
        <div className="seg">
          <button className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>
            Woche
          </button>
          <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>
            Monat
          </button>
        </div>
      </div>
      <div className={`calgrid ${mode}`}>
        {DAYS.map((d, i) => (
          <div key={d} className="calhead">
            {mode === 'week' ? `${days[i].getDate()} ${d}` : d}
          </div>
        ))}
        {days.map((d) => {
          const k = d.toDateString();
          const list = byDay.get(k) ?? [];
          const out = mode === 'month' && d.getMonth() !== anchor.getMonth();
          const we = d.getDay() === 0 || d.getDay() === 6;
          const shown = mode === 'week' ? list : list.slice(0, MAX_PER_DAY);
          return (
            <div
              key={k}
              className={`calday ${out ? 'out' : ''} ${we ? 'we' : ''} ${sameDay(d, today) ? 'today' : ''} ${over === k ? 'over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(k);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                setOver(null);
                onDrop(d, e.dataTransfer.getData('text/kopplanner-task'));
              }}
            >
              {mode === 'month' && <div className="daynum">{d.getDate()}</div>}
              {shown.map((t) => (
                <div
                  key={t.id}
                  className={`pill cat-${t.category}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/kopplanner-task', t.id)}
                  onClick={() => onOpen(t)}
                  title={`${t.name} (${t.bucketName})`}
                >
                  <StatusIcon task={t} /> <span>{t.name}</span>
                </div>
              ))}
              {list.length > shown.length && (
                <button className="more small" onClick={() => (setAnchor(d), setMode('week'))}>
                  + {list.length - shown.length} weitere
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
