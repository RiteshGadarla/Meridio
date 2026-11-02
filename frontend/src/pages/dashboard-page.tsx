/**
 * FILE: frontend/src/pages/dashboard-page.tsx
 * PURPOSE: /dashboard: header, three metrics, and the "Inventory attention" table with real data.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * DEPENDS ON: features/dashboard, features/auth (organization name)
 * NOTES: States: skeleton, error with retry, empty catalogue, "All stocked up", and the table.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductDto } from '@meridio/contracts';
import { cn } from '../lib/cn';
import { buttonStyles } from '../components/ui/button';
import { MetricSkeleton, TableSkeleton } from '../components/ui/skeleton';
import { EmptyState, ErrorState } from '../components/ui/states';
import { useCurrentUser } from '../features/auth/hooks';
import {
  AttentionTable,
  type AttentionSort,
  type AttentionSortKey,
} from '../features/dashboard/attention-table';
import { useProducts } from '../features/products/hooks';
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
              <AttentionSection
                products={overview.data.lowStockProducts}
                totalProducts={overview.data.totalProducts}
              />
            )}
          </section>
        </>
      )}
    </>
  );
}

/** Rows per page options for the attention table (max on one page). */
const PAGE_SIZES = [10, 25, 50] as const;

/**
 * ATTENTION, LOW_STOCK and OUT_OF_STOCK slice the needs-attention list the overview returned.
 * HEALTHY and ALL are not in that list, so they are fetched from the products API instead.
 */
type StatusFilter = 'ATTENTION' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'HEALTHY' | 'ALL';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ATTENTION', label: 'Needs attention' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'HEALTHY', label: 'Healthy' },
  { value: 'ALL', label: 'All products' },
];

const ALL_SORTABLE: readonly AttentionSortKey[] = [
  'name',
  'sku',
  'quantity',
  'threshold',
  'status',
];
const SERVER_SORTABLE: readonly AttentionSortKey[] = ['name', 'sku', 'quantity'];
/** Dashboard column -> products API sort field. */
const SERVER_SORT_FIELD = { name: 'name', sku: 'sku', quantity: 'quantityOnHand' } as const;
const STATUS_RANK: Record<ProductDto['stockStatus'], number> = {
  OUT_OF_STOCK: 0,
  LOW_STOCK: 1,
  HEALTHY: 2,
};

/** Comparator for in-browser sorting; ties fall back to name so the order is stable. */
function compareBy({ key, order }: AttentionSort) {
  const dir = order === 'asc' ? 1 : -1;
  return (a: ProductDto, b: ProductDto): number => {
    let r: number;
    if (key === 'name') r = a.name.localeCompare(b.name);
    else if (key === 'sku') r = a.sku.localeCompare(b.sku);
    else if (key === 'quantity') r = a.quantityOnHand - b.quantityOnHand;
    else if (key === 'threshold') r = a.effectiveThreshold - b.effectiveThreshold;
    else r = STATUS_RANK[a.stockStatus] - STATUS_RANK[b.stockStatus];
    return r * dir || a.name.localeCompare(b.name);
  };
}

/** Debounces fast-changing input (search box) before it becomes an API request. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * Inventory table with status filters, name/SKU search and a rows-per-page setting.
 * Attention views filter the already-loaded list in the browser; Healthy / All products page
 * through GET /products on the server, so a large catalogue is never downloaded at once.
 */
