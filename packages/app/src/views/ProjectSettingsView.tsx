import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProject, useProjectMembers, useUpdateProjectSettings, useWorkflowColumns } from '@/hooks/use-project-data';

interface ProjectSettingsViewProps {
  projectId: string;
}

export function ProjectSettingsView({ projectId }: ProjectSettingsViewProps) {
  const project = useProject(projectId);
  const columnsQuery = useWorkflowColumns(projectId);
  const membersQuery = useProjectMembers(projectId);
  const updateSettings = useUpdateProjectSettings(projectId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!project) {
      return;
    }

    setName(project.name);
    setDescription(project.description ?? '');
  }, [project]);

  if (!project) {
    return null;
  }

  const canEditSettings = project.role === 'owner';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Project settings</h2>
        <p className="text-sm text-muted-foreground">Minimal admin area for owner-level project configuration.</p>
      </div>

      <section className="widget-container">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">General</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Project name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEditSettings} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!canEditSettings}
              rows={4}
              className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center justify-between">
            {!canEditSettings && (
              <p className="text-sm text-warning">Only owner can update project settings.</p>
            )}
            <Button
              disabled={!canEditSettings || !name.trim() || updateSettings.isPending}
              onClick={() =>
                updateSettings.mutate({
                  name: name.trim(),
                  description: description.trim() || null,
                })
              }
            >
              <Save className="size-4" />
              Save changes
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="widget-container">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Members</h3>
          </div>
          <div className="p-4 space-y-2">
            {(membersQuery.data ?? []).map((member) => (
              <div key={member.userId} className="flex items-center justify-between text-sm border border-border rounded-md p-2">
                <span>{member.profile?.displayName ?? member.userId}</span>
                <span className="text-muted-foreground capitalize">{member.role}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="widget-container">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Workflow columns</h3>
          </div>
          <div className="p-4 space-y-2">
            {(columnsQuery.data ?? []).map((column) => (
              <div key={column.id} className="border border-border rounded-md p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{column.name}</p>
                  <span className="text-xs text-muted-foreground uppercase">{column.kind}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {column.definitionOfDone ? `DoD: ${column.definitionOfDone}` : 'No definition of done'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
