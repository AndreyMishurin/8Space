import { useQuery } from '@tanstack/react-query';
import type { ProjectMetrics } from '@/domain/types';
import { dashboardRepository } from '@/domain/repositories';
import { queryKeys } from '@/hooks/use-project-data';

export function useDashboardMetrics(projectId: string | undefined, daysWindow = 14) {
  return useQuery<ProjectMetrics>({
    queryKey: queryKeys.metrics(projectId ?? 'no-project', daysWindow),
    queryFn: async () => {
      if (!projectId) {
        return {
          tasksByStatus: {},
          overdueCount: 0,
          dueThisWeek: 0,
          workloadByAssignee: [],
          completionTrend: [],
        };
      }

      return dashboardRepository.getProjectMetrics(projectId, daysWindow);
    },
    enabled: Boolean(projectId),
  });
}
