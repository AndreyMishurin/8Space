import { useState } from 'react';
import { Building2, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateTenant } from '@/hooks/use-project-data';

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function slugifyTenantName(value: string): string {
  const lower = value.trim().toLowerCase();
  const transliterated = [...lower]
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('');

  const normalized = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || 'space';
}

export function TenantOnboardingView() {
  const navigate = useNavigate();
  const createTenant = useCreateTenant();

  const [spaceName, setSpaceName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = spaceName.trim().length > 0 && !createTenant.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-border rounded-xl bg-card p-6 shadow-lg space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto size-10 rounded-full bg-accent-lime/15 text-accent-lime grid place-items-center">
            <Building2 className="size-5" />
          </div>
          <h1 className="text-2xl font-semibold">Create your 8 Space</h1>
          <p className="text-sm text-muted-foreground">
            One final step before you start planning - pick a name for your workspace.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }

            const name = spaceName.trim();
            setError(null);

            try {
              const tenant = await createTenant.mutateAsync({
                name,
                preferredSlug: slugifyTenantName(name),
              });

              window.localStorage.setItem('8space:last-tenant-slug', tenant.slug);
              navigate(`/t/${tenant.slug}/projects`, { replace: true });
            } catch (createError) {
              setError(createError instanceof Error ? createError.message : 'Failed to create workspace');
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="space-name">Workspace name</Label>
            <Input
              id="space-name"
              value={spaceName}
              onChange={(event) => setSpaceName(event.target.value)}
              placeholder="Example: Product Team"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button className="w-full" type="submit" disabled={!canSubmit}>
            <Rocket className="size-4" />
            {createTenant.isPending ? 'Creating workspace…' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  );
}
