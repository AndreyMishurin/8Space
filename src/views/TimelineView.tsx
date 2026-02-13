import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameMonth,
  subDays,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMoveTask, useProject, useSetTaskDependencies, useTaskDependencies, useTasks, useUpdateTaskInline } from '@/hooks/use-project-data';
import { sortTasksByRank, taskDisplayEnd, taskDisplayStart } from '@/utils/tasks';
import type { Task } from '@/domain/types';
import { cn } from '@/lib/utils';

interface TimelineViewProps {
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

export function TimelineView({ projectId }: TimelineViewProps) {
  const project = useProject(projectId);
  const tasksQuery = useTasks(projectId);
  const dependenciesQuery = useTaskDependencies(projectId);

  const updateTask = useUpdateTaskInline(projectId);
  const moveTask = useMoveTask(projectId);
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
        const fromY = predecessorIndex * 42 + 21;

        const toX = differenceInCalendarDays(successor.displayStart, timelineRange.start) * cellWidth;
        const toY = successorIndex * 42 + 21;

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

  return (
    <div className="h-full p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Timeline</h2>
          <p className="text-sm text-muted-foreground">
            Week/month scale, milestones and FS dependencies with conflict highlighting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={scale === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setScale('week')}>
            Week
          </Button>
          <Button variant={scale === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setScale('month')}>
            Month
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[320px_1fr] border border-border rounded-lg overflow-hidden h-[calc(100%-120px)] bg-card">
        <div className="border-r border-border flex flex-col">
          <div className="h-[70px] border-b border-border px-4 grid grid-cols-[1fr_100px] items-center text-xs uppercase tracking-wide text-muted-foreground">
            <span>Task</span>
            <span>Due</span>
          </div>
          <div className="flex-1 overflow-auto">
            {displayTasks.map(({ task, conflict }) => (
              <div key={task.id} className={cn('h-[42px] px-4 grid grid-cols-[1fr_100px] items-center border-b border-border text-sm')}>
                <span className={cn('truncate', conflict && 'text-error')}>{task.title}</span>
                <span className="text-xs text-muted-foreground">{task.dueDate ?? '—'}</span>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border space-y-2">
            <p className="text-xs text-muted-foreground">Dependency editor (FS)</p>
            <select
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
              value={dependencyEditorTaskId}
              onChange={(event) => setDependencyEditorTaskId(event.target.value)}
            >
              <option value="">Select successor task</option>
              {displayTasks.map(({ task }) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="w-full"
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
              Set first available predecessor
            </Button>
          </div>
        </div>

        <div className="overflow-auto relative">
          <div className="min-w-max">
            <div className="h-[30px] flex border-b border-border bg-muted/40 sticky top-0 z-20">
              {monthHeaders.map((header) => (
                <div
                  key={header.label + header.width}
                  className="border-r border-border text-xs font-medium px-2 flex items-center"
                  style={{ width: header.width }}
                >
                  {header.label}
                </div>
              ))}
            </div>

            <div className="h-[40px] flex border-b border-border bg-muted/20 sticky top-[30px] z-20">
              {dates.map((date) => (
                <div
                  key={date.toISOString()}
                  className="border-r border-border text-[11px] text-center flex flex-col items-center justify-center"
                  style={{ width: cellWidth }}
                >
                  <span className="font-medium">{format(date, 'd')}</span>
                  <span className="text-muted-foreground">{format(date, 'EE')}</span>
                </div>
              ))}
            </div>

            <div className="relative">
              <svg
                className="absolute inset-0 pointer-events-none z-10"
                width={dates.length * cellWidth}
                height={displayTasks.length * 42}
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
                const rowTop = index * 42;

                const activeDrag = dragState?.taskId === task.id;
                const renderStart = activeDrag ? dragState.currentStart : displayStart;
                const renderEnd = activeDrag ? dragState.currentEnd : displayEnd;
                const renderLeft = differenceInCalendarDays(renderStart, timelineRange.start) * cellWidth;
                const renderWidth = Math.max(
                  (differenceInCalendarDays(renderEnd, renderStart) + 1) * cellWidth,
                  task.isMilestone ? 8 : cellWidth
                );

                return (
                  <div key={task.id} className="h-[42px] border-b border-border relative" style={{ top: rowTop }}>
                    <div className="absolute inset-0 flex">
                      {dates.map((date) => (
                        <div key={date.toISOString() + task.id} className="border-r border-border" style={{ width: cellWidth }} />
                      ))}
                    </div>

                    {task.isMilestone ? (
                      <button
                        type="button"
                        className="absolute top-1/2 -translate-y-1/2 rotate-45 bg-milestone-yellow border border-border z-20"
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
                          'absolute top-1/2 -translate-y-1/2 rounded-md bg-accent-lime z-20 shadow-sm overflow-hidden',
                          conflict && 'ring-2 ring-error'
                        )}
                        style={{
                          left: renderLeft,
                          width: renderWidth,
                          height: 16,
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

      {displayTasks.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6">
          Add tasks with dates to render timeline bars.
        </div>
      )}
    </div>
  );
}
