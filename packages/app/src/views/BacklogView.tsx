import { useMemo, useState, useRef, useEffect } from 'react';
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
import { Calendar, Check, Circle, GripVertical, ListFilter, Loader2, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addDays, format } from 'date-fns';
import type { ProjectMember, Task } from '@/domain/types';
import {
  useCreateTask,
  useDeleteTask,
  useProject,
  useProjectMembers,
  useReorderTasks,
  useTasks,
  useUpdateTaskInline,
  useWorkflowColumns,
} from '@/hooks/use-project-data';
import { dueFilterMatch, nextOrderRank, sortTasksByRank, taskDueWeekKey } from '@/utils/tasks';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { ErrorScreen } from '@/components/ErrorScreen';

interface BacklogViewProps {
  tenantSlug: string;
  projectId: string;
}

type GroupBy = 'none' | 'assignee' | 'tag' | 'due_week';
type DueFilter = 'all' | 'overdue' | 'this_week' | 'no_due';

interface SortableTaskRowProps {
  task: Task;
  canEdit: boolean;
  members: ProjectMember[];
  columnOptions: Array<{ id: string; name: string }>;
  onTitleChange: (task: Task, value: string) => void;
  onAssigneeChange: (task: Task, assigneeId: string) => void;
  onDueDateChange: (task: Task, dueDate: string | null) => void;
  onPriorityChange: (task: Task, priority: 'p0' | 'p1' | 'p2') => void;
  onStatusChange: (task: Task, statusColumnId: string) => void;
  onDelete: (task: Task) => void;
  draggable: boolean;
}

