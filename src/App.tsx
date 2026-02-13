import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthView } from '@/components/auth/AuthView';
import { AppShell } from '@/components/app/AppShell';
import { useAuth } from '@/hooks/use-auth';
import { BacklogView } from '@/views/BacklogView';
import { BoardView } from '@/views/BoardView';
import { TimelineView } from '@/views/TimelineView';
import { DashboardView } from '@/views/DashboardView';
import { ProjectSettingsView } from '@/views/ProjectSettingsView';

function RequireProjectId({
  render,
}: {
  render: (projectId: string) => ReactElement;
}) {
  const { projectId } = useParams();
  if (!projectId) {
    return <Navigate to="/" replace />;
  }

  return render(projectId);
}

export default function App() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="h-screen bg-background text-foreground grid place-items-center">
        <p className="text-sm text-muted-foreground">Restoring session…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />

      <Route path="/projects" element={<AppShell />}>
        <Route index element={<div className="p-6 text-sm text-muted-foreground">Select a project to continue.</div>} />
        <Route path=":projectId">
          <Route index element={<Navigate to="backlog" replace />} />
          <Route path="backlog" element={<RequireProjectId render={(projectId) => <BacklogView projectId={projectId} />} />} />
          <Route path="board" element={<RequireProjectId render={(projectId) => <BoardView projectId={projectId} />} />} />
          <Route path="timeline" element={<RequireProjectId render={(projectId) => <TimelineView projectId={projectId} />} />} />
          <Route path="dashboard" element={<RequireProjectId render={(projectId) => <DashboardView projectId={projectId} />} />} />
          <Route
            path="settings"
            element={<RequireProjectId render={(projectId) => <ProjectSettingsView projectId={projectId} />} />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
