/**
 * FILE: frontend/src/pages/settings-page.tsx
 * PURPOSE: /settings: the "Inventory Defaults" section with the default low-stock threshold.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * DEPENDS ON: features/settings
 */
import { Skeleton } from '../components/ui/skeleton';
import { ErrorState } from '../components/ui/states';
import { SettingsForm } from '../features/settings/settings-form';
import { useSettings } from '../features/settings/hooks';
import { PageHeader } from '../layouts/page-header';

export function SettingsPage() {
  const settings = useSettings();
  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Defaults that apply across your inventory."
      />

      <section aria-labelledby="defaults-heading" className="border-t border-sandstone pt-6">
        <h2 id="defaults-heading" className="mb-4 text-lg font-semibold">
          Inventory Defaults
        </h2>

        {settings.isPending && (
          <div role="status" aria-busy="true" aria-label="Loading settings" className="max-w-md">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-3 h-10 w-full" />
            <Skeleton className="mt-3 h-4 w-80" />
          </div>
        )}
        {settings.isError && (
          <ErrorState
            message="We could not load your settings."
            onRetry={() => void settings.refetch()}
          />
        )}
        {settings.data && <SettingsForm settings={settings.data} />}
      </section>

      <p className="mt-16 border-t border-sandstone pt-6 text-sm text-graphite-soft">
        StockFlow, built by{' '}
        <a
          href="https://gadarlaritesh.me"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand underline underline-offset-2"
        >
          Gadarla Ritesh
        </a>
      </p>
    </>
  );
}
