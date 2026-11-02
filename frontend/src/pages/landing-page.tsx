/**
 * FILE: frontend/src/pages/landing-page.tsx
 * PURPOSE: Public intro page at "/": a full-screen MagicRings hero, then what StockFlow does and how
 *          stock status works.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * DEPENDS ON: components/magic-rings, features/auth (signed-in awareness), ui/badge, ui/table
 * NOTES: Owner-requested. There is deliberately NO navbar: the wordmark and the two actions live
 *        in the hero itself, which is fully centered (rings and copy share one center point). The rings are decorative (aria-hidden) and drawn in the brand colours
 *        (Deep Forest blending to Muted Copper) on Warm Limestone, using the crisp "light" theme.
 *        The specimen table is labelled "Example" and is illustration only, never application data.
 */
import { PRODUCT_NAME, type StockStatus } from '@meridio/contracts';
import { Link } from 'react-router-dom';
import { Logo } from '../components/logo';
import { ThemeToggle } from '../components/theme-toggle';
import MagicRings from '../components/magic-rings/magic-rings';
import { StatusBadge } from '../components/ui/badge';
import { buttonStyles } from '../components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/table';
import { useCurrentUser } from '../features/auth/hooks';
import { useTheme } from '../lib/theme';

const EXAMPLE_ROWS: {
  name: string;
  sku: string;
  qty: number;
  threshold: number;
  status: StockStatus;
}[] = [
  { name: 'Wireless Keyboard', sku: 'KEY-001', qty: 0, threshold: 5, status: 'OUT_OF_STOCK' },
  { name: 'USB-C Hub', sku: 'HUB-014', qty: 4, threshold: 10, status: 'LOW_STOCK' },
  { name: 'Desk Lamp', sku: 'LMP-220', qty: 64, threshold: 8, status: 'HEALTHY' },
];

const PRINCIPLES = [
  {
    title: 'Track every product',
    body: 'SKU, quantity, cost and selling price for each item, searchable by name or SKU and organised per organization.',
  },
  {
    title: 'See what needs attention',
    body: 'Set a low-stock threshold per product, or one default for everything. The same rule drives the dashboard, the product list and the form.',
  },
  {
    title: 'Keep each team separate',
    body: 'Every organization is isolated from the others. Sessions use secure, HttpOnly cookies, and nothing private is cached.',
  },
];

function Eyebrow({ children, centered = false }: { children: string; centered?: boolean }) {
  return (
    <>
      <p className="text-xs font-semibold tracking-[0.14em] text-graphite-soft uppercase">
        {children}
      </p>
      <div
        className={`mt-1.5 mb-4 h-px w-10 bg-copper${centered ? ' mx-auto' : ''}`}
        aria-hidden="true"
      />
    </>
  );
}

