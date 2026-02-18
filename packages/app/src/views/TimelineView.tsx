import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  subDays,
} from 'date-fns';
import { ChevronRight, Zap } from 'lucide-react';
import {
  useDeleteTask,
  useMoveTask,
  useProject,
  useSetTaskDependencies,
  useTaskDependencies,
  useTasks,
  useUpdateTaskInline,
} from '@/hooks/use-project-data';
import { Spinner } from '@/components/ui/spinner';
import { sortTasksByRank, taskDisplayEnd, taskDisplayStart } from '@/utils/tasks';
import type { Task } from '@/domain/types';
import { cn } from '@/lib/utils';
import { ErrorScreen } from '@/components/ErrorScreen';
import { getErrorMessage } from '@/lib/errors';

interface TimelineViewProps {
  tenantSlug: string;
  projectId: string;
}

type Scale = 'week' | 'month';
type DragType = 'move' | 'resize-left' | 'resize-right';

interface DragState {
  taskId: string;
  type: DragType;
  startX: number;
  originalStart: Date;
  originalEnd: Date;
  currentStart: Date;
  currentEnd: Date;
}

interface DisplayTask {
  task: Task;
  displayStart: Date;
  displayEnd: Date;
  conflict: boolean;
}

const ROW_HEIGHT = 48;