function SortableTaskRow({
  task,
  canEdit,
  members,
  columnOptions,
  onTitleChange,
  onAssigneeChange,
  onDueDateChange,
  onPriorityChange,
  onStatusChange,
  onDelete,
  draggable,
}: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentStatusName = columnOptions.find((c) => c.id === task.statusColumnId)?.name ?? '';
  const isDone = currentStatusName.toLowerCase().includes('done');
  const isInProgress = currentStatusName.toLowerCase().includes('progress') || currentStatusName.toLowerCase().includes('process');
  const statusIcon = isDone ? (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400">
      <Check className="size-2.5" />
    </span>
  ) : isInProgress ? (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Loader2 className="size-2.5 animate-spin" />
    </span>
  ) : (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Circle className="size-2.5" />
    </span>
  );
  const statusTriggerClass = isDone
    ? 'min-h-8 h-8 min-w-[5rem] gap-1.5 rounded-md border border-green-500/30 bg-green-500/20 text-green-400 px-2.5 py-1.5 whitespace-nowrap'
    : 'min-h-8 h-8 min-w-[7.5rem] gap-1.5 rounded-md border border-border bg-muted text-muted-foreground px-2.5 py-1.5 whitespace-nowrap';

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuOpen]);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'grid grid-cols-[32px_32px_minmax(200px,1.6fr)_150px_150px_120px_140px_44px] items-center border-b border-border bg-background hover:bg-muted/20 transition-colors group',
        isDragging && 'opacity-70'
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className={cn(
          'flex items-center justify-center h-full text-muted-foreground/30 group-hover:text-muted-foreground transition-colors',
          !draggable && 'opacity-20 cursor-not-allowed',
          draggable && 'cursor-grab'
        )}
        {...attributes}
        {...listeners}
        disabled={!draggable}
        title={draggable ? 'Drag to reorder' : 'Disable filters/grouping to reorder'}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Checkbox (visual) */}
      <div className="flex items-center justify-center h-full">
        <div className="size-4 rounded border border-border bg-transparent" />
      </div>

      {/* Title */}
      <div className="flex items-center py-2.5 pr-2">
        <Input
          value={task.title}
          onChange={(event) => onTitleChange(task, event.target.value)}
          disabled={!canEdit}
          className="h-8 border-0 bg-transparent px-0 text-sm font-medium text-foreground shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
        />
      </div>

      {/* Assignee */}
      <Select
        value={task.assignees[0]?.id ?? 'none'}
        onValueChange={(value) => onAssigneeChange(task, value)}
        disabled={!canEdit}
      >
        <SelectTrigger className="h-8 border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none focus:ring-0 focus-visible:ring-0 hover:bg-muted/40 rounded-md transition-colors">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassigned</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.userId} value={member.userId}>
              {member.profile?.displayName ?? member.userId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Due date - archive: text + calendar icon */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={task.dueDate ?? ''}
          onChange={(event) => onDueDateChange(task, event.target.value || null)}
          disabled={!canEdit}
          className="h-8 w-28 border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
        />
        <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground" aria-hidden>
          <Calendar className="size-3.5" />
        </span>
      </div>

      {/* Priority pill - archive style */}
      <Select value={task.priority} onValueChange={(value) => onPriorityChange(task, value as 'p0' | 'p1' | 'p2')} disabled={!canEdit}>
        <SelectTrigger className="h-7 w-16 gap-1 rounded-md border border-border bg-muted px-2.5 text-xs text-muted-foreground shadow-none focus:ring-0 focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p0">P0</SelectItem>
          <SelectItem value="p1">P1</SelectItem>
          <SelectItem value="p2">P2</SelectItem>
        </SelectContent>
      </Select>

      {/* Status pill - archive style: Done green, In Progress spinner, default Circle */}
      <Select value={task.statusColumnId} onValueChange={(value) => onStatusChange(task, value)} disabled={!canEdit}>
        <SelectTrigger className={cn('text-xs font-medium leading-normal shadow-none focus:ring-0 focus-visible:ring-0 [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:[line-clamp:unset]', statusTriggerClass)}>
          <span className="flex items-center gap-1.5 min-w-0 shrink">
            {statusIcon}
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {columnOptions.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Actions */}
      <div className="relative flex items-center justify-center" ref={menuRef}>
        {canEdit ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground/40 hover:text-muted-foreground group-hover:text-muted-foreground/70 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              title="Actions"
              type="button"
            >
              <MoreVertical className="size-3.5" />
            </Button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-border bg-card py-1 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  Edit
                </button>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  Duplicate
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                  onClick={() => {
                    onDelete(task);
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

export function BacklogView({ tenantSlug, projectId }: BacklogViewProps) {
  const project = useProject(projectId, tenantSlug);
  const columnsQuery = useWorkflowColumns(projectId);
  const tasksQuery = useTasks(projectId);
  const membersQuery = useProjectMembers(projectId);

  const createTask = useCreateTask(projectId);
  const reorderTasks = useReorderTasks(projectId);
  const updateTask = useUpdateTaskInline(projectId);
  const deleteTask = useDeleteTask(projectId);

  const [quickTitle, setQuickTitle] = useState('');
  const [quickStartDate, setQuickStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [quickDueDate, setQuickDueDate] = useState(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [createError, setCreateError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const columns = columnsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const tasks = sortTasksByRank(tasksQuery.data ?? []);

  const backlogColumn = columns.find((column) => column.kind === 'backlog') ?? columns[0];
  const canEdit = project ? project.role !== 'viewer' : false;

  const activeTags = useMemo(() => {
    const tags = new Map<string, string>();
    for (const task of tasks) {
      for (const tag of task.tags) {
        tags.set(tag.id, tag.name);
      }
    }
    return Array.from(tags.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== 'all' && task.statusColumnId !== statusFilter) {
        return false;
      }

      if (assigneeFilter !== 'all') {
        if (!task.assignees.some((assignee) => assignee.id === assigneeFilter)) {
          return false;
        }
      }

      if (!dueFilterMatch(task, dueFilter)) {
        return false;
      }

      if (tagFilter !== 'all' && !task.tags.some((tag) => tag.id === tagFilter)) {
        return false;
      }

      return true;
    });
  }, [assigneeFilter, dueFilter, statusFilter, tagFilter, tasks]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All tasks', tasks: filteredTasks }];
    }

    const bucket = new Map<string, Task[]>();

    for (const task of filteredTasks) {
      let key = 'Uncategorized';

      if (groupBy === 'assignee') {
        key = task.assignees[0]?.displayName ?? 'Unassigned';
      }

      if (groupBy === 'tag') {
        key = task.tags[0]?.name ?? 'No tags';
      }

      if (groupBy === 'due_week') {
        key = taskDueWeekKey(task);
      }

      const current = bucket.get(key) ?? [];
      current.push(task);
      bucket.set(key, current);
    }

    return Array.from(bucket.entries()).map(([key, bucketTasks]) => ({ key, label: key, tasks: bucketTasks }));
  }, [filteredTasks, groupBy]);

  const reorderEnabled =
    canEdit &&
    groupBy === 'none' &&
    statusFilter === 'all' &&
    assigneeFilter === 'all' &&
    dueFilter === 'all' &&
    tagFilter === 'all';

  const handleCreateTask = async () => {
    setCreateError(null);

    if (!canEdit) return;

    if (!backlogColumn) {
      setCreateError('Workflow columns are still loading. Try again in a moment.');
      return;
    }

    if (!quickTitle.trim() || !quickStartDate || !quickDueDate) {
      setCreateError('Title, start date and due date are required.');
      return;
    }

    if (quickDueDate < quickStartDate) {
      setCreateError('Due date must be the same or later than start date.');
      return;
    }

    try {
      await createTask.mutateAsync({
        title: quickTitle.trim(),
        statusColumnId: backlogColumn.id,
        startDate: quickStartDate,
        dueDate: quickDueDate,
        priority: 'p1',
        orderRank: nextOrderRank(tasks),
      });
      setQuickTitle('');
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create task.');
      setCreateError(message);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!reorderEnabled) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const currentIds = filteredTasks.map((task) => task.id);
    const oldIndex = currentIds.indexOf(String(active.id));
    const newIndex = currentIds.indexOf(String(over.id));

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const moved = arrayMove(currentIds, oldIndex, newIndex);
    reorderTasks.mutate(moved);
  };

  const handleTitleChange = (task: Task, title: string) => {
    updateTask.mutate({ taskId: task.id, title });
  };

  const handleAssigneeChange = (task: Task, assigneeId: string) => {
    updateTask.mutate({ taskId: task.id, assigneeIds: assigneeId === 'none' ? [] : [assigneeId] });
  };

  const handleDueDateChange = (task: Task, dueDate: string | null) => {
    updateTask.mutate({ taskId: task.id, dueDate });
  };

  const handlePriorityChange = (task: Task, priority: 'p0' | 'p1' | 'p2') => {
    updateTask.mutate({ taskId: task.id, priority });
  };

  const handleStatusChange = (task: Task, statusColumnId: string) => {
    updateTask.mutate({ taskId: task.id, statusColumnId });
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`Delete task «${task.title}»?`)) return;
    try {
      await deleteTask.mutateAsync(task.id);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete task.');
      setCreateError(message);
    }
  };

  if (columnsQuery.isLoading || tasksQuery.isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <Spinner variant="infinite" size={40} />
        <p className="text-sm text-muted-foreground">Loading backlog…</p>
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
    <div className="flex flex-1 flex-col gap-6 overflow-auto">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Backlog</h2>
        <p className="text-sm text-muted-foreground">
          Add tasks quickly with required start/due dates and edit fields inline.
        </p>
        {!canEdit && <p className="text-sm text-warning">Viewer role: editing is disabled.</p>}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <Input
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreateTask();
              }
            }}
            placeholder="Add task title and press Enter"
            className="flex-1 min-w-0 border-0 bg-transparent text-sm placeholder:text-muted-foreground focus-visible:ring-0"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <label className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5">
              <Calendar className="size-4 shrink-0" />
              <input
                type="date"
                value={quickStartDate}
                onChange={(event) => setQuickStartDate(event.target.value)}
                className="bg-transparent text-sm focus:outline-none"
                aria-label="Start date"
              />
            </label>
            <label className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5">
              <Calendar className="size-4 shrink-0" />
              <input
                type="date"
                value={quickDueDate}
                onChange={(event) => setQuickDueDate(event.target.value)}
                className="bg-transparent text-sm focus:outline-none"
                aria-label="Due date"
              />
            </label>
          </div>
          <Button
            onClick={() => void handleCreateTask()}
            disabled={!canEdit || !quickTitle.trim() || !quickStartDate || !quickDueDate}
            className="gap-2 shrink-0"
          >
            <Plus className="size-4" />
            Add task
          </Button>
        </div>
        {createError && <p className="text-sm text-destructive mt-2">{createError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListFilter className="size-4" />
          <span>Filters</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-auto gap-1.5 border border-border bg-muted/50 px-3 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-8 w-auto gap-1.5 border border-border bg-muted/50 px-3 text-sm">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.profile?.displayName ?? member.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dueFilter} onValueChange={(value) => setDueFilter(value as DueFilter)}>
              <SelectTrigger className="h-8 w-auto gap-1.5 border border-border bg-muted/50 px-3 text-sm">
                <SelectValue placeholder="Due" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any due</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="this_week">This week</SelectItem>
                <SelectItem value="no_due">No due date</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-8 w-auto gap-1.5 border border-border bg-muted/50 px-3 text-sm">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {activeTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
              <SelectTrigger className="h-8 w-auto gap-1.5 border border-border bg-muted/50 px-3 text-sm">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No grouping</SelectItem>
                <SelectItem value="assignee">Group by assignee</SelectItem>
                <SelectItem value="tag">Group by tag</SelectItem>
                <SelectItem value="due_week">Group by due week</SelectItem>
              </SelectContent>
            </Select>
      </div>

      <div className="border border-border rounded-lg overflow-x-auto bg-background">
        <div className="min-w-[900px]">
          {/* Table header */}
          <div className="grid grid-cols-[32px_32px_minmax(200px,1.6fr)_150px_150px_120px_140px_44px] items-center border-b border-border bg-muted/60 px-0">
            <div className="flex items-center justify-center py-2.5">
              <div className="size-4 rounded border border-border bg-transparent" />
            </div>
            <div />
            <span className="py-2.5 pr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Header</span>
            <span className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignee</span>
            <span className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due date</span>
            <span className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</span>
            <span className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
            <span />
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
              {grouped.map((group) => (
                <div key={group.key} className="border-t border-border first:border-t-0">
                  {groupBy !== 'none' && (
                    <div className="px-3 py-2 text-sm bg-muted/20 border-b border-border">{group.label}</div>
                  )}
                  {group.tasks.map((task) => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      canEdit={canEdit}
                      members={members}
                      columnOptions={columns.map((column) => ({ id: column.id, name: column.name }))}
                      onTitleChange={handleTitleChange}
                      onAssigneeChange={handleAssigneeChange}
                      onDueDateChange={handleDueDateChange}
                      onPriorityChange={handlePriorityChange}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      draggable={reorderEnabled}
                    />
                  ))}
                </div>
              ))}
            </SortableContext>
          </DndContext>

          {filteredTasks.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No tasks yet. Add your first task with Enter and continue planning.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
