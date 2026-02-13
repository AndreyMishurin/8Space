import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProjectInput,
  CreateTaskInput,
  DependencyType,
  Project,
  ProjectMember,
  Task,
  UpdateTaskInlineInput,
  WorkflowColumn,
} from '@/domain/types';
import { projectRepository, taskRepository } from '@/domain/repositories';
import { useAuth } from '@/hooks/use-auth';

export const queryKeys = {
  projects: (userId: string) => ['projects', userId] as const,
  columns: (projectId: string) => ['projects', projectId, 'columns'] as const,
  members: (projectId: string) => ['projects', projectId, 'members'] as const,
  tasks: (projectId: string) => ['projects', projectId, 'tasks'] as const,
  dependencies: (projectId: string) => ['projects', projectId, 'dependencies'] as const,
  metrics: (projectId: string, days: number) => ['projects', projectId, 'metrics', days] as const,
  metricsPrefix: (projectId: string) => ['projects', projectId, 'metrics'] as const,
};

function sortByRank(tasks: Task[]) {
  return [...tasks].sort((a, b) => a.orderRank - b.orderRank);
}

export function useProjects() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.projects(user?.id ?? 'anonymous'),
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }
      return projectRepository.listProjects(user.id);
    },
    enabled: Boolean(user?.id),
  });
}

export function useProject(projectId: string | undefined) {
  const projectsQuery = useProjects();

  return useMemo<Project | undefined>(() => {
    if (!projectId) {
      return undefined;
    }

    return projectsQuery.data?.find((project) => project.id === projectId);
  }, [projectId, projectsQuery.data]);
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => projectRepository.createProjectWithDefaults(input),
    onSuccess: async () => {
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.projects(user.id) });
      }
    },
  });
}

export function useWorkflowColumns(projectId: string | undefined) {
  return useQuery<WorkflowColumn[]>({
    queryKey: queryKeys.columns(projectId ?? 'no-project'),
    queryFn: async () => {
      if (!projectId) {
        return [];
      }
      return projectRepository.listWorkflowColumns(projectId);
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery<ProjectMember[]>({
    queryKey: queryKeys.members(projectId ?? 'no-project'),
    queryFn: async () => {
      if (!projectId) {
        return [];
      }
      return projectRepository.getProjectMembers(projectId);
    },
    enabled: Boolean(projectId),
  });
}

export function useTasks(projectId: string | undefined) {
  return useQuery<Task[]>({
    queryKey: queryKeys.tasks(projectId ?? 'no-project'),
    queryFn: async () => {
      if (!projectId) {
        return [];
      }
      return sortByRank(await taskRepository.listTasks(projectId));
    },
    enabled: Boolean(projectId),
  });
}

export function useTaskDependencies(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dependencies(projectId ?? 'no-project'),
    queryFn: async () => {
      if (!projectId) {
        return [];
      }
      return taskRepository.listDependencies(projectId);
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateTask(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateTaskInput, 'projectId'>) => {
      if (!projectId) {
        throw new Error('Project is required');
      }

      return taskRepository.createTask({ ...input, projectId });
    },
    onSettled: async () => {
      if (!projectId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.metricsPrefix(projectId) });
    },
  });
}

export function useUpdateTaskInline(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTaskInlineInput) => taskRepository.updateTaskInline(input),
    onMutate: async (input) => {
      if (!projectId) {
        return { previous: undefined as Task[] | undefined };
      }

      const key = queryKeys.tasks(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);

      queryClient.setQueryData<Task[]>(key, (current) => {
        if (!current) {
          return current;
        }

        return sortByRank(
          current.map((task) => {
            if (task.id !== input.taskId) {
              return task;
            }

            return {
              ...task,
              title: input.title ?? task.title,
              statusColumnId: input.statusColumnId ?? task.statusColumnId,
              dueDate: input.dueDate !== undefined ? input.dueDate : task.dueDate,
              startDate: input.startDate !== undefined ? input.startDate : task.startDate,
              priority: input.priority ?? task.priority,
              orderRank: input.orderRank ?? task.orderRank,
              description: input.description !== undefined ? input.description : task.description,
              estimate: input.estimate !== undefined ? input.estimate : task.estimate,
              completedAt: input.completedAt !== undefined ? input.completedAt : task.completedAt,
              isMilestone: input.isMilestone ?? task.isMilestone,
            };
          })
        );
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!projectId || !context?.previous) {
        return;
      }

      queryClient.setQueryData(queryKeys.tasks(projectId), context.previous);
    },
    onSettled: async () => {
      if (!projectId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.metricsPrefix(projectId) });
    },
  });
}

