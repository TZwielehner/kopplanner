// Datentypen der koppla Public REST API (https://api-v2.koppla.de/docs)

export type Ref = { id: string } | null;

export type OrderStatus =
  | 'PLANNED'
  | 'GREEN'
  | 'YELLOW'
  | 'RED'
  | 'REPORTED_DONE'
  | 'REJECTED'
  | 'DONE'
  | string;

export interface Order {
  id: string;
  name: string;
  progress: number | null;
  timezone: string;
  startAt: string;
  finishAt: string;
  finishedAt: string | null;
  trade: Ref;
  contributorGroup: Ref;
  wbsSection: Ref;
  calendar: Ref;
  isFixed: boolean;
  status: OrderStatus;
}

export interface WbsSection {
  id: string;
  name: string;
  position: number;
  parent: Ref;
}

export interface Trade {
  id: string;
  name: string;
  color: string | null;
}

export interface ContributorGroup {
  id: string;
  name: string;
  permission: 'EDITOR' | 'PROGRESS_REPORTER' | 'VIEWER';
  memberships?: Membership[];
}

export interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  isActive: boolean;
  thumbnailUrl: string | null;
}

export interface Membership {
  id: string;
  permission: string;
  user: User;
}

export interface Milestone {
  id: string;
  name: string;
  date: string;
  color: string | null;
  completedAt: string | null;
  wbsSection: Ref;
}

export interface StatusReport {
  orderId: string;
  status: OrderStatus;
  progress: number | null;
  comment: string | null;
  reason: string | null;
  reportedAt: string;
  createdBy: { firstName: string; lastName: string } | null;
}

export interface Project {
  id: string;
  name: string;
}

export interface ProjectData {
  project: Project | null;
  orders: Order[];
  sections: WbsSection[];
  trades: Trade[];
  groups: ContributorGroup[];
  milestones: Milestone[];
  latestReports: StatusReport[];
}
