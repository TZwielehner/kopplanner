import type { Order, ProjectData, StatusReport } from './api/types';

export type Category = 'NOT_STARTED' | 'IN_PROGRESS' | 'OVERDUE' | 'DONE';

export const CATEGORY_LABEL: Record<Category, string> = {
  NOT_STARTED: 'Nicht begonnen',
  IN_PROGRESS: 'In Bearbeitung',
  OVERDUE: 'Überfällig',
  DONE: 'Abgeschlossen',
};

export const CATEGORY_COLOR: Record<Category, string> = {
  NOT_STARTED: '#c5c3f7',
  IN_PROGRESS: '#4f46e5',
  OVERDUE: '#d13438',
  DONE: '#3ab89a',
};

export const CATEGORIES: Category[] = ['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE', 'DONE'];

export const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Geplant',
  GREEN: 'Im Plan',
  YELLOW: 'Verzug',
  RED: 'Problem',
  REPORTED_DONE: 'Als fertig gemeldet',
  REJECTED: 'Abgelehnt',
  DONE: 'Erledigt',
};

export interface Person {
  id: string;
  name: string;
  initials: string;
}

export function toPerson(u: { id: string; firstName: string | null; lastName: string | null; email: string }): Person {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  const initials =
    ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')).toUpperCase() || u.email.slice(0, 2).toUpperCase();
  return { id: u.id, name, initials };
}

export interface Task {
  order: Order;
  id: string;
  name: string;
  start: Date;
  finish: Date;
  progress: number;
  status: string;
  category: Category;
  bucketId: string;
  bucketName: string;
  bucketPath: string;
  bucketOrder: number;
  tradeName: string;
  tradeColor: string | null;
  groupName: string;
  /** Personen = aktive Mitglieder der zugewiesenen Gruppe (koppla weist Aufträge Gruppen zu, nicht Personen). */
  people: Person[];
  report: StatusReport | null;
}

/**
 * koppla-Zeitstempel sind UTC (Auftrags-Zeitzone "UTC"), Tage beginnen um 00:00Z.
 * Wir übernehmen die UTC-Komponenten 1:1 als lokale Zeit, damit z. B.
 * 2026-05-27T00:00Z in Deutschland als 27.05. 00:00 erscheint (nicht 02:00).
 */
export function parseKopplaDate(iso: string) {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}

export function toKopplaIso(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())).toISOString();
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isDone(status: string) {
  return status === 'DONE';
}

export function categorize(o: Order, today = startOfDay(new Date())): Category {
  if (isDone(o.status)) return 'DONE';
  if (dueDate({ start: parseKopplaDate(o.startAt), finish: parseKopplaDate(o.finishAt) }) < today) return 'OVERDUE';
  if ((o.progress ?? 0) > 0 || ['GREEN', 'YELLOW', 'RED', 'REPORTED_DONE', 'REJECTED'].includes(o.status)) {
    return 'IN_PROGRESS';
  }
  return 'NOT_STARTED';
}

/**
 * koppla speichert Enddaten exklusiv (finishAt = Beginn des Folgetags).
 * Für die Anzeige als "fällig am" nehmen wir den letzten Arbeitstag davor.
 */
export function dueDate(t: { finish: Date; start: Date }) {
  const f = new Date(t.finish);
  if (f.getHours() === 0 && f.getMinutes() === 0 && f > t.start) return addDays(f, -1);
  return f;
}

export function buildTasks(data: ProjectData): Task[] {
  const sec = new Map(data.sections.map((s) => [s.id, s]));
  // Reihenfolge der Abschnitte: Tiefensuche über die Baumstruktur
  const children = new Map<string | null, typeof data.sections>();
  for (const s of data.sections) {
    const p = s.parent?.id ?? null;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(s);
  }
  const orderIdx = new Map<string, number>();
  let i = 0;
  const walk = (p: string | null) => {
    for (const s of (children.get(p) ?? []).sort((a, b) => a.position - b.position)) {
      orderIdx.set(s.id, i++);
      walk(s.id);
    }
  };
  walk(null);
  // Abschnitte ohne gefundene Wurzel ebenfalls aufnehmen
  for (const s of data.sections) if (!orderIdx.has(s.id)) orderIdx.set(s.id, i++);

  const path = (id: string) => {
    const parts: string[] = [];
    let cur = sec.get(id);
    let guard = 0;
    while (cur && guard++ < 20) {
      parts.unshift(cur.name);
      cur = cur.parent ? sec.get(cur.parent.id) : undefined;
    }
    return parts.join(' / ');
  };

  const trades = new Map(data.trades.map((t) => [t.id, t]));
  const groups = new Map(data.groups.map((g) => [g.id, g]));
  const reports = new Map(data.latestReports.map((r) => [r.orderId, r]));
  const today = startOfDay(new Date());

  return data.orders.map((o) => {
    const s = o.wbsSection ? sec.get(o.wbsSection.id) : undefined;
    const tr = o.trade ? trades.get(o.trade.id) : undefined;
    const g = o.contributorGroup ? groups.get(o.contributorGroup.id) : undefined;
    return {
      order: o,
      id: o.id,
      name: o.name,
      start: parseKopplaDate(o.startAt),
      finish: parseKopplaDate(o.finishAt),
      progress: o.progress ?? 0,
      status: o.status,
      category: categorize(o, today),
      bucketId: s?.id ?? '_none',
      bucketName: s?.name ?? 'Ohne Abschnitt',
      bucketPath: s ? path(s.id) : 'Ohne Abschnitt',
      bucketOrder: s ? (orderIdx.get(s.id) ?? 9999) : 99999,
      tradeName: tr?.name ?? 'Nicht zugewiesen',
      tradeColor: tr?.color ?? null,
      groupName: g?.name ?? 'Ohne Gruppe',
      people: (g?.memberships ?? []).filter((m) => m.user.isActive).map((m) => toPerson(m.user)),
      report: reports.get(o.id) ?? null,
    };
  });
}