export function useMoveTask(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { taskId: string; toColumnId: string; newRank: number }) =>
      taskRepository.moveTask(input.taskId, input.toColumnId, input.newRank),
    onMutate: async (input) => {
      if (!projectId) {
        return { previous: undefined as Task[] | undefined };
      }

      const key = queryKeys.tasks(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);

      queryClient.setQueryData<Task[]>(key, (current) => {
        if (!current) return current;

        return sortByRank(
          current.map((task) =>
            task.id === input.taskId
              ? {
                  ...task,
                  statusColumnId: input.toColumnId,
                  orderRank: input.newRank,
                }
              : task
          )
        );
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!projectId || !context?.previous) {
        return;
      }

      queryClient.setQueryData(queryKeys.tasks(projectId), context.previous);
    },
    onSettled: async () => {
      if (!projectId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.metricsPrefix(projectId) });
    },
  });
}

export function useReorderTasks(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedTaskIds: string[]) => {
      if (!projectId) {
        throw new Error('Project is required');
      }
      await taskRepository.reorderTasks(projectId, orderedTaskIds);
    },
    onMutate: async (orderedTaskIds) => {
      if (!projectId) {
        return { previous: undefined as Task[] | undefined };
      }

      const key = queryKeys.tasks(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);

      queryClient.setQueryData<Task[]>(key, (current) => {
        if (!current) {
          return current;
        }

        const map = new Map(current.map((task) => [task.id, task]));
        const sorted = orderedTaskIds
          .map((taskId, index) => {
            const task = map.get(taskId);
            if (!task) {
              return null;
            }
            return {
              ...task,
              orderRank: (index + 1) * 1000,
            };
          })
          .filter((task): task is Task => Boolean(task));

        const missing = current.filter((task) => !orderedTaskIds.includes(task.id));
        return sortByRank([...sorted, ...missing]);
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!projectId || !context?.previous) {
        return;
      }

      queryClient.setQueryData(queryKeys.tasks(projectId), context.previous);
    },
    onSettled: async () => {
      if (!projectId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
    },
  });
}

export function useSetTaskDependencies(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { successorTaskId: string; predecessorTaskIds: string[]; type?: DependencyType }) => {
      if (!projectId) {
        throw new Error('Project is required');
      }

      await taskRepository.setTaskDependencies(projectId, input.successorTaskId, input.predecessorTaskIds, input.type);
    },
    onSuccess: async () => {
      if (!projectId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.dependencies(projectId) });
    },
  });
}

export function useDeleteTask(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      await taskRepository.deleteTask(taskId);
    },
    onMutate: async (taskId) => {
      if (!projectId) return { previous: undefined as Task[] | undefined };

      const key = queryKeys.tasks(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);

      queryClient.setQueryData<Task[]>(key, (current) => {
        if (!current) return current;
        return current.filter((task) => task.id !== taskId);
      });

      return { previous };
    },
    onError: (_error, _taskId, context) => {
      if (!projectId || !context?.previous) return;
      queryClient.setQueryData(queryKeys.tasks(projectId), context.previous);
    },
    onSettled: async () => {
      if (!projectId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dependencies(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.metricsPrefix(projectId) });
    },
  });
}

export function useUpdateProjectSettings(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string | null }) => {
      if (!projectId) {
        throw new Error('Project is required');
      }

      return projectRepository.updateProjectSettings(projectId, {
        name: input.name,
        description: input.description ?? null,
      });
    },
    onSuccess: async () => {
      if (!projectId || !user?.id) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects(user.id) });
    },
  });
}
