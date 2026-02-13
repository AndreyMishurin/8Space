import { useMemo, useState } from 'react';
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
import { ListFilter, Plus, Trash2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';

interface BacklogViewProps {
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

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'grid grid-cols-[minmax(280px,1.6fr)_160px_170px_130px_170px_56px] gap-3 items-center p-3 border-b border-border bg-card',
        isDragging && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn('cursor-grab text-muted-foreground', !draggable && 'opacity-30 cursor-not-allowed')}
          {...attributes}
          {...listeners}
          disabled={!draggable}
          title={draggable ? 'Drag to reorder' : 'Disable filters/grouping to reorder'}
        >
          ⋮⋮
        </button>
        <Input
          value={task.title}
          onChange={(event) => onTitleChange(task, event.target.value)}
          disabled={!canEdit}
          className="h-9"
        />
      </div>

      <Select
        value={task.assignees[0]?.id ?? 'none'}
        onValueChange={(value) => onAssigneeChange(task, value)}
        disabled={!canEdit}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Assignee" />
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

      <Input
        type="date"
        value={task.dueDate ?? ''}
        onChange={(event) => onDueDateChange(task, event.target.value || null)}
        disabled={!canEdit}
        className="h-9"
      />

      <Select value={task.priority} onValueChange={(value) => onPriorityChange(task, value as 'p0' | 'p1' | 'p2')} disabled={!canEdit}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p0">P0</SelectItem>
          <SelectItem value="p1">P1</SelectItem>
          <SelectItem value="p2">P2</SelectItem>
        </SelectContent>
      </Select>

      <Select value={task.statusColumnId} onValueChange={(value) => onStatusChange(task, value)} disabled={!canEdit}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columnOptions.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center justify-center">
        {canEdit ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(task)}
            title="Delete task"
            type="button"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

export function BacklogView({ projectId }: BacklogViewProps) {
  const project = useProject(projectId);
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

  return (
    <div className="h-full p-6 space-y-4 overflow-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Backlog</h2>
          <p className="text-sm text-muted-foreground">
            Add tasks quickly with required start/due dates and edit fields inline.
          </p>
        </div>
        {!canEdit && <p className="text-sm text-warning">Viewer role: editing is disabled.</p>}
      </div>

      <div className="border border-border rounded-lg bg-card p-3 grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_160px_160px_auto] gap-2 items-center">
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
          className="h-10"
        />
        <Input
          type="date"
          value={quickStartDate}
          onChange={(event) => setQuickStartDate(event.target.value)}
          className="h-10"
          aria-label="Start date"
        />
        <Input
          type="date"
          value={quickDueDate}
          onChange={(event) => setQuickDueDate(event.target.value)}
          className="h-10"
          aria-label="Due date"
        />
        <Button onClick={() => void handleCreateTask()} disabled={!canEdit || !quickTitle.trim() || !quickStartDate || !quickDueDate}>
          <Plus className="size-4" />
          Add task
        </Button>
      </div>
      {createError && <p className="text-sm text-error">{createError}</p>}

      <div className="grid grid-cols-5 gap-3 items-center border border-border rounded-lg p-3 bg-card">
        <div className="col-span-5 md:col-span-1 flex items-center gap-2 text-sm text-muted-foreground">
          <ListFilter className="size-4" /> Filters
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9">
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
          <SelectTrigger className="h-9">
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
          <SelectTrigger className="h-9">
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
          <SelectTrigger className="h-9">
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
          <SelectTrigger className="h-9">
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

      <div className="border border-border rounded-lg overflow-x-auto">
        <div className="min-w-[1020px]">
          <div className="grid grid-cols-[minmax(280px,1.6fr)_160px_170px_130px_170px_56px] gap-3 p-3 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Task</span>
            <span>Assignee</span>
            <span>Due date</span>
            <span>Priority</span>
            <span>Status</span>
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
