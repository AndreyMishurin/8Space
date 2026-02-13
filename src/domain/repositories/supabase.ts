import { supabase } from '@/integrations/supabase/client';
import type {
  CompletionTrendPoint,
  CreateProjectInput,
  CreateTaskInput,
  DashboardWorkloadItem,
  DependencyType,
  Project,
  ProjectMember,
  ProjectMetrics,
  ProjectRole,
  Task,
  TaskAttachment,
  TaskChecklistItem,
  TaskDependency,
  TaskLabel,
  UpdateTaskInlineInput,
  UserProfile,
  WorkflowColumn,
  WorkflowColumnKind,
} from '@/domain/types';
import type { DashboardRepository, ProjectRepository, TaskRepository } from '@/domain/repositories/interfaces';

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  archived_at: string | null;
}

interface ProjectMemberJoinedRow {
  role: ProjectRole;
  project: ProjectRow | ProjectRow[] | null;
}

interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  profile: ProfileRow | ProfileRow[] | null;
}

interface WorkflowColumnRow {
  id: string;
  project_id: string;
  name: string;
  kind: WorkflowColumnKind;
  position: number;
  wip_limit: number | null;
  definition_of_done: string | null;
}

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  status_column_id: string;
  start_date: string | null;
  due_date: string | null;
  priority: 'p0' | 'p1' | 'p2';
  order_rank: string | number;
  description: string | null;
  estimate: number | null;
  is_milestone: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskAssigneeRow {
  task_id: string;
  user_id: string;
  profile: ProfileRow | ProfileRow[] | null;
}

interface TaskLabelLinkRow {
  task_id: string;
  label: LabelRow | LabelRow[] | null;
}

interface LabelRow {
  id: string;
  project_id: string;
  name: string;
  color: string;
}

interface TaskChecklistRow {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
}

interface TaskAttachmentRow {
  id: string;
  task_id: string;
  url: string;
  title: string | null;
  created_at: string;
}

interface TaskDependencyRow {
  id: string;
  project_id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  type: DependencyType;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

function requireData<T>(value: T | null, message: string): T {
  if (value === null) {
    throw new Error(message);
  }
  return value;
}

function mapProfile(row: ProfileRow | undefined): UserProfile | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

function mapProject(row: ProjectRow, role: ProjectRole): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    role,
  };
}

function mapWorkflowColumn(row: WorkflowColumnRow): WorkflowColumn {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    kind: row.kind,
    position: row.position,
    wipLimit: row.wip_limit,
    definitionOfDone: row.definition_of_done,
  };
}

function mapTaskChecklistItem(row: TaskChecklistRow): TaskChecklistItem {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    isDone: row.is_done,
    position: row.position,
  };
}

function mapTaskAttachment(row: TaskAttachmentRow): TaskAttachment {
  return {
    id: row.id,
    taskId: row.task_id,
    url: row.url,
    title: row.title,
    createdAt: row.created_at,
  };
}

function mapTaskLabel(row: LabelRow): TaskLabel {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    color: row.color,
  };
}

function toRank(value: string | number): number {
  return typeof value === 'string' ? Number.parseFloat(value) : value;
}

async function fetchTaskRows(projectId: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(
      'id,project_id,title,status_column_id,start_date,due_date,priority,order_rank,description,estimate,is_milestone,completed_at,created_at,updated_at'
    )
    .eq('project_id', projectId)
    .order('order_rank', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as TaskRow[] | null) ?? [];
}

