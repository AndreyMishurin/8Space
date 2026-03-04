import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthView } from '@/components/auth/AuthView';
import { AppShell } from '@/components/app/AppShell';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { ErrorScreen } from '@/components/ErrorScreen';
import { useAuth } from '@/hooks/use-auth';
import { useTenants } from '@/hooks/use-project-data';
import { BacklogView } from '@/views/BacklogView';
import { BoardView } from '@/views/BoardView';
import { TimelineView } from '@/views/TimelineView';
import { DashboardView } from '@/views/DashboardView';
import { ProjectSettingsView } from '@/views/ProjectSettingsView';
import { TenantOnboardingView } from '@/views/TenantOnboardingView';
import { NotFoundView } from '@/views/NotFoundView';

function getPreferredTenantSlug(): string | null {
  return window.localStorage.getItem('8space:last-tenant-slug');
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="h-screen bg-background text-foreground grid place-items-center gap-4">
      <Spinner variant="infinite" size={40} />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function HomeRedirect() {
  const tenantsQuery = useTenants();
  const preferredSlug = getPreferredTenantSlug();

  if (tenantsQuery.isLoading) {
    return <LoadingState text="Loading workspace…" />;
  }

  if (tenantsQuery.isError) {
    if (preferredSlug) {
      return <Navigate to={`/t/${preferredSlug}/projects`} replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  const tenants = tenantsQuery.data ?? [];
  if (tenants.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  const preferredTenant = preferredSlug ? tenants.find((tenant) => tenant.slug === preferredSlug) : undefined;
  const targetSlug = preferredTenant?.slug ?? tenants[0].slug;

  return <Navigate to={`/t/${targetSlug}/projects`} replace />;
}

function TenantOnboardingGate() {
  const tenantsQuery = useTenants();
  const preferredSlug = getPreferredTenantSlug();

  if (tenantsQuery.isLoading) {
    return <LoadingState text="Loading workspace…" />;
  }

  if (tenantsQuery.isError) {
    if (preferredSlug) {
      return <Navigate to={`/t/${preferredSlug}/projects`} replace />;
    }
    return <TenantOnboardingView />;
  }

  const tenants = tenantsQuery.data ?? [];
  if (tenants.length > 0) {
    return <Navigate to={`/t/${tenants[0].slug}/projects`} replace />;
  }

  return <TenantOnboardingView />;
}

function RequireTenant({
  render,
}: {
  render: (tenantSlug: string) => ReactElement;
}) {
  const { tenantSlug } = useParams();
  const tenantsQuery = useTenants();
  if (!tenantSlug) {
    return <Navigate to="/" replace />;
  }

  if (tenantsQuery.isLoading) {
    return <LoadingState text="Loading workspace…" />;
  }

  if (tenantsQuery.isError) {
    return render(tenantSlug);
  }

  const tenants = tenantsQuery.data ?? [];
  const tenant = tenants.find((item) => item.slug === tenantSlug);

  if (!tenant) {
    if (tenants.length === 0) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to={`/t/${tenants[0].slug}/projects`} replace />;
  }

  return render(tenant.slug);
}

function RequireProjectId({
  render,
}: {
  render: (tenantSlug: string, projectId: string) => ReactElement;
}) {
  const { tenantSlug, projectId } = useParams();
  if (!tenantSlug || !projectId) {
    return <Navigate to="/" replace />;
  }

  return render(tenantSlug, projectId);
}

export default function App() {
  const { bootstrapError, loading, recovering, retryBootstrap, signOut, user } = useAuth();

  if (loading) {
    return <LoadingState text={recovering ? 'Restoring connection…' : 'Restoring session…'} />;
  }

  if (!user && bootstrapError) {
    return (
      <ErrorScreen
        code={500}
        title="Session recovery failed"
        message={bootstrapError}
        onRetry={retryBootstrap}
        showGoHome={false}
        extraActions={
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
            }}
          >
            Sign out
          </Button>
        }
      />
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <Routes>
      <Route path="/auth/callback" element={<Navigate to="/" replace />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/onboarding" element={<TenantOnboardingGate />} />

      <Route
        path="/t/:tenantSlug/projects"
        element={<RequireTenant render={(tenantSlug) => <AppShell tenantSlug={tenantSlug} />} />}
      >
        <Route index element={<div className="p-6 text-sm text-muted-foreground">Select a project to continue.</div>} />
        <Route path=":projectId">
          <Route index element={<Navigate to="backlog" replace />} />
          <Route
            path="backlog"
            element={<RequireProjectId render={(tenantSlug, projectId) => <BacklogView tenantSlug={tenantSlug} projectId={projectId} />} />}
          />
          <Route
            path="board"
            element={<RequireProjectId render={(tenantSlug, projectId) => <BoardView tenantSlug={tenantSlug} projectId={projectId} />} />}
          />
          <Route
            path="timeline"
            element={<RequireProjectId render={(tenantSlug, projectId) => <TimelineView tenantSlug={tenantSlug} projectId={projectId} />} />}
          />
          <Route
            path="dashboard"
            element={<RequireProjectId render={(tenantSlug, projectId) => <DashboardView tenantSlug={tenantSlug} projectId={projectId} />} />}
          />
          <Route
            path="settings"
            element={<RequireProjectId render={(tenantSlug, projectId) => <ProjectSettingsView tenantSlug={tenantSlug} projectId={projectId} />} />}
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundView />} />
    </Routes>
  );
}
