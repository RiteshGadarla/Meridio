/**
 * FILE: frontend/src/pages/google-organization-page.tsx
 * PURPOSE: /signup/organization: the second step of Google signup. A brand-new Google user names
 *          their organization; only then is the account created.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * DEPENDS ON: features/auth (pending profile, completion), @meridio/contracts (googleCompleteSchema)
 * NOTES: EDGE CASE: if the 10-minute pending cookie is missing or expired the API answers 401 and
 *        we send the user back to /signup instead of showing an empty form.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { googleCompleteSchema, type GoogleCompleteInput } from '@meridio/contracts';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Field, Input } from '../components/ui/form';
import { Avatar } from '../components/avatar';
import { AuthLayout } from '../features/auth/auth-layout';
import { useCompleteGoogleSignup, useGooglePending } from '../features/auth/hooks';
import { ApiError } from '../lib/api-client';

export function GoogleOrganizationPage() {
  const navigate = useNavigate();
  const pending = useGooglePending();
  const complete = useCompleteGoogleSignup();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<GoogleCompleteInput>({ resolver: zodResolver(googleCompleteSchema) });

  if (pending.isPending) {
    return (
      <AuthLayout title="One more step">
        <p role="status" className="text-sm text-graphite-soft">
          Loading your Google details…
        </p>
      </AuthLayout>
    );
  }
  if (pending.isError) {
    return <Navigate to="/signup" replace />;
  }

  const profile = pending.data;
  const firstName = profile.name?.split(' ')[0];

  const onSubmit = handleSubmit((values) =>
    complete.mutate(values, {
      onSuccess: () => navigate('/dashboard', { replace: true }),
      onError: (error) => {
        if (error instanceof ApiError && error.fieldErrors?.organizationName) {
          setError('organizationName', { message: error.fieldErrors.organizationName });
        } else if (error instanceof ApiError && error.status === 401) {
          navigate('/signup', { replace: true }); // pending cookie expired mid-form
        }
      },
    }),
  );

  const banner =
    complete.error instanceof ApiError && !complete.error.fieldErrors
      ? complete.error.message
      : complete.error && !(complete.error instanceof ApiError)
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <AuthLayout title={firstName ? `Welcome, ${firstName}` : 'One more step'}>
      <div className="mb-6 flex items-center gap-3 rounded-sm border border-sandstone bg-paper p-3">
        <Avatar name={profile.name ?? profile.email} pictureUrl={profile.pictureUrl} />
        <div className="min-w-0">
          {profile.name && <p className="truncate text-sm font-medium">{profile.name}</p>}
          <p className="truncate text-sm text-graphite-soft">{profile.email}</p>
        </div>
      </div>
      <p className="mb-4 text-sm text-graphite-soft">
        Your Google account is verified. Name your organization to finish creating your StockFlow
        workspace.
      </p>
      {banner && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-status-out/40 bg-status-out-tint/50 px-3 py-2 text-sm"
        >
          {banner}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Field label="Organization name" error={errors.organizationName?.message}>
          {(p) => (
            <Input autoComplete="organization" autoFocus {...p} {...register('organizationName')} />
          )}
        </Field>
        <Button type="submit" loading={complete.isPending}>
          Create workspace
        </Button>
      </form>
    </AuthLayout>
  );
}
