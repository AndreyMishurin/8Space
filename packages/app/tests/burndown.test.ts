import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBurndownFromTasks,
  getTaskCompletionDate,
  type TaskForBurndown,
} from '../src/lib/burndown.js';

const COL_DONE = 'col-done';
const COL_TODO = 'col-todo';

function task(
  overrides: Partial<TaskForBurndown> & { createdAt: string }
): TaskForBurndown {
  return {
    ...overrides,
    statusColumnId: overrides.statusColumnId ?? COL_TODO,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    completedAt: overrides.completedAt ?? null,
  };
}

test('getTaskCompletionDate returns completedAt when set', () => {
  const t = task({
    createdAt: '2025-03-01T10:00:00Z',
    updatedAt: '2025-03-05T12:00:00Z',
    completedAt: '2025-03-03T14:00:00Z',
    statusColumnId: COL_DONE,
  });
  assert.equal(getTaskCompletionDate(t, true), '2025-03-03T14:00:00Z');
});

test('getTaskCompletionDate returns updatedAt for Done when completedAt missing', () => {
  const t = task({
    createdAt: '2025-03-01T10:00:00Z',
    updatedAt: '2025-03-05T12:00:00Z',
    completedAt: null,
    statusColumnId: COL_DONE,
  });
  assert.equal(getTaskCompletionDate(t, true), '2025-03-05T12:00:00Z');
});

test('getTaskCompletionDate returns null when not done', () => {
  const t = task({
    createdAt: '2025-03-01T10:00:00Z',
    statusColumnId: COL_TODO,
  });
  assert.equal(getTaskCompletionDate(t, false), null);
});

test('computeBurndownFromTasks: empty list yields zero remaining', () => {
  const monthStart = new Date('2025-03-01T00:00:00Z');
  const monthEnd = new Date('2025-03-31T23:59:59Z');
  const doneIds = new Set([COL_DONE]);
  const points = computeBurndownFromTasks([], doneIds, monthStart, monthEnd);
  assert.ok(points.length > 0);
  points.forEach((p) => {
    assert.equal(p.actual, 0);
    assert.equal(p.planned, 0);
  });
});

test('computeBurndownFromTasks: one open task keeps actual at 1 for month', () => {
  const monthStart = new Date('2025-03-01T00:00:00Z');
  const monthEnd = new Date('2025-03-31T23:59:59Z');
  const doneIds = new Set([COL_DONE]);
  const tasks: TaskForBurndown[] = [
    task({ createdAt: '2025-02-15T00:00:00Z', statusColumnId: COL_TODO }),
  ];
  const points = computeBurndownFromTasks(tasks, doneIds, monthStart, monthEnd);
  assert.ok(points.length > 0);
  points.forEach((p) => {
    assert.equal(p.actual, 1);
  });
  assert.equal(points[0].planned, 1);
});

test('computeBurndownFromTasks: one closed task yields actual 0 from completion day', () => {
  const monthStart = new Date('2025-03-01T00:00:00Z');
  const monthEnd = new Date('2025-03-31T23:59:59Z');
  const doneIds = new Set([COL_DONE]);
  const tasks: TaskForBurndown[] = [
    task({
      createdAt: '2025-02-15T00:00:00Z',
      statusColumnId: COL_DONE,
      completedAt: '2025-03-05T12:00:00Z',
      updatedAt: '2025-03-05T12:00:00Z',
    }),
  ];
  const points = computeBurndownFromTasks(tasks, doneIds, monthStart, monthEnd);
  const march5Index = points.findIndex((p) => p.dayLabel === '03-05');
  assert.ok(march5Index >= 0);
  for (let i = 0; i < march5Index; i++) {
    assert.equal(points[i].actual, 1);
  }
  for (let i = march5Index; i < points.length; i++) {
    assert.equal(points[i].actual, 0);
  }
});