export function TimelineView({ tenantSlug, projectId }: TimelineViewProps) {
  const project = useProject(projectId, tenantSlug);
  const tasksQuery = useTasks(projectId);
  const dependenciesQuery = useTaskDependencies(projectId);

  const updateTask = useUpdateTaskInline(projectId);
  const moveTask = useMoveTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const setTaskDependencies = useSetTaskDependencies(projectId);

  const [scale, setScale] = useState<Scale>('week');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dependencyEditorTaskId, setDependencyEditorTaskId] = useState<string>('');

  const tasks = useMemo(() => sortTasksByRank(tasksQuery.data ?? []), [tasksQuery.data]);
  const dependencies = useMemo(() => dependenciesQuery.data ?? [], [dependenciesQuery.data]);
  const canEdit = project ? project.role !== 'viewer' : false;

  const displayTasks = useMemo<DisplayTask[]>(() => {
    const tasksWithDates = tasks
      .map((task) => {
        const start = taskDisplayStart(task);
        const end = taskDisplayEnd(task);
        if (!start || !end) {
          return null;
        }
        return {
          task,
          displayStart: start,
          displayEnd: end,
          conflict: false,
        };
      })
      .filter((task): task is DisplayTask => Boolean(task));

    const byId = new Map(tasksWithDates.map((item) => [item.task.id, item]));

    for (const dependency of dependencies) {
      const predecessor = byId.get(dependency.predecessorTaskId);
      const successor = byId.get(dependency.successorTaskId);
      if (!predecessor || !successor) {
        continue;
      }

      if (successor.displayStart < predecessor.displayEnd) {
        successor.conflict = true;
      }
    }

    return tasksWithDates;
  }, [dependencies, tasks]);

  const timelineRange = useMemo(() => {
    const starts = displayTasks.map((item) => item.displayStart);
    const ends = displayTasks.map((item) => item.displayEnd);

    if (starts.length === 0 || ends.length === 0) {
      const today = new Date();
      return {
        start: subDays(today, 3),
        end: addDays(today, 14),
      };
    }

    const minStart = starts.reduce((acc, value) => (value < acc ? value : acc), starts[0]);
    const maxEnd = ends.reduce((acc, value) => (value > acc ? value : acc), ends[0]);

    return {
      start: subDays(minStart, 2),
      end: addDays(maxEnd, 7),
    };
  }, [displayTasks]);

  const dates = useMemo(
    () => eachDayOfInterval({ start: timelineRange.start, end: timelineRange.end }),
    [timelineRange.end, timelineRange.start]
  );

  const cellWidth = scale === 'week' ? 36 : 20;

  const dependencyPaths = useMemo(() => {
    const taskIndex = new Map(displayTasks.map((item, index) => [item.task.id, index]));

    return dependencies
      .map((dependency) => {
        const predecessor = displayTasks.find((item) => item.task.id === dependency.predecessorTaskId);
        const successor = displayTasks.find((item) => item.task.id === dependency.successorTaskId);

        if (!predecessor || !successor) {
          return null;
        }

        const predecessorIndex = taskIndex.get(predecessor.task.id);
        const successorIndex = taskIndex.get(successor.task.id);

        if (predecessorIndex === undefined || successorIndex === undefined) {
          return null;
        }

        const fromX = (differenceInCalendarDays(predecessor.displayEnd, timelineRange.start) + 1) * cellWidth;
        const fromY = predecessorIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        const toX = differenceInCalendarDays(successor.displayStart, timelineRange.start) * cellWidth;
        const toY = successorIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        const midX = fromX + 16;

        const path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;

        return {
          id: dependency.id,
          path,
          conflict: successor.conflict,
        };
      })
      .filter((item): item is { id: string; path: string; conflict: boolean } => Boolean(item));
  }, [cellWidth, dependencies, displayTasks, timelineRange.start]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - dragState.startX;
      const deltaDays = Math.round(deltaX / cellWidth);

      let start = dragState.originalStart;
      let end = dragState.originalEnd;

      if (dragState.type === 'move') {
        start = addDays(dragState.originalStart, deltaDays);
        end = addDays(dragState.originalEnd, deltaDays);
      }

      if (dragState.type === 'resize-left') {
        start = addDays(dragState.originalStart, deltaDays);
        if (start > end) {
          start = end;
        }
      }

      if (dragState.type === 'resize-right') {
        end = addDays(dragState.originalEnd, deltaDays);
        if (end < start) {
          end = start;
        }
      }

      setDragState((current) =>
        current
          ? {
              ...current,
              currentStart: start,
              currentEnd: end,
            }
          : null
      );
    };

    const onMouseUp = () => {
      const active = dragState;
      setDragState(null);
      if (!active || !canEdit) {
        return;
      }

      const task = tasks.find((item) => item.id === active.taskId);
      if (!task) {
        return;
      }

      const startDate = format(active.currentStart, 'yyyy-MM-dd');
      const dueDate = format(active.currentEnd, 'yyyy-MM-dd');

      if (active.type === 'move') {
        const newRank = task.orderRank;
        moveTask.mutate({ taskId: task.id, toColumnId: task.statusColumnId, newRank });
      }

      updateTask.mutate({
        taskId: task.id,
        startDate,
        dueDate,
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [canEdit, cellWidth, dragState, moveTask, tasks, updateTask]);

  const monthHeaders = useMemo(() => {
    if (dates.length === 0) {
      return [];
    }

    const chunks: Array<{ label: string; width: number }> = [];
    let currentStart = dates[0];
    let width = 0;

    for (const day of dates) {
      if (!isSameMonth(day, currentStart)) {
        chunks.push({ label: format(currentStart, 'MMMM yyyy'), width });
        currentStart = day;
        width = 0;
      }
      width += cellWidth;
    }

    chunks.push({ label: format(currentStart, 'MMMM yyyy'), width });

    return chunks;
  }, [cellWidth, dates]);

  if (tasksQuery.isLoading || dependenciesQuery.isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <Spinner variant="infinite" size={40} />
        <p className="text-sm text-muted-foreground">Loading timeline…</p>
      </div>
    );
  }

  if (tasksQuery.isError) {
    return (
      <ErrorScreen
        variant="inline"
        code={500}
        message={getErrorMessage(tasksQuery.error)}
        onRetry={() => tasksQuery.refetch()}
        showGoHome={false}
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 pt-6 pb-4 space-y-4">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Projects</span>
          <ChevronRight className="size-3" />
          <span className="text-foreground">{project?.name ?? '…'}</span>
        </nav>
        <div className="flex justify-between items-end">
          <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
          <div className="flex p-1 rounded-lg border border-border bg-muted/50">
            <button
              type="button"
              className={cn(
                'px-3 py-1 text-sm rounded-md transition-colors',
                scale === 'week'
                  ? 'bg-orange-500 text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setScale('week')}
            >
              Week
            </button>
            <button
              type="button"
              className={cn(
                'px-3 py-1 text-sm rounded-md transition-colors',
                scale === 'month'
                  ? 'bg-orange-500 text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setScale('month')}
            >
              Month
            </button>
          </div>
        </div>
      </header>

      {/* Gantt area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="gantt-grid flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-card">
          {/* Left pane: Task list */}
          <div className="border-r border-border flex flex-col min-w-0 bg-card">
            <div className="h-14 border-b border-border flex items-center px-4 bg-muted/30">
              <div className="w-full grid grid-cols-[1fr_90px] gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Due date</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {displayTasks.map(({ task, conflict }) => (
                <div
                  key={task.id}
                  className={cn(
                    'h-12 border-b border-border/50 flex items-center px-4 hover:bg-muted/30 group cursor-pointer transition-colors',
                    conflict && 'ring-1 ring-error/50'
                  )}
                >
                  <div className="w-full grid grid-cols-[1fr_90px] gap-2 items-center">
                    <span className={cn('text-sm truncate group-hover:text-orange-500 transition-colors', conflict && 'text-destructive')}>
                      {task.title}
                    </span>
                    <span className="text-xs text-muted-foreground text-right">
                      {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '—'}
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      className="ml-1 p-1.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete «${task.title}»?`)) deleteTask.mutate(task.id);
                      }}
                      title="Delete task"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right pane: Timeline */}
          <div className="overflow-auto relative min-w-0">
          <div className="min-w-max">
            <div className="h-7 flex border-b border-border bg-muted/40 sticky top-0 z-20">
              {monthHeaders.map((header) => (
                <div
                  key={header.label + header.width}
                  className="border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-4 flex items-center"
                  style={{ width: header.width }}
                >
                  {header.label}
                </div>
              ))}
            </div>

            <div className="h-7 flex border-b border-border bg-muted/20 sticky top-7 z-20">
              {dates.map((date) => (
                <div
                  key={date.toISOString()}
                  className={cn(
                    'border-r border-border text-[10px] text-center flex items-center justify-center',
                    isWeekend(date) && 'bg-muted/60 text-muted-foreground',
                    isToday(date) && 'bg-orange-500/10'
                  )}
                  style={{ width: cellWidth }}
                >
                  {format(date, 'EEE d')}
                </div>
              ))}
            </div>

            <div className="relative">
              <svg
                className="absolute inset-0 pointer-events-none z-10"
                width={dates.length * cellWidth}
                height={displayTasks.length * ROW_HEIGHT}
              >
                {dependencyPaths.map((dependency) => (
                  <path
                    key={dependency.id}
                    d={dependency.path}
                    fill="none"
                    stroke={dependency.conflict ? 'hsl(var(--error))' : 'hsl(var(--muted-foreground))'}
                    strokeWidth={1.5}
                    markerEnd="url(#arrow-head)"
                  />
                ))}
                <defs>
                  <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="hsl(var(--muted-foreground))" />
                  </marker>
                </defs>
              </svg>

              {displayTasks.map(({ task, displayStart, displayEnd, conflict }, index) => {
                const rowTop = index * ROW_HEIGHT;

                const activeDrag = dragState?.taskId === task.id;
                const renderStart = activeDrag ? dragState.currentStart : displayStart;
                const renderEnd = activeDrag ? dragState.currentEnd : displayEnd;
                const renderLeft = differenceInCalendarDays(renderStart, timelineRange.start) * cellWidth;
                const renderWidth = Math.max(
                  (differenceInCalendarDays(renderEnd, renderStart) + 1) * cellWidth,
                  task.isMilestone ? 8 : cellWidth
                );

                return (
                  <div key={task.id} className="h-12 border-b border-border/50 relative" style={{ top: rowTop }}>
                    <div className="absolute inset-0 flex">
                      {dates.map((date) => (
                        <div
                          key={date.toISOString() + task.id}
                          className={cn(
                            'border-r border-border flex-shrink-0',
                            isWeekend(date) && 'bg-muted/30',
                            isToday(date) && 'bg-orange-500/5'
                          )}
                          style={{ width: cellWidth }}
                        />
                      ))}
                    </div>

                    {task.isMilestone ? (
                      <button
                        type="button"
                        className="absolute top-1/2 -translate-y-1/2 rotate-45 bg-orange-500 border border-orange-600 z-20 shadow-md gantt-task-bar"
                        style={{
                          left: renderLeft,
                          width: 12,
                          height: 12,
                        }}
                        disabled={!canEdit}
                        onMouseDown={(event) => {
                          if (!canEdit) return;
                          event.preventDefault();
                          setDragState({
                            taskId: task.id,
                            type: 'move',
                            startX: event.clientX,
                            originalStart: displayStart,
                            originalEnd: displayEnd,
                            currentStart: displayStart,
                            currentEnd: displayEnd,
                          });
                        }}
                        title={task.title}
                      />
                    ) : (
                      <div
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 rounded-md bg-orange-500 border border-orange-600 hover:bg-orange-600 z-20 shadow-md overflow-hidden gantt-task-bar cursor-pointer',
                          conflict && 'ring-2 ring-destructive'
                        )}
                        style={{
                          left: renderLeft,
                          width: renderWidth,
                          height: 24,
                        }}
                      >
                        <button
                          type="button"
                          className="absolute inset-0 cursor-grab"
                          disabled={!canEdit}
                          onMouseDown={(event) => {
                            if (!canEdit) return;
                            event.preventDefault();
                            setDragState({
                              taskId: task.id,
                              type: 'move',
                              startX: event.clientX,
                              originalStart: displayStart,
                              originalEnd: displayEnd,
                              currentStart: displayStart,
                              currentEnd: displayEnd,
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="absolute left-0 top-0 h-full w-3 cursor-ew-resize"
                          disabled={!canEdit}
                          onMouseDown={(event) => {
                            if (!canEdit) return;
                            event.preventDefault();
                            setDragState({
                              taskId: task.id,
                              type: 'resize-left',
                              startX: event.clientX,
                              originalStart: displayStart,
                              originalEnd: displayEnd,
                              currentStart: displayStart,
                              currentEnd: displayEnd,
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="absolute right-0 top-0 h-full w-3 cursor-ew-resize"
                          disabled={!canEdit}
                          onMouseDown={(event) => {
                            if (!canEdit) return;
                            event.preventDefault();
                            setDragState({
                              taskId: task.id,
                              type: 'resize-right',
                              startX: event.clientX,
                              originalStart: displayStart,
                              originalEnd: displayEnd,
                              currentStart: displayStart,
                              currentEnd: displayEnd,
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Footer: Dependency editor */}
      <footer className="flex-shrink-0 h-16 border-t border-border flex items-center justify-between px-6 bg-card">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">Dependency editor (FS)</span>
          <div className="relative">
            <select
              className="appearance-none bg-muted border border-input text-foreground text-sm rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer min-w-[200px]"
              value={dependencyEditorTaskId}
              onChange={(e) => setDependencyEditorTaskId(e.target.value)}
            >
              <option value="">Select successor task</option>
              {displayTasks.map(({ task }) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-1.5 px-4 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!canEdit || !dependencyEditorTaskId}
          onClick={() => {
            if (!dependencyEditorTaskId) return;
            const predecessorCandidates = displayTasks
              .map((entry) => entry.task.id)
              .filter((id) => id !== dependencyEditorTaskId)
              .slice(0, 1);
            setTaskDependencies.mutate({
              successorTaskId: dependencyEditorTaskId,
              predecessorTaskIds: predecessorCandidates,
              type: 'FS',
            });
          }}
        >
          <Zap className="size-4" />
          Set first available predecessor
        </button>
      </footer>

      {displayTasks.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6">
          Add tasks with dates to render timeline bars.
        </div>
      )}
    </div>
  );
}