function AttentionSection({
  products,
  totalProducts,
}: {
  products: ProductDto[];
  totalProducts: number;
}) {
  const [status, setStatus] = useState<StatusFilter>('ATTENTION');
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<AttentionSort | null>(null);
  const serverMode = status === 'HEALTHY' || status === 'ALL';
  const debouncedQuery = useDebounced(query.trim());

  const counts = useMemo(
    () => ({
      ATTENTION: products.length,
      LOW_STOCK: products.filter((p) => p.stockStatus === 'LOW_STOCK').length,
      OUT_OF_STOCK: products.filter((p) => p.stockStatus === 'OUT_OF_STOCK').length,
      // Healthy = everything not in the needs-attention list (that list is the full set).
      HEALTHY: totalProducts - products.length,
      ALL: totalProducts,
    }),
    [products, totalProducts],
  );

  // The products API can sort by name, SKU and quantity only; threshold and status sort in the
  // browser views. If the active sort is not available server-side, fall back to quantity.
  const sortable = serverMode ? SERVER_SORTABLE : ALL_SORTABLE;
  // null = no column chosen: attention views keep the API's urgency order; server views use quantity.
  const activeSort: AttentionSort | null = sort && sortable.includes(sort.key) ? sort : null;
  const onSort = (key: AttentionSortKey) => {
    setSort(
      activeSort?.key === key
        ? { key, order: activeSort.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: 'asc' },
    );
    setPage(1);
  };

  const clientRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = products.filter(
      (p) =>
        (status === 'ATTENTION' || p.stockStatus === status) &&
        (q === '' || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    );
    return activeSort ? [...matches].sort(compareBy(activeSort)) : matches;
  }, [products, status, query, activeSort?.key, activeSort?.order]); // eslint-disable-line react-hooks/exhaustive-deps

  const server = useProducts(
    {
      page,
      limit: pageSize,
      search: debouncedQuery,
      sort:
        (activeSort && SERVER_SORT_FIELD[activeSort.key as keyof typeof SERVER_SORT_FIELD]) ||
        'quantityOnHand',
      order: activeSort?.order ?? 'asc',
      ...(status === 'HEALTHY' ? { status: 'HEALTHY' as const } : {}),
    },
    serverMode,
  );

  const total = serverMode ? (server.data?.meta.total ?? 0) : clientRows.length;
  // EDGE CASE: clamp, so a shrinking list (new filter, or a product leaving the list) never
  // leaves the user on a page that no longer exists.
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const rows = serverMode
    ? (server.data?.products ?? [])
    : clientRows.slice(start, start + pageSize);

  const clear = () => {
    setStatus('ATTENTION');
    setQuery('');
    setPage(1);
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              className={cn(
                'rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors',
                status === value
                  ? 'border-forest bg-forest text-on-forest'
                  : 'border-sandstone bg-paper text-graphite-soft hover:text-graphite',
              )}
            >
              {label} <span className="font-data ml-1 text-xs opacity-80">{counts[value]}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search name or SKU"
          aria-label="Search the table by name or SKU"
          className="h-9 w-full rounded-sm border border-sandstone bg-paper px-3 text-sm text-graphite placeholder:text-graphite-soft/70 lg:w-64"
        />
      </div>

      {serverMode && server.isPending ? (
        <TableSkeleton rows={4} columns={6} />
      ) : serverMode && server.isError ? (
        <ErrorState message="We could not load products." onRetry={() => void server.refetch()} />
      ) : total === 0 ? (
        <div className="rounded-sm border border-sandstone bg-paper px-6 py-8">
          <h3 className="text-base font-semibold">No matching products</h3>
          <p className="mt-1.5 text-sm text-graphite-soft">
            Nothing in this view matches your filter or search.
          </p>
          <button
            type="button"
            onClick={clear}
            className="mt-3 text-sm font-medium text-brand underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <AttentionTable products={rows} sort={activeSort} sortable={sortable} onSort={onSort} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-graphite-soft">
            <label className="inline-flex items-center gap-2">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-sm border border-sandstone bg-paper px-2 text-sm text-graphite"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="font-data text-xs">
              {start + 1}&ndash;{Math.min(start + pageSize, total)} of {total}
            </span>
            <div className="inline-flex gap-2">
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-sm border border-sandstone bg-paper px-3 py-1 font-medium text-graphite disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= pageCount}
                className="rounded-sm border border-sandstone bg-paper px-3 py-1 font-medium text-graphite disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
