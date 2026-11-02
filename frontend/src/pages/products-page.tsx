/**
 * FILE: frontend/src/pages/products-page.tsx
 * PURPOSE: Products page placeholder: header only until its stage lands.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * NOTES: TODO(stage-9): real content.
 */
import { PageHeader } from '../layouts/page-header';

export function ProductsPage() {
  return (
    <PageHeader
      eyebrow="Inventory"
      title="Products"
      description="Everything you stock, with live status."
    />
  );
}
