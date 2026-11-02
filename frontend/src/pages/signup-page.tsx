/**
 * FILE: frontend/src/pages/signup-page.tsx
 * PURPOSE: Signup form (TEMPORARY minimal visuals; real validation, API call, errors, redirect).
 * LAYER: Page
 * USED BY: app/routes.tsx
 * DEPENDS ON: features/auth, @meridio/contracts (signupFormSchema), react-hook-form
 * NOTES: Validation uses the SAME schema as the API plus the confirm-password check. Server
 *        fieldErrors (for example EMAIL_TAKEN on `email`) are mapped onto the matching input.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { signupFormSchema, type SignupFormInput } from '@meridio/contracts';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Field, Input } from '../components/ui/form';
import { GoogleButton } from '../features/auth/google-button';
import { AuthLayout } from '../features/auth/auth-layout';
import { useSignup } from '../features/auth/hooks';
import { ApiError } from '../lib/api-client';

const FIELDS = ['email', 'password', 'organizationName'] as const;

export function SignupPage() {
  const navigate = useNavigate();
  const signup = useSignup();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupFormInput>({ resolver: zodResolver(signupFormSchema) });

  const onSubmit = handleSubmit((values) =>
    // confirmPassword is a browser-only typing aid; the API never receives it.
    signup.mutate(
      { email: values.email, password: values.password, organizationName: values.organizationName },
      {
        onSuccess: () => navigate('/dashboard', { replace: true }),
        onError: (error) => {
          if (!(error instanceof ApiError) || !error.fieldErrors) return;
          for (const field of FIELDS) {
            const message = error.fieldErrors[field];
            if (message) setError(field, { message });
          }
        },
      },
    ),
  );

  const mappedToField =
    signup.error instanceof ApiError &&
    FIELDS.some((f) => signup.error instanceof ApiError && signup.error.fieldErrors?.[f]);
  const banner =
    signup.error && !mappedToField
      ? signup.error instanceof ApiError
        ? signup.error.message
        : 'Something went wrong. Please try again.'
      : null;

  return (
    <AuthLayout title="Create your account">
      {banner && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-status-out/40 bg-status-out-tint/50 px-3 py-2 text-sm"
        >
          {banner}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}
        </Field>
        <Field
          label="Password"
          hint="At least 8 characters with a letter and a number."
          error={errors.password?.message}
        >
          {(p) => (
            <Input type="password" autoComplete="new-password" {...p} {...register('password')} />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          {(p) => (
            <Input
              type="password"
              autoComplete="new-password"
              {...p}
              {...register('confirmPassword')}
            />
          )}
        </Field>
        <Field label="Organization name" error={errors.organizationName?.message}>
          {(p) => <Input autoComplete="organization" {...p} {...register('organizationName')} />}
        </Field>
        <Button type="submit" loading={signup.isPending}>
          Create account
        </Button>
      </form>
      <GoogleButton action="signup" />
      <p className="mt-6 text-sm text-graphite-soft">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand underline underline-offset-4">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
