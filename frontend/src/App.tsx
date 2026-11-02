/**
 * FILE: frontend/src/App.tsx
 * PURPOSE: Root component. Placeholder page until the design system and router arrive.
 * LAYER: UI
 * USED BY: main.tsx
 * DEPENDS ON: @meridio/contracts (PRODUCT_NAME)
 * NOTES: TODO(stage-6): replaced by router + app shell.
 */
import { PRODUCT_NAME } from '@meridio/contracts';

/** Renders the placeholder StockFlow page. */
export function App() {
  return (
    <main>
      <h1 className="p-6 text-2xl font-semibold">{PRODUCT_NAME}</h1>
    </main>
  );
}
