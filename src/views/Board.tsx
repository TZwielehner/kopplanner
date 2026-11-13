import { useState } from 'react';
import { SectionDocs } from '../components/Attachments';
import { TaskCard } from '../components/TaskCard';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, STATUS_LABEL, type Group, type GroupBy, type Task } from '../model';

const DROP_STATUSES = ['GREEN', 'YELLOW', 'RED', 'REPORTED_DONE', 'DONE'];

/** Bei Status-Gruppierungen auch leere Zielspalten anzeigen, damit man dorthin ziehen kann. */
function withDropColumns(groups: Group[], by: GroupBy): Group[] {
  if (by !== 'status' && by !== 'category') return groups;
  const have = new Set(groups.map((g) => g.key));
  const extra: Group[] =
    by === 'status'
      ? Object.keys(STATUS_LABEL)
          .filter((s) => DROP_STATUSES.includes(s) && !have.has(s))
          .map((s) => ({ key: s, label: STATUS_LABEL[s], sort: Object.keys(STATUS_LABEL).indexOf(s), tasks: [] }))
      : CATEGORIES.filter((c) => (c === 'IN_PROGRESS' || c === 'DONE') && !have.has(c)).map((c) => ({
          key: c,
          label: CATEGORY_LABEL[c],
          sort: CATEGORIES.indexOf(c),
          color: CATEGORY_COLOR[c],
          tasks: [],
        }));
  return [...groups, ...extra].sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
}

/** Welche Spalten beim Ablegen in einen Status übersetzt werden können. */
function dropStatus(by: GroupBy, key: string): 'GREEN' | 'YELLOW' | 'RED' | 'REPORTED_DONE' | 'DONE' | null {
  if (by === 'category') return key === 'DONE' ? 'DONE' : key === 'IN_PROGRESS' ? 'GREEN' : null;
  if (by === 'status') return (['GREEN', 'YELLOW', 'RED', 'REPORTED_DONE', 'DONE'] as const).find((s) => s === key) ?? null;
  return null;
}

interface Props {
  groups: Group[];
  groupBy: GroupBy;
  tasks: Task[];
  apiKey: string;
  onOpen: (t: Task, opts?: { status?: 'GREEN' | 'YELLOW' | 'RED' | 'REPORTED_DONE' | 'DONE' }) => void;
}

const COLLAPSE_KEY = 'kopplanner.boardCollapsed';

function loadCollapsed(): Record<string, string[]> {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function Board({ groups, groupBy, tasks, apiKey, onOpen }: Props) {
  const [over, setOver] = useState<string | null>(null);
  const [collapsedAll, setCollapsedAll] = useState(loadCollapsed);
  const collapsed = new Set(collapsedAll[groupBy] ?? []);
  const toggle = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const all = { ...collapsedAll, [groupBy]: [...next] };
    setCollapsedAll(all);
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(all));
    } catch {
      /* ohne Speicher nur für diese Sitzung */
    }
  };
  const canDrop = groupBy === 'category' || groupBy === 'status';
  return (
    <div className="board">
      {withDropColumns(groups, groupBy).map((g) => {
        const st = canDrop ? dropStatus(groupBy, g.key) : null;
        const isCollapsed = collapsed.has(g.key);
        if (isCollapsed)
          return (
            <button
              key={g.key}
              type="button"
              className="col collapsed"
              onClick={() => toggle(g.key)}
              title={`${g.label} ausklappen`}
              aria-expanded={false}
            >
              <span className="chev">›</span>
              {g.color && <i className="dot" style={{ background: g.color }} />}
              <span className="vlabel">{g.label}</span>
              <span className="muted">{g.tasks.length}</span>
            </button>
          );
        return (
          <div
            key={g.key}
            className={`col ${over === g.key && st ? 'over' : ''}`}
            onDragOver={(e) => {
              if (st) {
                e.preventDefault();
                setOver(g.key);
              }
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              const id = e.dataTransfer.getData('text/kopplanner-task');
              const t = tasks.find((x) => x.id === id);
              if (t && st) onOpen(t, { status: st });
            }}
          >
            <div className="colh">
              <button
                type="button"
                className="chev"
                onClick={() => toggle(g.key)}
                title={`${g.label} einklappen`}
                aria-expanded={true}
              >
                ‹
              </button>
              {g.color && <i className="dot" style={{ background: g.color }} />}
              {g.label} <span className="muted">({g.tasks.length})</span>
            </div>
            {groupBy === 'bucket' && g.key !== '_none' && (
              <div className="colh-docs">
                <SectionDocs sectionId={g.key} apiKey={apiKey} />
              </div>
            )}
            <div className="colbody">
              {st && g.tasks.length === 0 && <div className="dropzone">Hierher ziehen</div>}
              {g.tasks.map((t) => (
                <TaskCard key={t.id} task={t} onOpen={onOpen} draggable={canDrop} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
