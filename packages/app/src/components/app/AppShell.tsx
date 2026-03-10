import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FolderKanban, FolderOpen, LayoutDashboard, LogOut, Plus, Settings, TableProperties, TimerReset } from 'lucide-react';
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

/** Logo: ∞ + "space" (as on landing) */
function Logo8Space({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center font-semibold tracking-tight', className)}>
      <span className="text-[1.1em] leading-none" aria-hidden>∞</span>
      <span className="ml-0.5">space</span>
    </span>
  );
}

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
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col text-sidebar-foreground shrink-0">
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between shrink-0">
          <Link to={`/t/${tenantSlug}/projects`} className="flex items-center text-sidebar-foreground hover:opacity-90 transition-opacity">
            <Logo8Space className="text-[1.75rem]" />
          </Link>
          <ThemeToggle />
        </div>

        {/* Workspace */}
        <div className="px-3 pb-2">
          <div className="space-y-0.5">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                className={cn(
                  'w-full px-3 py-2 rounded-md text-left text-sm transition-colors font-medium truncate',
                  tenant.slug === tenantSlug
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
                onClick={() => navigate(`/t/${tenant.slug}/projects`)}
              >
                {tenant.name}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-sidebar-border mb-2" />

        {/* Projects */}
        <div className="px-3 flex-1 overflow-y-auto space-y-0.5">
          <div className="flex items-center justify-between gap-1 px-3 py-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-muted-foreground">Projects</p>
            <button
              type="button"
              className="p-1 rounded-md text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              onClick={() => { setIsCreatingProject((v) => !v); setCreateError(null); }}
              title="Create project"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {isCreatingProject && <div className="pb-2">{createProjectForm}</div>}
          {projects.map((project) => (
            <button
              key={project.id}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors',
                project.id === projectId
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              onClick={() => navigate(`/t/${tenantSlug}/projects/${project.id}/backlog`)}
            >
              <FolderOpen className="size-4 shrink-0" />
              <span className="font-medium truncate">{project.name}</span>
            </button>
          ))}
        </div>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-muted text-sidebar-muted-foreground text-xs font-semibold uppercase">
              {(profile?.displayName ?? 'U')[0]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground truncate">{profile?.displayName ?? 'Unknown user'}</div>
              <div className="text-xs text-sidebar-muted-foreground truncate">{roleLabel || 'No project'}</div>
            </div>
            <button
              type="button"
              className="shrink-0 text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors"
              onClick={() => signOut()}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
          <div className="mt-2 px-2 text-[11px] text-sidebar-muted-foreground" title={`Build v${buildInfo.version}`}>
            Build v{buildInfo.version}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{currentProject?.name ?? 'Project'}</h1>
            <p className="text-sm text-muted-foreground">{currentProject?.description || 'No description'}</p>
          </div>
          <nav className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
            {projectTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.slug}
                  to={`/t/${tenantSlug}/projects/${projectId}/${tab.slug}`}
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors',
                      isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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

        <section className="flex-1 overflow-auto p-6">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
