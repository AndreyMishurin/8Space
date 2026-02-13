import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';

export function AuthView() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('owner@gantt.local');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

        <Button
          className="w-full"
          variant="outline"
          type="button"
          disabled={googleLoading}
          onClick={async () => {
            setGoogleLoading(true);
            setError(null);
            try {
              await signInWithGoogle();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Google sign-in failed');
              setGoogleLoading(false);
            }
          }}
        >
          <svg className="size-4 mr-2" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
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
