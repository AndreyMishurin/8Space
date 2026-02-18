import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useCreateTask,
  useDeleteTask,
  useMoveTask,
  useProject,
  useTasks,
  useWorkflowColumns,
} from '@/hooks/use-project-data';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { ErrorScreen } from '@/components/ErrorScreen';
import { isTaskOverdue, nextOrderRankInColumn, sortTasksByRank } from '@/utils/tasks';

interface BoardViewProps {
  tenantSlug: string;
  projectId: string;
}

export function BoardView({ tenantSlug, projectId }: BoardViewProps) {
  const project = useProject(projectId, tenantSlug);
  const columnsQuery = useWorkflowColumns(projectId);
  const tasksQuery = useTasks(projectId);

  const createTask = useCreateTask(projectId);
  const moveTask = useMoveTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  const [newTitleByColumn, setNewTitleByColumn] = useState<Record<string, string>>({});
  const [newStartByColumn, setNewStartByColumn] = useState<Record<string, string>>({});
  const [newDueByColumn, setNewDueByColumn] = useState<Record<string, string>>({});
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const defaultStartDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const defaultDueDate = useMemo(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'), []);

  const columns = useMemo(() => columnsQuery.data ?? [], [columnsQuery.data]);
  const tasks = useMemo(() => sortTasksByRank(tasksQuery.data ?? []), [tasksQuery.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const column of columns) {
      map.set(column.id, []);
    }

    for (const task of tasks) {
      const bucket = map.get(task.statusColumnId);
      if (!bucket) {
        map.set(task.statusColumnId, [task]);
      } else {
        bucket.push(task);
      }
    }

    return map;
  }, [columns, tasks]);

  const canEdit = project ? project.role !== 'viewer' : false;

  if (columnsQuery.isLoading || tasksQuery.isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <Spinner variant="infinite" size={40} />
        <p className="text-sm text-muted-foreground">Loading board…</p>
      </div>
    );
  }

  const failingQuery = columnsQuery.isError ? columnsQuery : tasksQuery.isError ? tasksQuery : null;
  if (failingQuery) {
    return (
      <ErrorScreen
        variant="inline"
        code={500}
        message={getErrorMessage(failingQuery.error)}
        onRetry={() => failingQuery.refetch()}
        showGoHome={false}
      />
    );
  }

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Board</h2>
          <p className="text-sm text-muted-foreground">Move cards across stages and keep flow visible.</p>
        </div>
        {!canEdit && <p className="text-sm text-warning">Viewer role: drag and create are disabled.</p>}
      </div>
      {createError && <p className="mb-4 text-sm text-error">{createError}</p>}

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(260px, 1fr))` }}>
        {columns.map((column) => {
          const columnTasks = grouped.get(column.id) ?? [];

          return (
            <div
              key={column.id}
              className={cn('rounded-lg border border-border bg-card flex flex-col min-h-[420px]', dragTaskId && 'ring-1 ring-border')}
              onDragOver={(event) => {
                if (!canEdit) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                if (!canEdit) return;
                event.preventDefault();

                const taskId = event.dataTransfer.getData('text/task-id');
                if (!taskId) return;

                const maxRank = columnTasks[columnTasks.length - 1]?.orderRank ?? 0;
                moveTask.mutate({ taskId, toColumnId: column.id, newRank: maxRank + 1000 });
                setDragTaskId(null);
              }}
            >
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{column.name}</h3>
                  <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
                </div>
                {column.definitionOfDone && (
                  <p className="mt-1 text-xs text-muted-foreground">DoD: {column.definitionOfDone}</p>
                )}
              </div>

              <div className="p-3 border-b border-border space-y-2">
                <Input
                  value={newTitleByColumn[column.id] ?? ''}
                  onChange={(event) =>
                    setNewTitleByColumn((current) => ({
                      ...current,
                      [column.id]: event.target.value,
                    }))
                  }
                  onKeyDown={async (event) => {
                    if (event.key !== 'Enter') {
                      return;
                    }

                    const value = (newTitleByColumn[column.id] ?? '').trim();
                    const startDate = newStartByColumn[column.id] ?? defaultStartDate;
                    const dueDate = newDueByColumn[column.id] ?? defaultDueDate;
                    if (!value || !canEdit) {
                      return;
                    }
                    if (!startDate || !dueDate) {
                      setCreateError('Start date and due date are required.');
                      return;
                    }
                    if (dueDate < startDate) {
                      setCreateError('Due date must be the same or later than start date.');
                      return;
                    }

                    setCreateError(null);
                    try {
                      await createTask.mutateAsync({
                        title: value,
                        statusColumnId: column.id,
                        startDate,
                        dueDate,
                        priority: 'p1',
                        orderRank: nextOrderRankInColumn(tasks, column.id),
                      });
                      setNewTitleByColumn((current) => ({ ...current, [column.id]: '' }));
                    } catch (error) {
                      const message = getErrorMessage(error, 'Failed to create task.');
                      setCreateError(message);
                    }
                  }}
                  placeholder={`Add to ${column.name}`}
                  className="h-9"
                  disabled={!canEdit}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={newStartByColumn[column.id] ?? defaultStartDate}
                    onChange={(event) =>
                      setNewStartByColumn((current) => ({
                        ...current,
                        [column.id]: event.target.value,
                      }))
                    }
                    className="h-9"
                    aria-label={`${column.name} start date`}
                    disabled={!canEdit}
                  />
                  <Input
                    type="date"
                    value={newDueByColumn[column.id] ?? defaultDueDate}
                    onChange={(event) =>
                      setNewDueByColumn((current) => ({
                        ...current,
                        [column.id]: event.target.value,
                      }))
                    }
                    className="h-9"
                    aria-label={`${column.name} due date`}
                    disabled={!canEdit}
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!canEdit || !(newTitleByColumn[column.id] ?? '').trim()}
                  onClick={async () => {
                    const value = (newTitleByColumn[column.id] ?? '').trim();
                    const startDate = newStartByColumn[column.id] ?? defaultStartDate;
                    const dueDate = newDueByColumn[column.id] ?? defaultDueDate;
                    if (!value || !canEdit) return;
                    if (!startDate || !dueDate) {
                      setCreateError('Start date and due date are required.');
                      return;
                    }
                    if (dueDate < startDate) {
                      setCreateError('Due date must be the same or later than start date.');
                      return;
                    }

                    setCreateError(null);
                    try {
                      await createTask.mutateAsync({
                        title: value,
                        statusColumnId: column.id,
                        startDate,
                        dueDate,
                        priority: 'p1',
                        orderRank: nextOrderRankInColumn(tasks, column.id),
                      });
                      setNewTitleByColumn((current) => ({ ...current, [column.id]: '' }));
                    } catch (error) {
                      const message = getErrorMessage(error, 'Failed to create task.');
                      setCreateError(message);
                    }
                  }}
                >
                  <Plus className="size-4" /> Quick add
                </Button>
              </div>

              <div className="p-3 space-y-2 flex-1 overflow-auto">
                {columnTasks.map((task) => {
                  const overdue = isTaskOverdue(task);

                  return (
                    <article
                      key={task.id}
                      className={cn(
                        'rounded-md border border-border bg-background p-3 space-y-2 cursor-grab active:cursor-grabbing',
                        overdue && 'border-error/50 ring-1 ring-error/25'
                      )}
                      draggable={canEdit}
                      onDragStart={(event) => {
                        if (!canEdit) return;
                        event.dataTransfer.setData('text/task-id', task.id);
                        setDragTaskId(task.id);
                      }}
                      onDragEnd={() => setDragTaskId(null)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium leading-snug flex-1 min-w-0">{task.title}</h4>
                        <div className="flex items-center gap-1 shrink-0">
                          {overdue && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-error/10 text-error">
                              <AlertTriangle className="size-3" /> overdue
                            </span>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Delete «${task.title}»?`)) return;
                                try {
                                  await deleteTask.mutateAsync(task.id);
                                } catch (error) {
                                  setCreateError(getErrorMessage(error, 'Failed to delete task.'));
                                }
                              }}
                              title="Delete task"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="px-2 py-1 rounded bg-muted">{task.priority.toUpperCase()}</span>
                        <span>{task.assignees[0]?.displayName ?? 'Unassigned'}</span>
                        <span>{task.dueDate ?? 'No due'}</span>
                      </div>

                      {task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}

                {columnTasks.length === 0 && (
                  <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
                    Drop cards here or add one quickly.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