// ---------- Gruppierung ----------

export type GroupBy = 'bucket' | 'trade' | 'group' | 'category' | 'status' | 'start' | 'due';

export const GROUP_LABEL: Record<GroupBy, string> = {
  bucket: 'Bucket (WBS-Abschnitt)',
  trade: 'Zugewiesen zu (Gewerk)',
  group: 'Gruppe',
  category: 'Fortschritt',
  status: 'koppla-Status',
  start: 'Startdatum',
  due: 'Fälligkeitsdatum',
};

export interface Group {
  key: string;
  label: string;
  sort: number | string;
  color?: string | null;
  tasks: Task[];
}

function dateBucket(d: Date, today: Date): { key: string; label: string; sort: number } {
  const diff = Math.floor((startOfDay(d).getTime() - today.getTime()) / 86400000);
  const dow = (today.getDay() + 6) % 7; // Mo=0
  const endOfWeek = 6 - dow;
  if (diff < 0) return { key: 'past', label: 'Vergangen', sort: 0 };
  if (diff === 0) return { key: 'today', label: 'Heute', sort: 1 };
  if (diff === 1) return { key: 'tomorrow', label: 'Morgen', sort: 2 };
  if (diff <= endOfWeek) return { key: 'week', label: 'Diese Woche', sort: 3 };
  if (diff <= endOfWeek + 7) return { key: 'nextweek', label: 'Nächste Woche', sort: 4 };
  return { key: 'later', label: 'Später', sort: 5 };
}

export function groupTasks(tasks: Task[], by: GroupBy): Group[] {
  const today = startOfDay(new Date());
  const map = new Map<string, Group>();
  const add = (key: string, label: string, sort: number | string, t: Task, color?: string | null) => {
    let g = map.get(key);
    if (!g) {
      g = { key, label, sort, color, tasks: [] };
      map.set(key, g);
    }
    g.tasks.push(t);
  };
  for (const t of tasks) {
    switch (by) {
      case 'bucket':
        add(t.bucketId, t.bucketName, t.bucketOrder, t);
        break;
      case 'trade':
        add(t.tradeName, t.tradeName, t.tradeName === 'Nicht zugewiesen' ? '￿' : t.tradeName, t, t.tradeColor);
        break;
      case 'group':
        add(t.groupName, t.groupName, t.groupName === 'Ohne Gruppe' ? '￿' : t.groupName, t);
        break;
      case 'category':
        add(t.category, CATEGORY_LABEL[t.category], CATEGORIES.indexOf(t.category), t, CATEGORY_COLOR[t.category]);
        break;
      case 'status':
        add(t.status, STATUS_LABEL[t.status] ?? t.status, Object.keys(STATUS_LABEL).indexOf(t.status), t);
        break;
      case 'start': {
        const b = dateBucket(t.start, today);
        add(b.key, b.label, b.sort, t);
        break;
      }
      case 'due': {
        if (t.category === 'DONE') {
          add('done', 'Abgeschlossen', 9, t);
        } else {
          const b = dateBucket(dueDate(t), today);
          if (b.key === 'past') add('overdue', 'Überfällig', 0, t);
          else add(b.key, b.label, b.sort, t);
        }
        break;
      }
    }
  }
  const groups = [...map.values()];
  groups.sort((a, b) =>
    typeof a.sort === 'number' && typeof b.sort === 'number'
      ? a.sort - b.sort
      : String(a.sort).localeCompare(String(b.sort), 'de'),
  );
  for (const g of groups) g.tasks.sort((a, b) => a.finish.getTime() - b.finish.getTime());
  return groups;
}

// ---------- Filter ----------

export interface Filter {
  text: string;
  categories: Category[];
  hideDone: boolean;
}

export function applyFilter(tasks: Task[], f: Filter) {
  const q = f.text.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (!q ||
        t.name.toLowerCase().includes(q) ||
        t.bucketPath.toLowerCase().includes(q) ||
        t.tradeName.toLowerCase().includes(q)) &&
      (f.categories.length === 0 || f.categories.includes(t.category)) &&
      (!f.hideDone || t.category !== 'DONE'),
  );
}

// ---------- Formatierung ----------

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const fmtShort = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
export const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