export function LandingPage() {
  const { data: user } = useCurrentUser();
  const { theme } = useTheme();

  return (
    <div className="min-h-dvh">
      <main>
        {/* ===== Hero: centered rings behind, centered content in front ===== */}
        <section className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden">
          {/*
            Layer 1, decorative rings, centered on the page. The inner ring is sized so the headline
            sits inside it; the tapered outer rings only appear as arcs at the left and right edges,
            keeping the space above and below the copy open. Dimmer on small screens, where the
            rings are narrower than the text.
          */}
          <div aria-hidden="true" className="absolute inset-0 -z-20 opacity-45 sm:opacity-100">
            <MagicRings
              theme={theme}
              color={theme === 'dark' ? '#8FCDB3' : '#173F35'}
              colorTwo="#C46B48"
              motion="pulse"
              ringCount={6}
              speed={0.8}
              baseRadius={0.3}
              radiusStep={0.07}
              lineThickness={1.6}
              glow={0.7}
              taper={1.4}
              expansion={0.08}
              hoverScale={1.08}
              parallax={0.04}
              clickBurst
            />
          </div>

          {/*
            Layer 2, a soft Warm Limestone veil. Functional, not decorative: it guarantees text
            contrast wherever a ring passes close to the copy, then fades out so the rings stay
            visible toward the edges.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--color-limestone)_92%,transparent)_0%,color-mix(in_srgb,var(--color-limestone)_70%,transparent)_28%,transparent_60%)]"
          />

          {/* Layer 3, the copy */}
          <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
            <Logo className="mb-12 text-brand" />
            <Eyebrow centered>Inventory control</Eyebrow>
            <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Know what is on your shelves before it runs out.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-graphite-soft sm:text-lg">
              {PRODUCT_NAME} keeps a clear ledger of your products and stock levels. Set a low-stock
              threshold, and the dashboard tells you what needs attention, so reordering is a
              decision and not a surprise.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {user ? (
                <Link to="/dashboard" className={buttonStyles('primary')}>
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link to="/signup" className={buttonStyles('primary')}>
                    Create your organization
                  </Link>
                  <Link to="/login" className={buttonStyles('secondary')}>
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ===== Example ledger ===== */}
        <section
          aria-labelledby="example-heading"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10"
        >
          <Eyebrow>At a glance</Eyebrow>
          <h2 id="example-heading" className="max-w-2xl text-2xl font-semibold tracking-tight">
            The items that need you, first.
          </h2>
          <figure aria-label="Example of the inventory attention list" className="mt-8">
            <figcaption className="mb-2 text-xs font-semibold tracking-wide text-graphite-soft uppercase">
              Example: what needs attention
            </figcaption>
            <Table caption="Example inventory attention list">
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH numeric>Qty</TH>
                  <TH numeric>Threshold</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {EXAMPLE_ROWS.map((row) => (
                  <TR key={row.sku}>
                    <TD>
                      <p className="font-medium">{row.name}</p>
                      <p className="font-data text-xs text-graphite-soft">{row.sku}</p>
                    </TD>
                    <TD numeric>{row.qty}</TD>
                    <TD numeric>{row.threshold}</TD>
                    <TD>
                      <StatusBadge status={row.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </figure>
        </section>

        {/* ===== Principles ===== */}
        <section
          aria-labelledby="principles-heading"
          className="border-y border-sandstone bg-paper"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
            <Eyebrow>What it does</Eyebrow>
            <h2 id="principles-heading" className="sr-only">
              What {PRODUCT_NAME} does
            </h2>
            <ul className="grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-sandstone">
              {PRINCIPLES.map((p) => (
                <li key={p.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-graphite-soft">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ===== The one rule ===== */}
        <section
          aria-labelledby="rule-heading"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10"
        >
          <Eyebrow>The one rule</Eyebrow>
          <h2 id="rule-heading" className="max-w-2xl text-2xl font-semibold tracking-tight">
            One definition of stock status, everywhere.
          </h2>
          <dl className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="border-t border-sandstone pt-4">
              <dt>
                <StatusBadge status="OUT_OF_STOCK" />
              </dt>
              <dd className="mt-3 text-sm text-graphite-soft">The quantity on hand is zero.</dd>
            </div>
            <div className="border-t border-sandstone pt-4">
              <dt>
                <StatusBadge status="LOW_STOCK" />
              </dt>
              <dd className="mt-3 text-sm text-graphite-soft">
                The quantity is at or below the product&rsquo;s threshold, or your organization
                default when it has none.
              </dd>
            </div>
            <div className="border-t border-sandstone pt-4">
              <dt>
                <StatusBadge status="HEALTHY" />
              </dt>
              <dd className="mt-3 text-sm text-graphite-soft">Comfortably above the threshold.</dd>
            </div>
          </dl>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-sandstone">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-graphite-soft sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <Logo className="text-brand" />
          <p>Inventory control for teams that count things.</p>
          <ThemeToggle label className="text-graphite-soft hover:text-graphite" />
          <p>
            Built by{' '}
            <a
              href="https://gadarlaritesh.me"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand underline underline-offset-2"
            >
              Gadarla Ritesh
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
