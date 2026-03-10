import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import {
  useDeleteTask,
  useMoveTask,
  useProject,
  useReorderTasks,
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
const TASKS_PANEL_WIDTH = 250;
const TASKS_PANEL_COLLAPSED_WIDTH = 48;

interface SortableTimelineRowProps {
  item: DisplayTask;
  dates: Date[];
  timelineRange: { start: Date; end: Date };
  cellWidth: number;
  dragState: DragState | null;
  setDragState: (s: DragState | null) => void;
  canEdit: boolean;
  deleteTask: (taskId: string) => void;
  tasksPanelCollapsed: boolean;
}

function SortableTimelineRow({
  item,
  dates,
  timelineRange,
  cellWidth,
  dragState,
  setDragState,
  canEdit,
  deleteTask,
  tasksPanelCollapsed,
}: SortableTimelineRowProps) {
  const { task, displayStart, displayEnd, conflict } = item;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canEdit,
  });

  const activeDrag = dragState?.taskId === task.id;
  const renderStart = activeDrag ? dragState.currentStart : displayStart;
  const renderEnd = activeDrag ? dragState.currentEnd : displayEnd;
  const renderLeft = differenceInCalendarDays(renderStart, timelineRange.start) * cellWidth;
  const renderWidth = Math.max(
    (differenceInCalendarDays(renderEnd, renderStart) + 1) * cellWidth,
    task.isMilestone ? 8 : cellWidth
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex h-12 border-b border-border/50 shrink-0 bg-card',
        isDragging && 'opacity-80 z-30'
      )}
    >
      {/* Left cell: drag handle + task info (sticky when scrolling timeline) */}
      <div
        className={cn(
          'border-r border-border/50 flex items-center shrink-0 bg-card sticky left-0 z-10',
          tasksPanelCollapsed ? 'w-12 justify-center' : 'px-2'
        )}
        style={{ width: tasksPanelCollapsed ? TASKS_PANEL_COLLAPSED_WIDTH : TASKS_PANEL_WIDTH }}
      >
        {canEdit && (
          <button
            type="button"
            className={cn(
              'cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none',
              !tasksPanelCollapsed && 'mr-2'
            )}
            {...attributes}
            {...listeners}
            title="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        {!tasksPanelCollapsed && (
          <>
            <div className="flex-1 min-w-0 grid grid-cols-[1fr_90px] gap-2 items-center">
              <span className={cn('text-sm truncate hover:text-orange-500 transition-colors', conflict && 'text-destructive')}>
                {task.title}
              </span>
              <span className="text-xs text-muted-foreground text-right">
                {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '—'}
              </span>
            </div>
            {canEdit && (
              <button
                type="button"
                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete «${task.title}»?`)) deleteTask(task.id);
                }}
                title="Delete task"
              >
                ×
              </button>
            )}
          </>
        )}
      </div>

      {/* Right cell: timeline bar row */}
      <div className="flex-1 min-w-max relative h-12">
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
            style={{ left: renderLeft, width: 12, height: 12 }}
            disabled={!canEdit}
            onMouseDown={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              setDragState({
                taskId: task.id,
                type: 'move',
                startX: e.clientX,
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
              'absolute top-1/2 -translate-y-1/2 rounded-md bg-orange-500 border border-orange-600 hover:bg-orange-600 z-20 shadow-md overflow-hidden gantt-task-bar cursor-pointer flex items-center',
              conflict && 'ring-2 ring-destructive'
            )}
            style={{ left: renderLeft, width: renderWidth, height: 24 }}
            title={task.title}
          >
            {renderWidth > 56 && (
              <span className="absolute inset-0 px-2 flex items-center text-xs font-medium text-white truncate pointer-events-none">
                {task.title}
              </span>
            )}
            <button
              type="button"
              className="absolute inset-0 cursor-grab"
              disabled={!canEdit}
              onMouseDown={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragState({
                  taskId: task.id,
                  type: 'move',
                  startX: e.clientX,
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
              onMouseDown={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragState({
                  taskId: task.id,
                  type: 'resize-left',
                  startX: e.clientX,
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
              onMouseDown={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragState({
                  taskId: task.id,
                  type: 'resize-right',
                  startX: e.clientX,
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
    </div>
  );
}

export function TimelineView({ tenantSlug, projectId }: TimelineViewProps) {
  const project = useProject(projectId, tenantSlug);
  const tasksQuery = useTasks(projectId);
  const dependenciesQuery = useTaskDependencies(projectId);

  const updateTask = useUpdateTaskInline(projectId);
  const moveTask = useMoveTask(projectId);
  const reorderTasks = useReorderTasks(projectId);
  const deleteTask = useDeleteTask(projectId);
  const [scale, setScale] = useState<Scale>('week');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [tasksPanelCollapsed, setTasksPanelCollapsed] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  const handleReorderEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const displayIds = displayTasks.map((d) => d.task.id);
    const oldIndex = displayIds.indexOf(String(active.id));
    const newIndex = displayIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newDisplayOrder = arrayMove(displayIds, oldIndex, newIndex);
    const allIds = tasks.map((t) => t.id);
    const displaySet = new Set(displayIds);
    const newOrder: string[] = [];
    let i = 0;
    for (const id of allIds) {
      if (displaySet.has(id)) {
        newOrder.push(newDisplayOrder[i++]);
      } else {
        newOrder.push(id);
      }
    }
    reorderTasks.mutate(newOrder);
  };

  const monthHeaders = useMemo(() => {
    if (dates.length === 0) {
      return [];
    }

    const chunks: Array<{ label: string; width: number }> = [];
    let currentStart = dates[0];
    let width = 0;

    for (const day of dates) {
      if (!isSameMonth(day, currentStart)) {
        const label =
          width >= 80 ? format(currentStart, 'MMMM yyyy') : format(currentStart, 'MMM yyyy');
        chunks.push({ label, width });
        currentStart = day;
        width = 0;
      }
      width += cellWidth;
    }

    const lastLabel =
      width >= 80 ? format(currentStart, 'MMMM yyyy') : format(currentStart, 'MMM yyyy');
    chunks.push({ label: lastLabel, width });

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
        <div className="flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-card flex flex-col">
          {/* Single scroll: header + unified rows */}
          <div className="flex-1 overflow-auto min-h-0">
            <div className="relative min-w-max flex flex-col">
              {/* Header row: left (Task | Due + collapse) + right (month | day) */}
              <div className="flex border-b border-border shrink-0 bg-muted/30">
                <div
                  className="h-14 border-r border-border flex items-center bg-muted/30 sticky left-0 z-20 shrink-0"
                  style={{ width: tasksPanelCollapsed ? TASKS_PANEL_COLLAPSED_WIDTH : TASKS_PANEL_WIDTH }}
                >
                  {tasksPanelCollapsed ? (
                    <button
                      type="button"
                      className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onClick={() => setTasksPanelCollapsed(false)}
                      title="Expand task list"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  ) : (
                    <>
                      <div className="flex-1 grid grid-cols-[1fr_90px] gap-2 items-center px-4">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task</span>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Due date</span>
                      </div>
                      <button
                        type="button"
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                        onClick={() => setTasksPanelCollapsed(true)}
                        title="Collapse task list"
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                    </>
                  )}
                </div>
                <div className="min-w-max flex flex-col shrink-0">
                  <div className="h-7 flex border-b border-border bg-muted/40">
                    {monthHeaders.map((header) => (
                      <div
                        key={header.label + header.width}
                        className="border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2 pr-2 flex items-center min-w-0 overflow-hidden"
                        style={{ width: header.width }}
                      >
                        <span className="truncate">{header.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="h-7 flex border-b border-border bg-muted/20">
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
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorderEnd}>
                <SortableContext items={displayTasks.map((d) => d.task.id)} strategy={verticalListSortingStrategy}>
                  <div className="relative flex flex-col">
                  <svg
                    className="absolute pointer-events-none z-10"
                    style={{ left: tasksPanelCollapsed ? TASKS_PANEL_COLLAPSED_WIDTH : TASKS_PANEL_WIDTH, top: 0 }}
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

                  {displayTasks.map((item) => (
                    <SortableTimelineRow
                      key={item.task.id}
                      item={item}
                      dates={dates}
                      timelineRange={timelineRange}
                      cellWidth={cellWidth}
                      dragState={dragState}
                      setDragState={setDragState}
                      canEdit={canEdit}
                      deleteTask={deleteTask.mutate}
                      tasksPanelCollapsed={tasksPanelCollapsed}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
