import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Shield, UserRoundPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';
import { decodeJwtClaims } from '@/lib/auth/session';

type LoginForm = {
  tenant_slug: string;
  email: string;
  password: string;
};

type RegisterForm = {
  tenant_name: string;
  tenant_slug: string;
  email: string;
  display_name: string;
  password: string;
};

type AuthResponse = {
  token: string;
};

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const auth = useAuth();

  const loginForm = useForm<LoginForm>({
    defaultValues: {
      tenant_slug: '',
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterForm>({
    defaultValues: {
      tenant_name: '',
      tenant_slug: '',
      email: '',
      display_name: '',
      password: '',
    },
  });

  async function handleLogin(values: LoginForm) {
    setError(null);
    try {
      const result = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      auth.signIn({
        token: result.token,
        tenantSlug: values.tenant_slug,
        displayName: values.email,
      });
      const claims = decodeJwtClaims(result.token);
      navigate(claims.role === 'end_user' ? '/tenant/me' : '/tenant/extensions', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async function handleRegister(values: RegisterForm) {
    setError(null);
    try {
      const result = await apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      auth.signIn({
        token: result.token,
        tenantSlug: values.tenant_slug,
        tenantName: values.tenant_name,
        displayName: values.display_name,
      });
      navigate('/tenant/extensions', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-6 py-12 text-[var(--color-fg)]">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-fg)] text-white">
              <Shield className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">manageCallAI</p>
              <p className="text-xs text-[var(--color-muted-fg)]">Tenant control-plane access</p>
            </div>
          </div>

          <div className="mt-10 max-w-xl space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">
              First vertical slice
            </p>
            <h1 className="text-4xl font-semibold tracking-tight">
              Connect the tenant workspace to real control-plane data.
            </h1>
            <p className="text-sm leading-7 text-[var(--color-muted-fg)]">
              This frontend scaffold now authenticates against the live API so extension state and runtime call events can
              be queried with the same JWT and tenant scoping used by the backend.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              'Encrypted SIP credential storage',
              'Runtime-authenticated directory lookup',
              'Tenant-scoped call event visibility',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-4 text-sm text-[var(--color-muted-fg)]"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Operator Access</p>
              <p className="mt-1 text-sm text-[var(--color-muted-fg)]">
                Sign in with an existing tenant or register a fresh tenant for the MVP flow.
              </p>
            </div>
            <UserRoundPlus className="size-5 text-[var(--color-info)]" aria-hidden="true" />
          </div>

          <div className="mt-6 flex rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] p-1">
            <button
              className={`flex-1 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium ${
                mode === 'login' ? 'bg-[var(--color-surface)] text-[var(--color-fg)] shadow-[var(--shadow-card)]' : 'text-[var(--color-muted-fg)]'
              }`}
              onClick={() => setMode('login')}
              type="button"
            >
              Login
            </button>
            <button
              className={`flex-1 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium ${
                mode === 'register'
                  ? 'bg-[var(--color-surface)] text-[var(--color-fg)] shadow-[var(--shadow-card)]'
                  : 'text-[var(--color-muted-fg)]'
              }`}
              onClick={() => setMode('register')}
              type="button"
            >
              Register
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}

          {mode === 'login' ? (
            <form className="mt-6 space-y-4" onSubmit={loginForm.handleSubmit(handleLogin)}>
              <Field label="Tenant slug">
                <input className={inputClassName} {...loginForm.register('tenant_slug', { required: true })} />
              </Field>
              <Field label="Email">
                <input className={inputClassName} type="email" {...loginForm.register('email', { required: true })} />
              </Field>
              <Field label="Password">
                <input
                  className={inputClassName}
                  type="password"
                  {...loginForm.register('password', { required: true, minLength: 8 })}
                />
              </Field>
              <Button className="w-full" type="submit">
                Sign In
              </Button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={registerForm.handleSubmit(handleRegister)}>
              <Field label="Tenant name">
                <input className={inputClassName} {...registerForm.register('tenant_name', { required: true })} />
              </Field>
              <Field label="Tenant slug">
                <input className={inputClassName} {...registerForm.register('tenant_slug', { required: true })} />
              </Field>
              <Field label="Email">
                <input className={inputClassName} type="email" {...registerForm.register('email', { required: true })} />
              </Field>
              <Field label="Display name">
                <input className={inputClassName} {...registerForm.register('display_name', { required: true })} />
              </Field>
              <Field label="Password">
                <input
                  className={inputClassName}
                  type="password"
                  {...registerForm.register('password', { required: true, minLength: 8 })}
                />
              </Field>
              <Button className="w-full" type="submit">
                Register Tenant
              </Button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';
