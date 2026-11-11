import { useState } from 'react';
import { TaskCard } from '../components/TaskCard';
import type { Group, GroupBy, Task } from '../model';

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
  onOpen: (t: Task, opts?: { status?: 'GREEN' | 'YELLOW' | 'RED' | 'REPORTED_DONE' | 'DONE' }) => void;
}

export function Board({ groups, groupBy, tasks, onOpen }: Props) {
  const [over, setOver] = useState<string | null>(null);
  const canDrop = groupBy === 'category' || groupBy === 'status';
  return (
    <div className="board">
      {groups.map((g) => {
        const st = canDrop ? dropStatus(groupBy, g.key) : null;
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
              {g.color && <i className="dot" style={{ background: g.color }} />}
              {g.label} <span className="muted">({g.tasks.length})</span>
            </div>
            <div className="colbody">
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
