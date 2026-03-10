import { eachDayOfInterval, endOfDay, format, parseISO } from 'date-fns';

/** One point on the burndown chart (same shape as BurndownChart expects). */
export interface BurndownPoint {
  date: string;
  dayLabel: string;
  planned: number;
  actual: number;
}

/** Minimal task shape needed for burndown calculation. */
export interface TaskForBurndown {
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  statusColumnId: string;
}

/**
 * Resolves the date when the task was completed (for Done tasks).
 * Prefer completedAt; if missing but task is Done, use updatedAt as fallback.
 */
export function getTaskCompletionDate(
  task: TaskForBurndown,
  isDone: boolean
): string | null {
  if (!isDone) {
    return null;
  }
  if (task.completedAt) {
    return task.completedAt;
  }
  return task.updatedAt;
}

/**
 * Computes burndown series from real task list.
 * - X axis: each day of the month (unchanged).
 * - Y axis: remaining unfinished tasks.
 * - Actual: for each day, count tasks that are in scope by end of day and not yet completed.
 * - Planned: linear from totalScope (tasks existing at start of month) to 0.
 *
 * Rules:
 * - Task is in scope from its createdAt (or from start of month if created before).
 * - For each day, in-scope = tasks with createdAt <= end of that day.
 * - Task is completed by day D if Done and (completedAt ?? updatedAt) <= end of day D.
 * - Remaining(day) = in-scope(day) − completed-by-end-of-day(day).
 */
export function computeBurndownFromTasks(
  tasks: TaskForBurndown[],
  doneColumnIds: Set<string>,
  monthStart: Date,
  monthEnd: Date
): BurndownPoint[] {
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const numDays = days.length;

  const totalScopeAtStart = tasks.filter((t) => {
    const created = parseISO(t.createdAt);
    return created.getTime() <= monthStart.getTime();
  }).length;

  return days.map((day, index) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayEnd = endOfDay(day);

    const inScopeCount = tasks.filter((t) => {
      const created = parseISO(t.createdAt);
      return created.getTime() <= dayEnd.getTime();
    }).length;

    const completedByEndOfDay = tasks.filter((t) => {
      const isDone = doneColumnIds.has(t.statusColumnId);
      const completionDate = getTaskCompletionDate(t, isDone);
      if (!completionDate) return false;
      const completed = parseISO(completionDate);
      return completed.getTime() <= dayEnd.getTime();
    }).length;

    const actual = Math.max(0, inScopeCount - completedByEndOfDay);

    const planned =
      numDays <= 1
        ? totalScopeAtStart
        : totalScopeAtStart * (1 - index / (numDays - 1));

    return {
      date: dateStr,
      dayLabel: format(day, 'MM-dd'),
      planned: Math.round(planned * 10) / 10,
      actual,
    };
  });
}
