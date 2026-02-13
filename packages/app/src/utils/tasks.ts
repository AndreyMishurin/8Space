import { addDays, endOfWeek, format, isWithinInterval, parseISO, startOfWeek } from 'date-fns';
import type { Task, WorkflowColumn } from '@/domain/types';

export function isTaskOverdue(task: Task): boolean {
  if (!task.dueDate || task.completedAt) {
    return false;
  }

  const due = parseISO(task.dueDate);
  const today = new Date();
  return due < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function taskDisplayStart(task: Task): Date | null {
  if (task.startDate) {
    return parseISO(task.startDate);
  }

  if (task.dueDate) {
    return addDays(parseISO(task.dueDate), -1);
  }

  return parseISO(task.createdAt);
}

export function taskDisplayEnd(task: Task): Date | null {
  if (task.dueDate) {
    return parseISO(task.dueDate);
  }

  if (task.startDate) {
    return parseISO(task.startDate);
  }

  return addDays(parseISO(task.createdAt), 1);
}

export function dueFilterMatch(task: Task, dueFilter: 'all' | 'overdue' | 'this_week' | 'no_due'): boolean {
  if (dueFilter === 'all') {
    return true;
  }

  if (dueFilter === 'no_due') {
    return !task.dueDate;
  }

  if (!task.dueDate) {
    return false;
  }

  const due = parseISO(task.dueDate);
  const today = new Date();

  if (dueFilter === 'overdue') {
    return isTaskOverdue(task);
  }

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  return isWithinInterval(due, { start: weekStart, end: weekEnd });
}

export function sortTasksByRank(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.orderRank - b.orderRank);
}

export function nextOrderRank(tasks: Task[]): number {
  const maxRank = tasks.reduce((max, task) => Math.max(max, task.orderRank), 0);
  return maxRank + 1000;
}

export function nextOrderRankInColumn(tasks: Task[], columnId: string): number {
  const columnTasks = tasks.filter((task) => task.statusColumnId === columnId);
  return nextOrderRank(columnTasks);
}

export function buildStatusLookup(columns: WorkflowColumn[]): Record<string, WorkflowColumn> {
  return columns.reduce<Record<string, WorkflowColumn>>((acc, column) => {
    acc[column.id] = column;
    return acc;
  }, {});
}

export function formatAssigneeList(task: Task): string {
  if (task.assignees.length === 0) {
    return 'Unassigned';
  }

  return task.assignees.map((assignee) => assignee.displayName).join(', ');
}

export function taskDueWeekKey(task: Task): string {
  if (!task.dueDate) {
    return 'No due date';
  }

  const due = parseISO(task.dueDate);
  return `Week of ${format(startOfWeek(due, { weekStartsOn: 1 }), 'MMM d')}`;
}
