/**
 * FILE: frontend/src/pages/dashboard-page.tsx
 * PURPOSE: /dashboard: header, three metrics, and the "Inventory attention" table with real data.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * DEPENDS ON: features/dashboard, features/auth (organization name)
 * NOTES: States: skeleton, error with retry, empty catalogue, "All stocked up", and the table.
 */
import { Link } from 'react-router-dom';
import { buttonStyles } from '../components/ui/button';
import { MetricSkeleton, TableSkeleton } from '../components/ui/skeleton';
import { EmptyState, ErrorState } from '../components/ui/states';
import { useCurrentUser } from '../features/auth/hooks';
import { AttentionTable } from '../features/dashboard/attention-table';
import { useDashboardOverview } from '../features/dashboard/hooks';
import { KpiCards } from '../features/dashboard/kpi-cards';
import { PageHeader } from '../layouts/page-header';

const ADD_PRODUCT_PATH = '/products?new=1'; // the drawer opens from this query param (Stage 9)

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const overview = useDashboardOverview();
  const orgName = user?.organization.name;

  const addProduct = (
    <Link to={ADD_PRODUCT_PATH} className={buttonStyles('primary')}>
      Add Product
    </Link>
  );

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Inventory overview"
        description={`What needs attention in ${orgName ?? 'your organization'} right now.`}
        action={addProduct}
      />

      {overview.isPending && (
        <div aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </div>
          <div className="mt-10">
            <TableSkeleton rows={4} columns={6} />
          </div>
        </div>
      )}

      {overview.isError && (
        <ErrorState
          message="We could not load your inventory overview."
          onRetry={() => void overview.refetch()}
        />
      )}

      {overview.data && (
        <>
          <KpiCards
            totalProducts={overview.data.totalProducts}
            totalUnits={overview.data.totalUnits}
            lowStockCount={overview.data.lowStockCount}
          />

          <section aria-labelledby="attention-heading" className="mt-10">
            <h2 id="attention-heading" className="text-lg font-semibold">
              Inventory attention
            </h2>
            <p className="mt-1 mb-4 text-sm text-graphite-soft">
              Needs attention: products at or below their low-stock threshold, including those out
              of stock.
            </p>

            {overview.data.totalProducts === 0 ? (
              <EmptyState
                title="No products yet"
                description="Add your first product and its stock levels will be tracked here."
                action={
                  <Link to={ADD_PRODUCT_PATH} className={buttonStyles('primary')}>
                    Add your first product
                  </Link>
                }
              />
            ) : overview.data.lowStockProducts.length === 0 ? (
              <div className="rounded-sm border border-status-healthy/40 bg-sage/50 px-6 py-8">
                <h3 className="text-base font-semibold">All stocked up</h3>
                <p className="mt-1.5 text-sm text-graphite-soft">
                  Every product is above its low-stock threshold. Nothing needs attention right now.
                </p>
              </div>
            ) : (
              <AttentionTable products={overview.data.lowStockProducts} />
            )}
          </section>
        </>
      )}
    </>
  );
}
