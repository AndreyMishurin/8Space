import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FolderKanban, LayoutDashboard, LogOut, Plus, Settings, TableProperties, TimerReset, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/theme-toggle';
import { ErrorScreen } from '@/components/ErrorScreen';
import { useAuth } from '@/hooks/use-auth';
import { useCreateProject, useProject, useProjects, useTenants } from '@/hooks/use-project-data';
import { cn } from '@/lib/utils';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import { buildInfo } from '@/lib/build-info';

const projectTabs = [
  { slug: 'backlog', label: 'Backlog', icon: TableProperties },
  { slug: 'board', label: 'Board', icon: FolderKanban },
  { slug: 'timeline', label: 'Timeline', icon: TimerReset },
  { slug: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { slug: 'settings', label: 'Project settings', icon: Settings },
] as const;

export function AppShell({ tenantSlug }: { tenantSlug: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const { profile, signOut } = useAuth();
  const tenantsQuery = useTenants();
  const projectsQuery = useProjects(tenantSlug);
  const createProject = useCreateProject(tenantSlug);
  const currentProject = useProject(projectId, tenantSlug);

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const tenants = useMemo(() => tenantsQuery.data ?? [], [tenantsQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  useEffect(() => {
    window.localStorage.setItem('8space:last-tenant-slug', tenantSlug);
  }, [tenantSlug]);

  useEffect(() => {
    if (projectsQuery.isLoading) {
      return;
    }

    if (projects.length === 0) {
      return;
    }

    if (!projectId || !projects.some((project) => project.id === projectId)) {
      navigate(`/t/${tenantSlug}/projects/${projects[0].id}/backlog`, { replace: true });
      return;
    }

    if (location.pathname === `/t/${tenantSlug}/projects/${projectId}`) {
      navigate(`/t/${tenantSlug}/projects/${projectId}/backlog`, { replace: true });
    }
  }, [location.pathname, navigate, projectId, projects, projectsQuery.isLoading, tenantSlug]);

  const canCreateProject = projectName.trim().length > 0 && !createProject.isPending;

  const createProjectForm = (
    <form
      className="space-y-2 p-3 border border-border rounded-lg bg-background"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!canCreateProject) {
          return;
        }
        setCreateError(null);
        try {
          const project = await createProject.mutateAsync({
            name: projectName.trim(),
            description: projectDescription.trim() || undefined,
          });
          setProjectName('');
          setProjectDescription('');
          setIsCreatingProject(false);
          navigate(`/t/${tenantSlug}/projects/${project.id}/backlog`);
        } catch (err) {
          setCreateError(err instanceof Error ? err.message : 'Failed to create project');
        }
      }}
    >
      <Input
        value={projectName}
        onChange={(event) => setProjectName(event.target.value)}
        placeholder="Project name"
        autoFocus
      />
      <Input
        value={projectDescription}
        onChange={(event) => setProjectDescription(event.target.value)}
        placeholder="Project description"
      />
      {createError && (
        <p className="text-sm text-destructive">{createError}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={() => { setIsCreatingProject(false); setCreateError(null); }}>
          Cancel
        </Button>
        <Button size="sm" type="submit" disabled={!canCreateProject}>
          Create
        </Button>
      </div>
    </form>
  );

  const roleLabel = useMemo(() => {
    if (!currentProject) {
      return '';
    }
    return currentProject.role.replace('_', ' ');
  }, [currentProject]);

  if (projectsQuery.isLoading) {
    return (
      <div className="h-screen bg-background text-foreground grid place-items-center gap-4">
        <Spinner variant="infinite" size={40} />
        <p className="text-sm text-muted-foreground">Loading workspace…</p>
      </div>
    );
  }

  if (projectsQuery.isError) {
    return (
      <ErrorScreen
        code={500}
        title="Workspace is unavailable"
        message={getErrorMessage(projectsQuery.error)}
        onRetry={() => projectsQuery.refetch()}
        extraActions={
          <Button variant="outline" onClick={async () => { await signOut(); navigate('/', { replace: true }); }}>
            Sign out
          </Button>
        }
      />
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="h-screen bg-background text-foreground grid place-items-center px-6">
        <div className="max-w-xl border border-border rounded-xl bg-card p-6">
          <h2 className="text-xl font-semibold">Supabase is not configured</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your environment before using the app.
          </p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="h-screen bg-background text-foreground grid place-items-center px-6">
        <div className="w-full max-w-lg border border-border rounded-xl bg-card p-6 space-y-4">
          <h2 className="text-2xl font-semibold">Create your first project</h2>
          <p className="text-sm text-muted-foreground">
            Start with a name and we will add default columns automatically.
          </p>
          {createProjectForm}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-72 bg-card border-r border-border flex flex-col">
        <div className="h-16 px-4 border-b border-border flex items-center justify-between shrink-0">
          <Link to={`/t/${tenantSlug}/projects`} className="font-semibold text-lg tracking-tight">
            8Space
          </Link>
          <ThemeToggle />
        </div>

        <div className="px-4 py-3 border-b border-border space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Workspace</h3>
          <div className="space-y-1">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                className={cn(
                  'w-full px-3 py-2 rounded-md text-left text-sm transition-colors',
                  tenant.slug === tenantSlug ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'
                )}
                onClick={() => navigate(`/t/${tenant.slug}/projects`)}
              >
                <p className="font-medium truncate">{tenant.name}</p>
                <p className="text-xs text-muted-foreground">{tenant.slug}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Projects</h3>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => { setIsCreatingProject((v) => !v); setCreateError(null); }}>
              <Plus className="size-4" />
            </Button>
          </div>
          {isCreatingProject && createProjectForm}
          <div className="space-y-1">
            {projects.map((project) => (
              <button
                key={project.id}
                className={cn(
                  'w-full px-3 py-2 rounded-md text-left text-sm transition-colors',
                  project.id === projectId ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'
                )}
                onClick={() => navigate(`/t/${tenantSlug}/projects/${project.id}/backlog`)}
              >
                <p className="font-medium truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{project.role}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-border space-y-3">
          <div className="text-xs text-muted-foreground">Signed in as</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="size-7 rounded-full bg-accent-lime/20 text-accent-lime grid place-items-center">
              <User className="size-4" />
            </span>
            <div>
              <div className="font-medium">{profile?.displayName ?? 'Unknown user'}</div>
              <div className="text-xs text-muted-foreground">{roleLabel || 'No project selected'}</div>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => signOut()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
          <div className="text-[11px] text-muted-foreground" title={`Build v${buildInfo.version}`}>
            Build v{buildInfo.version}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{currentProject?.name ?? 'Project'}</h1>
            <p className="text-sm text-muted-foreground">{currentProject?.description || 'No description'}</p>
          </div>
          <nav className="flex items-center gap-1 bg-muted p-1 rounded-md">
            {projectTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.slug}
                  to={`/t/${tenantSlug}/projects/${projectId}/${tab.slug}`}
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors',
                      isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )
                  }
                >
                  <Icon className="size-4" />
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </header>

        <section className="flex-1 overflow-auto">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
