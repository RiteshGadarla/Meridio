/**
 * FILE: frontend/src/pages/dashboard-page.tsx
 * PURPOSE: Dashboard page placeholder: header only until its stage lands.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * NOTES: TODO(stage-8): real content.
 */
import { PageHeader } from '../layouts/page-header';

export function DashboardPage() {
  return (
    <PageHeader
      eyebrow="Inventory"
      title="Inventory overview"
      description="A snapshot of stock across your organization."
    />
  );
}