async function hydrateTasks(projectId: string, taskRows: TaskRow[]): Promise<Task[]> {
  if (taskRows.length === 0) {
    return [];
  }

  const taskIds = taskRows.map((task) => task.id);

  const [assigneeResp, labelResp, checklistResp, attachmentResp] = await Promise.all([
    supabase
      .from('task_assignees')
      .select('task_id,user_id,profile:profiles(id,display_name,avatar_url)')
      .in('task_id', taskIds),
    supabase
      .from('task_label_links')
      .select('task_id,label:task_labels(id,project_id,name,color)')
      .in('task_id', taskIds),
    supabase.from('task_checklist_items').select('id,task_id,title,is_done,position').in('task_id', taskIds),
    supabase.from('task_attachments').select('id,task_id,url,title,created_at').in('task_id', taskIds),
  ]);

  if (assigneeResp.error) {
    throw assigneeResp.error;
  }
  if (labelResp.error) {
    throw labelResp.error;
  }
  if (checklistResp.error) {
    throw checklistResp.error;
  }
  if (attachmentResp.error) {
    throw attachmentResp.error;
  }

  const assigneesByTask = new Map<string, UserProfile[]>();
  const taskAssignees = (assigneeResp.data as TaskAssigneeRow[] | null) ?? [];
  for (const row of taskAssignees) {
    const profile = mapProfile(unwrapOne(row.profile));
    if (!profile) {
      continue;
    }

    const bucket = assigneesByTask.get(row.task_id) ?? [];
    bucket.push(profile);
    assigneesByTask.set(row.task_id, bucket);
  }

  const tagsByTask = new Map<string, TaskLabel[]>();
  const labelRows = (labelResp.data as TaskLabelLinkRow[] | null) ?? [];
  for (const row of labelRows) {
    const label = unwrapOne(row.label);
    if (!label) {
      continue;
    }

    const bucket = tagsByTask.get(row.task_id) ?? [];
    bucket.push(mapTaskLabel(label));
    tagsByTask.set(row.task_id, bucket);
  }

  const checklistByTask = new Map<string, TaskChecklistItem[]>();
  const checklistRows = (checklistResp.data as TaskChecklistRow[] | null) ?? [];
  for (const row of checklistRows) {
    const bucket = checklistByTask.get(row.task_id) ?? [];
    bucket.push(mapTaskChecklistItem(row));
    checklistByTask.set(row.task_id, bucket);
  }

  const attachmentsByTask = new Map<string, TaskAttachment[]>();
  const attachmentRows = (attachmentResp.data as TaskAttachmentRow[] | null) ?? [];
  for (const row of attachmentRows) {
    const bucket = attachmentsByTask.get(row.task_id) ?? [];
    bucket.push(mapTaskAttachment(row));
    attachmentsByTask.set(row.task_id, bucket);
  }

  return taskRows.map((row) => ({
    id: row.id,
    projectId,
    title: row.title,
    statusColumnId: row.status_column_id,
    assignees: assigneesByTask.get(row.id) ?? [],
    dueDate: row.due_date,
    startDate: row.start_date,
    priority: row.priority,
    orderRank: toRank(row.order_rank),
    description: row.description,
    tags: tagsByTask.get(row.id) ?? [],
    checklist: (checklistByTask.get(row.id) ?? []).sort((a, b) => a.position - b.position),
    attachments: attachmentsByTask.get(row.id) ?? [],
    estimate: row.estimate,
    completedAt: row.completed_at,
    isMilestone: row.is_milestone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function fetchTaskById(projectId: string, taskId: string): Promise<Task> {
  const taskRows = await fetchTaskRows(projectId);
  const tasks = await hydrateTasks(projectId, taskRows);
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  return task;
}

export class SupabaseProjectRepository implements ProjectRepository {
  async listProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select('role,project:projects!inner(id,name,description,created_by,created_at,archived_at)')
      .eq('user_id', userId)
      .is('project.archived_at', null);

    if (error) {
      throw error;
    }

    const rows = (data as ProjectMemberJoinedRow[] | null) ?? [];

    return rows
      .map((row) => {
        const project = unwrapOne(row.project);
        return project ? mapProject(project, row.role) : null;
      })
      .filter((project): project is Project => Boolean(project))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createProjectWithDefaults(input: CreateProjectInput): Promise<Project> {
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const userId = userResult.user?.id;
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase.rpc('create_project_with_defaults', {
      p_name: input.name,
      p_description: input.description ?? null,
    });

    if (error) {
      throw error;
    }

    const projectId = requireData(data as string | null, 'create_project_with_defaults returned no id');
    const projects = await this.listProjects(userId);
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      throw new Error('Project created but not visible');
    }

    return project;
  }

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id,user_id,role,profile:profiles(id,display_name,avatar_url)')
      .eq('project_id', projectId);

    if (error) {
      throw error;
    }

    const rows = (data as ProjectMemberRow[] | null) ?? [];

    return rows.map((row) => ({
      projectId: row.project_id,
      userId: row.user_id,
      role: row.role,
      profile: mapProfile(unwrapOne(row.profile)),
    }));
  }

  async listWorkflowColumns(projectId: string): Promise<WorkflowColumn[]> {
    const { data, error } = await supabase
      .from('workflow_columns')
      .select('id,project_id,name,kind,position,wip_limit,definition_of_done')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) {
      throw error;
    }

    return ((data as WorkflowColumnRow[] | null) ?? []).map(mapWorkflowColumn);
  }

  async updateProjectSettings(projectId: string, input: Pick<Project, 'name' | 'description'>): Promise<Project> {
    const { data: updateData, error } = await supabase
      .from('projects')
      .update({
        name: input.name,
        description: input.description ?? null,
      })
      .eq('id', projectId)
      .select('id,name,description,created_by,created_at,archived_at')
      .single();

    if (error) {
      throw error;
    }

    const updatedProject = updateData as ProjectRow;

    const { data: roleData, error: roleError } = await supabase.rpc('current_project_role', {
      p_project_id: projectId,
    });

    if (roleError) {
      throw roleError;
    }

    const role = (roleData ?? 'viewer') as ProjectRole;
    return mapProject(updatedProject, role);
  }
}

export class SupabaseTaskRepository implements TaskRepository {
  async listTasks(projectId: string): Promise<Task[]> {
    const taskRows = await fetchTaskRows(projectId);
    return hydrateTasks(projectId, taskRows);
  }

  async listDependencies(projectId: string): Promise<TaskDependency[]> {
    const { data, error } = await supabase
      .from('task_dependencies')
      .select('id,project_id,predecessor_task_id,successor_task_id,type')
      .eq('project_id', projectId);

    if (error) {
      throw error;
    }

    const rows = (data as TaskDependencyRow[] | null) ?? [];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      predecessorTaskId: row.predecessor_task_id,
      successorTaskId: row.successor_task_id,
      type: row.type,
    }));
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    if (!input.startDate || !input.dueDate) {
      throw new Error('Start date and due date are required.');
    }

    if (input.dueDate < input.startDate) {
      throw new Error('Due date must be the same or later than start date.');
    }

    const payload = {
      project_id: input.projectId,
      title: input.title,
      status_column_id: input.statusColumnId,
      due_date: input.dueDate,
      start_date: input.startDate,
      priority: input.priority ?? 'p1',
      order_rank: input.orderRank ?? 1000,
      description: input.description ?? null,
      estimate: input.estimate ?? null,
      is_milestone: input.isMilestone ?? false,
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select(
        'id,project_id,title,status_column_id,start_date,due_date,priority,order_rank,description,estimate,is_milestone,completed_at,created_at,updated_at'
      )
      .single();

    if (error) {
      throw error;
    }

    const createdTask = data as TaskRow;

    if (input.assigneeIds && input.assigneeIds.length > 0) {
      const links = input.assigneeIds.map((userId) => ({ task_id: createdTask.id, user_id: userId }));
      const { error: assigneeError } = await supabase.from('task_assignees').insert(links);
      if (assigneeError) {
        throw assigneeError;
      }
    }

    try {
      return await fetchTaskById(createdTask.project_id, createdTask.id);
    } catch (error) {
      console.error('Failed to hydrate created task, returning fallback row', error);
      return {
        id: createdTask.id,
        projectId: createdTask.project_id,
        title: createdTask.title,
        statusColumnId: createdTask.status_column_id,
        assignees: [],
        dueDate: createdTask.due_date,
        startDate: createdTask.start_date,
        priority: createdTask.priority,
        orderRank: toRank(createdTask.order_rank),
        description: createdTask.description,
        tags: [],
        checklist: [],
        attachments: [],
        estimate: createdTask.estimate,
        completedAt: createdTask.completed_at,
        isMilestone: createdTask.is_milestone,
        createdAt: createdTask.created_at,
        updatedAt: createdTask.updated_at,
      };
    }
  }

  async updateTaskInline(input: UpdateTaskInlineInput): Promise<Task> {
    const { data: currentTask, error: currentError } = await supabase
      .from('tasks')
      .select('id,project_id')
      .eq('id', input.taskId)
      .single();

    if (currentError) {
      throw currentError;
    }

    const taskRef = currentTask as { id: string; project_id: string };

    const updatePayload: Record<string, unknown> = {};

    if (input.title !== undefined) updatePayload.title = input.title;
    if (input.statusColumnId !== undefined) updatePayload.status_column_id = input.statusColumnId;
    if (input.dueDate !== undefined) updatePayload.due_date = input.dueDate;
    if (input.startDate !== undefined) updatePayload.start_date = input.startDate;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.orderRank !== undefined) updatePayload.order_rank = input.orderRank;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.estimate !== undefined) updatePayload.estimate = input.estimate;
    if (input.completedAt !== undefined) updatePayload.completed_at = input.completedAt;
    if (input.isMilestone !== undefined) updatePayload.is_milestone = input.isMilestone;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase.from('tasks').update(updatePayload).eq('id', input.taskId);
      if (updateError) {
        throw updateError;
      }
    }

    if (input.assigneeIds !== undefined) {
      const { error: clearError } = await supabase.from('task_assignees').delete().eq('task_id', input.taskId);
      if (clearError) {
        throw clearError;
      }

      if (input.assigneeIds.length > 0) {
        const links = input.assigneeIds.map((userId) => ({ task_id: input.taskId, user_id: userId }));
        const { error: assignError } = await supabase.from('task_assignees').insert(links);
        if (assignError) {
          throw assignError;
        }
      }
    }

    return fetchTaskById(taskRef.project_id, input.taskId);
  }

  async moveTask(taskId: string, toColumnId: string, newRank: number): Promise<Task> {
    const { data, error } = await supabase.rpc('move_task', {
      p_task_id: taskId,
      p_to_column_id: toColumnId,
      p_new_rank: newRank,
    });

    if (error) {
      throw error;
    }

    const row = requireData(data as TaskRow | null, 'move_task returned no data');
    return fetchTaskById(row.project_id, row.id);
  }

  async reorderTasks(_projectId: string, orderedTaskIds: string[]): Promise<void> {
    if (orderedTaskIds.length === 0) {
      return;
    }

    const updates = orderedTaskIds.map((taskId, index) =>
      supabase
        .from('tasks')
        .update({ order_rank: (index + 1) * 1000 })
        .eq('id', taskId)
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      throw failed.error;
    }
  }

  async setTaskDependencies(
    projectId: string,
    successorTaskId: string,
    predecessorTaskIds: string[],
    type: DependencyType = 'FS'
  ): Promise<void> {
    const { error: deleteError } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('project_id', projectId)
      .eq('successor_task_id', successorTaskId);

    if (deleteError) {
      throw deleteError;
    }

    if (predecessorTaskIds.length === 0) {
      return;
    }

    const rows = predecessorTaskIds.map((predecessorTaskId) => ({
      project_id: projectId,
      predecessor_task_id: predecessorTaskId,
      successor_task_id: successorTaskId,
      type,
    }));

    const { error: insertError } = await supabase.from('task_dependencies').insert(rows);

    if (insertError) {
      throw insertError;
    }
  }
}

interface DashboardMetricsRpc {
  tasksByStatus?: Record<string, number>;
  overdueCount?: number;
  dueThisWeek?: number;
  workloadByAssignee?: DashboardWorkloadItem[];
  completionTrend?: CompletionTrendPoint[];
}

export class SupabaseDashboardRepository implements DashboardRepository {
  async getProjectMetrics(projectId: string, rangeDays: number): Promise<ProjectMetrics> {
    const { data, error } = await supabase.rpc('dashboard_metrics', {
      p_project_id: projectId,
      p_days_window: rangeDays,
    });

    if (error) {
      throw error;
    }

    const metrics = (data ?? {}) as DashboardMetricsRpc;

    return {
      tasksByStatus: metrics.tasksByStatus ?? {},
      overdueCount: metrics.overdueCount ?? 0,
      dueThisWeek: metrics.dueThisWeek ?? 0,
      workloadByAssignee: metrics.workloadByAssignee ?? [],
      completionTrend: metrics.completionTrend ?? [],
    };
  }
}

export const projectRepository = new SupabaseProjectRepository();
export const taskRepository = new SupabaseTaskRepository();
export const dashboardRepository = new SupabaseDashboardRepository();
