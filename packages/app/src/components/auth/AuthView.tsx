import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';

type AuthMode = 'signin' | 'signup';
type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeAuthError(error: unknown, mode: AuthMode): FieldErrors {
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Authentication failed';
  const message = rawMessage.toLowerCase();

  if (message.includes('already registered') || message.includes('user already exists')) {
    return { email: 'A user with this email already exists. Please sign in or use another email.' };
  }

  if (message.includes('invalid email') || message.includes('unable to validate email')) {
    return { email: 'Please enter a valid email address.' };
  }

  if (message.includes('password') && message.includes('least')) {
    return { password: 'Password is too short. Use at least 6 characters.' };
  }

  if (message.includes('password') && message.includes('weak')) {
    return { password: 'Password is too weak. Use a stronger password.' };
  }

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return { form: 'Too many attempts. Please wait and try again.' };
  }

  if (message.includes('invalid login credentials')) {
    return { form: 'Invalid email or password.' };
  }

  if (message.includes('failed to fetch') || message.includes('network') || message.includes('timeout')) {
    return { form: 'Cannot reach auth server. Please check your connection and try again.' };
  }

  if (mode === 'signup' && (message.includes('422') || message.includes('unprocessable'))) {
    return { form: 'Sign up failed: check email format and password requirements.' };
  }

  if (mode === 'signin' && (message.includes('400') || message.includes('bad request'))) {
    return { form: 'Sign in failed: check email and password.' };
  }

  return { form: rawMessage };
}

/** Toggle to enable/disable email/password auth UI. */
const EMAIL_AUTH_ENABLED = false;

export function AuthView() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const isSignUp = mode === 'signup';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setLoading(true);

    const nextErrors: FieldErrors = {};

    try {
      const normalizedEmail = email.trim();
      if (!isValidEmail(normalizedEmail)) {
        nextErrors.email = 'Please enter a valid email address.';
      }

      if (isSignUp) {
        if (!name.trim()) {
          nextErrors.name = 'Name is required for sign up.';
        }
        if (password.length < 6) {
          nextErrors.password = 'Password is too short. Use at least 6 characters.';
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      if (isSignUp) {
        await signUpWithPassword(normalizedEmail, password, name.trim());
      } else {
        await signInWithPassword(normalizedEmail, password);
      }
    } catch (submitError) {
      setErrors(normalizeAuthError(submitError, mode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-foreground flex items-center justify-center p-6"
      style={{
        backgroundColor: '#0a0a0a',
        backgroundImage: [
          'radial-gradient(ellipse 120% 100% at 0% 100%, rgba(250, 115, 19, 0.5) 0%, rgba(250, 115, 19, 0.2) 38%, rgba(250, 115, 19, 0.06) 62%, transparent 82%)',
          'linear-gradient(145deg, #0a0a0a 0%, transparent 50%, rgba(250, 115, 19, 0.03) 100%)',
        ].join(', '),
      }}
    >
      <div className="w-full max-w-md border border-border rounded-xl bg-card p-6 shadow-lg space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">8Space</h1>
          <p className="text-sm text-muted-foreground">Enter your personal data to create account</p>
        </div>

        <Button
          className="w-full"
          variant="outline"
          type="button"
          disabled={googleLoading}
          onClick={async () => {
            setGoogleLoading(true);
            setErrors({});
            try {
              await signInWithGoogle();
            } catch (e) {
              setErrors({ form: e instanceof Error ? e.message : 'Google sign-in failed' });
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

        {EMAIL_AUTH_ENABLED && (
          <>
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
                onClick={() => {
                  setMode('signin');
                  setErrors({});
                }}
                type="button"
              >
                <LogIn className="size-4" />
                Sign in
              </Button>
              <Button
                variant={mode === 'signup' ? 'default' : 'outline'}
                onClick={() => {
                  setMode('signup');
                  setErrors({});
                }}
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
                    onChange={(event) => {
                      setName(event.target.value);
                      setErrors((current) => {
                        const { name: _name, form: _form, ...rest } = current;
                        return rest;
                      });
                    }}
                    placeholder="Your display name"
                    className={errors.name ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                  />
                  {errors.name && (
                    <p id="name-error" className="text-sm text-error">
                      {errors.name}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((current) => {
                      const { email: _email, form: _form, ...rest } = current;
                      return rest;
                    });
                  }}
                  placeholder="you@example.com"
                  required
                  className={errors.email ? 'border-destructive focus-visible:ring-destructive' : undefined}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <p id="email-error" className="text-sm text-error">
                    {errors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((current) => {
                      const { password: _password, form: _form, ...rest } = current;
                      return rest;
                    });
                  }}
                  placeholder="••••••••"
                  required
                  className={errors.password ? 'border-destructive focus-visible:ring-destructive' : undefined}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                {errors.password && (
                  <p id="password-error" className="text-sm text-error">
                    {errors.password}
                  </p>
                )}
              </div>

              {errors.form && <p className="text-sm text-error">{errors.form}</p>}

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
              </Button>
            </form>
          </>
        )}

        {!EMAIL_AUTH_ENABLED && errors.form && <p className="text-sm text-error">{errors.form}</p>}

      </div>
    </div>
  );
}
