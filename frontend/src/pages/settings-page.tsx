/**
 * FILE: frontend/src/pages/settings-page.tsx
 * PURPOSE: Settings page placeholder: header only until its stage lands.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * NOTES: TODO(stage-10): real content.
 */
import { PageHeader } from '../layouts/page-header';

export function SettingsPage() {
  return (
    <PageHeader
      eyebrow="Organization"
      title="Settings"
      description="Defaults that apply across your inventory."
    />
  );
}
