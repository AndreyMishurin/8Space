export type ProjectRole = 'owner' | 'editor' | 'viewer';
export type TenantRole = 'owner' | 'admin' | 'member';
export type TaskPriority = 'p0' | 'p1' | 'p2';
export type WorkflowColumnKind = 'backlog' | 'todo' | 'in_progress' | 'done' | 'custom';
export type DependencyType = 'FS';

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  createdBy: string;
  createdAt: string;
  archivedAt?: string | null;
  role: ProjectRole;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
  profile?: UserProfile;
}

export interface WorkflowColumn {
  id: string;
  projectId: string;
  name: string;
  kind: WorkflowColumnKind;
  position: number;
  wipLimit?: number | null;
  definitionOfDone?: string | null;
}

export interface TaskLabel {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  position: number;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  url: string;
  title?: string | null;
  createdAt: string;
}

export interface TaskDependency {
  id: string;
  projectId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: DependencyType;
}

export interface TaskActivity {
  id: string;
  projectId: string;
  taskId: string;
  actorId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  statusColumnId: string;
  assignees: UserProfile[];
  dueDate?: string | null;
  startDate?: string | null;
  priority: TaskPriority;
  orderRank: number;
  description?: string | null;
  tags: TaskLabel[];
  checklist: TaskChecklistItem[];
  attachments: TaskAttachment[];
  estimate?: number | null;
  completedAt?: string | null;
  isMilestone: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  statusColumnId: string;
  assigneeIds?: string[];
  dueDate: string;
  startDate: string;
  priority?: TaskPriority;
  orderRank?: number;
  description?: string;
  estimate?: number | null;
  isMilestone?: boolean;
}

export interface UpdateTaskInlineInput {
  taskId: string;
  title?: string;
  statusColumnId?: string;
  assigneeIds?: string[];
  dueDate?: string | null;
  startDate?: string | null;
  priority?: TaskPriority;
  orderRank?: number;
  description?: string;
  estimate?: number | null;
  completedAt?: string | null;
  isMilestone?: boolean;
}

export interface DashboardWorkloadItem {
  userId: string;
  displayName: string;
  activeCount: number;
}

export interface CompletionTrendPoint {
  date: string;
  doneCount: number;
}

export interface ProjectMetrics {
  tasksByStatus: Record<string, number>;
  overdueCount: number;
  dueThisWeek: number;
  workloadByAssignee: DashboardWorkloadItem[];
  completionTrend: CompletionTrendPoint[];
}
