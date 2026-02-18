import type {
  CreateProjectInput,
  CreateTaskInput,
  DependencyType,
  Project,
  ProjectMember,
  ProjectMetrics,
  Task,
  TaskDependency,
  Tenant,
  UpdateTaskInlineInput,
  WorkflowColumn,
} from '@/domain/types';

export interface TenantRepository {
  listTenants(userId: string): Promise<Tenant[]>;
  createTenantWithOwner(name: string, preferredSlug?: string): Promise<Tenant>;
}

export interface ProjectRepository {
  listProjects(userId: string, tenantSlug: string): Promise<Project[]>;
  createProjectWithDefaults(tenantSlug: string, input: CreateProjectInput): Promise<Project>;
  getProjectMembers(projectId: string): Promise<ProjectMember[]>;
  listWorkflowColumns(projectId: string): Promise<WorkflowColumn[]>;
  updateProjectSettings(projectId: string, input: Pick<Project, 'name' | 'description'>): Promise<Project>;
}

export interface TaskRepository {
  listTasks(projectId: string): Promise<Task[]>;
  listDependencies(projectId: string): Promise<TaskDependency[]>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTaskInline(input: UpdateTaskInlineInput): Promise<Task>;
  moveTask(taskId: string, toColumnId: string, newRank: number): Promise<Task>;
  reorderTasks(projectId: string, orderedTaskIds: string[]): Promise<void>;
  setTaskDependencies(projectId: string, successorTaskId: string, predecessorTaskIds: string[], type?: DependencyType): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
}

export interface DashboardRepository {
  getProjectMetrics(projectId: string, rangeDays: number): Promise<ProjectMetrics>;
}
