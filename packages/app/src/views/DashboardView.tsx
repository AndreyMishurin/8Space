import { useMemo, useState } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { AlertTriangle, CalendarCheck2, CheckCheck, Gauge, TrendingDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics';
import { useTasks, useWorkflowColumns } from '@/hooks/use-project-data';
import { ErrorScreen } from '@/components/ErrorScreen';
import { getErrorMessage } from '@/lib/errors';
import { computeBurndownFromTasks } from '@/lib/burndown';
import { BurndownChart, type BurndownPoint } from '@/components/charts/BurndownChart';

interface DashboardViewProps {
  tenantSlug: string;
  projectId: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}

function MetricCard({ title, value, icon: Icon, hint }: MetricCardProps) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="size-4 text-accent-lime" />
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DashboardView({ tenantSlug: _tenantSlug, projectId }: DashboardViewProps) {
  const [daysWindow, setDaysWindow] = useState<7 | 14>(14);
  const metricsQuery = useDashboardMetrics(projectId, daysWindow);
  const tasksQuery = useTasks(projectId);
  const columnsQuery = useWorkflowColumns(projectId);

  const metrics = metricsQuery.data;

  const tasksByStatus = useMemo(() => {
    if (!metrics) return [];

    return [
      { key: 'todo', label: 'To Do', value: metrics.tasksByStatus.todo ?? 0 },
      { key: 'in_progress', label: 'In Progress', value: metrics.tasksByStatus.in_progress ?? 0 },
      { key: 'done', label: 'Done', value: metrics.tasksByStatus.done ?? 0 },
      { key: 'backlog', label: 'Backlog', value: metrics.tasksByStatus.backlog ?? 0 },
    ];
  }, [metrics]);

  const burndownData = useMemo((): BurndownPoint[] => {
    const taskList = tasksQuery.data ?? [];
    const columns = columnsQuery.data ?? [];
    const doneColumnIds = new Set(columns.filter((c) => c.kind === 'done').map((c) => c.id));
    if (columns.length === 0) return [];

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return computeBurndownFromTasks(taskList, doneColumnIds, monthStart, monthEnd);
  }, [tasksQuery.data, columnsQuery.data]);

  if (metricsQuery.isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <Spinner variant="infinite" size={40} />
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  if (metricsQuery.isError) {
    return (
      <ErrorScreen
        variant="inline"
        code={500}
        message={getErrorMessage(metricsQuery.error)}
        onRetry={() => metricsQuery.refetch()}
        showGoHome={false}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Planner-style metrics for execution health and delivery pace.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={daysWindow === 7 ? 'default' : 'outline'} size="sm" onClick={() => setDaysWindow(7)}>
            7 days
          </Button>
          <Button variant={daysWindow === 14 ? 'default' : 'outline'} size="sm" onClick={() => setDaysWindow(14)}>
            14 days
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Overdue tasks"
          value={metrics?.overdueCount ?? 0}
          icon={AlertTriangle}
          hint="Tasks past due date and not done"
        />
        <MetricCard
          title="Due this week"
          value={metrics?.dueThisWeek ?? 0}
          icon={CalendarCheck2}
          hint="Planned to finish in the next 7 days"
        />
        <MetricCard
          title="In progress"
          value={metrics?.tasksByStatus.in_progress ?? 0}
          icon={Gauge}
          hint="Currently being executed"
        />
        <MetricCard
          title="Done"
          value={metrics?.tasksByStatus.done ?? 0}
          icon={CheckCheck}
          hint="Completed work items"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 widget-container">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="size-4 text-accent-lime" />
              Burndown
            </h3>
            <span className="text-xs text-muted-foreground">Current month</span>
          </div>
          <div className="p-4">
            <BurndownChart data={burndownData} />
          </div>
        </div>

        <div className="widget-container">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4 text-accent-lime" />
              Workload by assignee
            </h3>
            <span className="text-xs text-muted-foreground">Active tasks</span>
          </div>
          <div className="p-4 space-y-3">
            {(metrics?.workloadByAssignee ?? []).map((item) => (
              <div key={item.userId} className="flex items-center justify-between text-sm">
                <span>{item.displayName}</span>
                <span className="text-muted-foreground">{item.activeCount}</span>
              </div>
            ))}
            {(metrics?.workloadByAssignee ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No active assignee load.</p>
            )}
          </div>
        </div>
      </div>

      <div className="widget-container">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Tasks by status</h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          {tasksByStatus.map((item) => (
            <div key={item.key} className="rounded-lg border border-border p-3 bg-background">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="text-2xl mt-1 font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
