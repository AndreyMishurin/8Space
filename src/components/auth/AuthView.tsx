import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';

export function AuthView() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('owner@gantt.local');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'signup';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          throw new Error('Name is required for sign up.');
        }
        await signUpWithPassword(email.trim(), password, name.trim());
      } else {
        await signInWithPassword(email.trim(), password);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-border rounded-xl bg-card p-6 shadow-lg space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Oko</h1>
          <p className="text-sm text-muted-foreground">Sign in to your local Supabase workspace.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={mode === 'signin' ? 'default' : 'outline'}
            onClick={() => setMode('signin')}
            type="button"
          >
            <LogIn className="size-4" />
            Sign in
          </Button>
          <Button
            variant={mode === 'signup' ? 'default' : 'outline'}
            onClick={() => setMode('signup')}
            type="button"
          >
            <UserPlus className="size-4" />
            Sign up
          </Button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your display name"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@gantt.local"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password123"
              required
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <div className="text-xs text-muted-foreground border-t border-border pt-4">
          Demo users from seed: `owner@gantt.local`, `editor@gantt.local`, `viewer@gantt.local` with password `password123`.
        </div>
      </div>
    </div>
  );
}
