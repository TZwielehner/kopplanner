// Lesender Zugriff über die koppla Public REST API.
// Auth: persönlicher API-Key als `Authorization: Bearer <key>`.
import type {
  ContributorGroup,
  Milestone,
  Order,
  Project,
  ProjectData,
  StatusReport,
  Trade,
  WbsSection,
} from './types';

export const API_BASE = 'https://api-v2.koppla.de';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, `${res.status} ${res.statusText} – ${path}${text ? `: ${text}` : ''}`);
  }
  return res.json() as Promise<T>;
}

export async function loadProjectData(projectId: string, apiKey: string): Promise<ProjectData> {
  const p = `/projects/${encodeURIComponent(projectId)}`;
  const [project, orders, sections, trades, groups, milestones, latestReports] = await Promise.all([
    get<Project>(p, apiKey).catch(() => null),
    get<Order[]>(`${p}/orders`, apiKey),
    get<WbsSection[]>(`${p}/wbs-sections`, apiKey),
    get<Trade[]>(`${p}/trades`, apiKey),
    get<ContributorGroup[]>(`${p}/contributor-groups`, apiKey),
    get<Milestone[]>(`${p}/milestones`, apiKey),
    get<StatusReport[]>(`${p}/order-status-reports/latest`, apiKey),
  ]);
  return { project, orders, sections, trades, groups, milestones, latestReports };
}