test('computeBurndownFromTasks: several tasks closed on different days', () => {
  const monthStart = new Date('2025-03-01T00:00:00Z');
  const monthEnd = new Date('2025-03-31T23:59:59Z');
  const doneIds = new Set([COL_DONE]);
  const tasks: TaskForBurndown[] = [
    task({
      createdAt: '2025-02-01T00:00:00Z',
      statusColumnId: COL_DONE,
      completedAt: '2025-03-02T00:00:00Z',
      updatedAt: '2025-03-02T00:00:00Z',
    }),
    task({
      createdAt: '2025-02-01T00:00:00Z',
      statusColumnId: COL_DONE,
      completedAt: '2025-03-05T00:00:00Z',
      updatedAt: '2025-03-05T00:00:00Z',
    }),
    task({
      createdAt: '2025-02-01T00:00:00Z',
      statusColumnId: COL_TODO,
    }),
  ];
  const points = computeBurndownFromTasks(tasks, doneIds, monthStart, monthEnd);
  const day2 = points.find((p) => p.dayLabel === '03-02')!;
  const day5 = points.find((p) => p.dayLabel === '03-05')!;
  const day6 = points.find((p) => p.dayLabel === '03-06')!;
  assert.equal(day2.actual, 2);
  assert.equal(day5.actual, 1);
  assert.equal(day6.actual, 1);
});

test('computeBurndownFromTasks: task created mid-month enters scope on that day', () => {
  const monthStart = new Date('2025-03-01T00:00:00Z');
  const monthEnd = new Date('2025-03-31T23:59:59Z');
  const doneIds = new Set([COL_DONE]);
  const tasks: TaskForBurndown[] = [
    task({ createdAt: '2025-03-15T12:00:00Z', statusColumnId: COL_TODO }),
  ];
  const points = computeBurndownFromTasks(tasks, doneIds, monthStart, monthEnd);
  const day14 = points.find((p) => p.dayLabel === '03-14')!;
  const day15 = points.find((p) => p.dayLabel === '03-15')!;
  const day16 = points.find((p) => p.dayLabel === '03-16')!;
  assert.equal(day14.actual, 0);
  assert.equal(day15.actual, 1);
  assert.equal(day16.actual, 1);
});

test('computeBurndownFromTasks: task without completedAt but status Done uses updatedAt', () => {
  const monthStart = new Date('2025-03-01T00:00:00Z');
  const monthEnd = new Date('2025-03-31T23:59:59Z');
  const doneIds = new Set([COL_DONE]);
  const tasks: TaskForBurndown[] = [
    task({
      createdAt: '2025-02-01T00:00:00Z',
      statusColumnId: COL_DONE,
      completedAt: null,
      updatedAt: '2025-03-10T00:00:00Z',
    }),
  ];
  const points = computeBurndownFromTasks(tasks, doneIds, monthStart, monthEnd);
  const day9 = points.find((p) => p.dayLabel === '03-09')!;
  const day10 = points.find((p) => p.dayLabel === '03-10')!;
  assert.equal(day9.actual, 1);
  assert.equal(day10.actual, 0);
});

test('computeBurndownFromTasks: task created and closed same day counts correctly', () => {
  const monthStart = new Date('2025-03-01T00:00:00Z');
  const monthEnd = new Date('2025-03-31T23:59:59Z');
  const doneIds = new Set([COL_DONE]);
  const tasks: TaskForBurndown[] = [
    task({
      createdAt: '2025-03-12T08:00:00Z',
      statusColumnId: COL_DONE,
      completedAt: '2025-03-12T18:00:00Z',
      updatedAt: '2025-03-12T18:00:00Z',
    }),
  ];
  const points = computeBurndownFromTasks(tasks, doneIds, monthStart, monthEnd);
  const day12 = points.find((p) => p.dayLabel === '03-12')!;
  assert.equal(day12.actual, 0);
  const day11 = points.find((p) => p.dayLabel === '03-11')!;
  assert.equal(day11.actual, 0);
});
