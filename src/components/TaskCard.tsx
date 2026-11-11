import { CATEGORY_COLOR, CATEGORY_LABEL, dueDate, fmtShort, type Task } from '../model';

/** Schwarz oder Weiß – je nachdem, was auf der Hintergrundfarbe besser lesbar ist. */
export function textOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#242424';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#242424' : '#fff';
}

export function CategoryBadge({ task }: { task: Task }) {
  const c = task.category;
  return (
    <span className={`badge cat-${c}`} title={CATEGORY_LABEL[c]}>
      {CATEGORY_LABEL[c]}
    </span>
  );
}

export function StatusIcon({ task }: { task: Task }) {
  const c = task.category;
  const color = CATEGORY_COLOR[c];
  if (c === 'DONE')
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" aria-label="erledigt">
        <circle cx="8" cy="8" r="7" fill="none" stroke="#888" strokeWidth="1.5" />
        <path d="M4.5 8.2l2.3 2.3 4.7-4.8" fill="none" stroke="#888" strokeWidth="1.5" />
      </svg>
    );
  const half = c === 'IN_PROGRESS' || task.progress > 0;
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="none" stroke={c === 'OVERDUE' ? color : '#4f46e5'} strokeWidth="1.5" />
      {half && <path d="M1 8a7 7 0 0 0 14 0z" fill={c === 'OVERDUE' ? color : '#4f46e5'} />}
    </svg>
  );
}

const MAX_AVATARS = 4;

export function People({ task }: { task: Task }) {
  const shown = task.people.slice(0, MAX_AVATARS);
  const rest = task.people.length - shown.length;
  const all = task.people.map((p) => p.name).join(', ');
  return (
    <div className="people" title={`${task.groupName}: ${all}`}>
      {shown.map((p) => (
        <span key={p.id} className="avatar" title={p.name}>
          {p.initials}
        </span>
      ))}
      {rest > 0 && <span className="avatar more">+{rest}</span>}
      <span className="muted small">{task.groupName}</span>
    </div>
  );
}

interface Props {
  task: Task;
  onOpen: (t: Task) => void;
  draggable?: boolean;
}

export function TaskCard({ task, onOpen, draggable }: Props) {
  const due = dueDate(task);
  return (
    <div
      className="card"
      onClick={() => onOpen(task)}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/kopplanner-task', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <CategoryBadge task={task} />
      <div className="title">
        <StatusIcon task={task} /> <span className={task.category === 'DONE' ? 'done' : ''}>{task.name}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${task.progress}%` }} />
      </div>
      <div className="meta">
        <span className={task.category === 'OVERDUE' ? 'late' : ''}>
          {fmtShort(task.start)} – {fmtShort(due)}
        </span>
        <span>{task.progress} %</span>
        <span className="chip" style={task.tradeColor ? { background: task.tradeColor, color: textOn(task.tradeColor) } : undefined}>
          {task.tradeName}
        </span>
      </div>
      {task.people.length > 0 && <People task={task} />}
    </div>
  );
}
