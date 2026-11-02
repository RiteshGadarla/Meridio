/**
 * FILE: frontend/src/pages/login-page.tsx
 * PURPOSE: Login form (TEMPORARY minimal visuals; real validation, API call, errors, redirect).
 * LAYER: Page
 * USED BY: app/routes.tsx
 * DEPENDS ON: features/auth, @meridio/contracts (loginSchema), react-hook-form
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@meridio/contracts';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Field, Input } from '../components/ui/form';
import { AuthLayout } from '../features/auth/auth-layout';
import type { LoginRedirectState } from '../features/auth/guards';
import { useLogin } from '../features/auth/hooks';
import { ApiError } from '../lib/api-client';

export function LoginPage() {
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as LoginRedirectState;
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      // Return to the page the user originally asked for (set by RequireAuth).
      onSuccess: () => navigate(state.from ?? '/dashboard', { replace: true }),
    }),
  );

  // SECURITY: the server's message is intentionally generic; show it as-is, never hint which part was wrong.
  const serverError =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <AuthLayout title="Log in">
      {state.expired && (
        <p
          role="status"
          className="mb-4 rounded-sm border border-sandstone bg-paper px-3 py-2 text-sm"
        >
          Session expired. Please log in again.
        </p>
      )}
      {serverError && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-status-out/40 bg-status-out-tint/50 px-3 py-2 text-sm"
        >
          {serverError}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(p) => (
            <Input
              type="password"
              autoComplete="current-password"
              {...p}
              {...register('password')}
            />
          )}
        </Field>
        <Button type="submit" loading={login.isPending}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-sm text-graphite-soft">
        New to StockFlow?{' '}
        <Link to="/signup" className="font-medium text-forest underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
