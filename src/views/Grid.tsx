import { useMemo, useState } from 'react';
import { CategoryBadge, StatusIcon } from '../components/TaskCard';
import { ALL_KEY, STATUS_LABEL, dueDate, fmtDate, type Group, type Task } from '../model';

type SortKey = 'name' | 'start' | 'due' | 'progress' | 'status' | 'trade' | 'bucket';

const COLS: [SortKey, string][] = [
  ['name', 'Aufgabe'],
  ['status', 'Fortschritt'],
  ['start', 'Start'],
  ['due', 'Fällig'],
  ['progress', '%'],
  ['trade', 'Zugewiesen zu'],
  ['bucket', 'Bucket (WBS)'],
];

function cmp(a: Task, b: Task, k: SortKey) {
  switch (k) {
    case 'name':
      return a.name.localeCompare(b.name, 'de');
    case 'start':
      return a.start.getTime() - b.start.getTime();
    case 'due':
      return a.finish.getTime() - b.finish.getTime();
    case 'progress':
      return a.progress - b.progress;
    case 'status':
      return a.category.localeCompare(b.category);
    case 'trade':
      return a.tradeName.localeCompare(b.tradeName, 'de');
    case 'bucket':
      return a.bucketOrder - b.bucketOrder;
  }
}

export function Grid({ groups, onOpen }: { groups: Group[]; onOpen: (t: Task) => void }) {
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'due', dir: 1 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () => groups.map((g) => ({ ...g, tasks: [...g.tasks].sort((a, b) => cmp(a, b, sort.k) * sort.dir) })),
    [groups, sort],
  );

  const toggle = (key: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div className="gridwrap">
      <table className="grid">
        <thead>
          <tr>
            {COLS.map(([k, label]) => (
              <th
                key={k}
                onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : 1 }))}
                className="sortable"
              >
                {label} {sort.k === k ? (sort.dir === 1 ? '↑' : '↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((g) => (
            <GroupRows key={g.key} g={g} collapsed={collapsed.has(g.key)} onToggle={() => toggle(g.key)} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  g,
  collapsed,
  onToggle,
  onOpen,
}: {
  g: Group;
  collapsed: boolean;
  onToggle: () => void;
  onOpen: (t: Task) => void;
}) {
  return (
    <>
      {g.key !== ALL_KEY && (
        <tr className="grp" onClick={onToggle}>
          <td colSpan={COLS.length}>
            {collapsed ? '▸' : '▾'} {g.label} <span className="muted">({g.tasks.length})</span>
          </td>
        </tr>
      )}
      {!collapsed &&
        g.tasks.map((t) => (
          <tr key={t.id} className="row" onClick={() => onOpen(t)}>
            <td>
              <StatusIcon task={t} /> <span className={t.category === 'DONE' ? 'done' : ''}>{t.name}</span>
            </td>
            <td>
              <CategoryBadge task={t} />{' '}
              <span className="muted small">{STATUS_LABEL[t.status] ?? t.status}</span>
            </td>
            <td>{fmtDate(t.start)}</td>
            <td className={t.category === 'OVERDUE' ? 'late' : ''}>{fmtDate(dueDate(t))}</td>
            <td>{t.progress} %</td>
            <td>{t.tradeName}</td>
            <td className="muted">{t.bucketPath}</td>
          </tr>
        ))}
    </>
  );
}
