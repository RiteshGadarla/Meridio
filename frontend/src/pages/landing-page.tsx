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
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BellRing, ChevronDown, Scale, ShieldCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Logo, LogoMark } from '../components/logo';
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

/**
 * Fades and lifts its children into view once, when scrolled to.
 * WHY guarded: jsdom (tests) and very old browsers lack IntersectionObserver; content must then
 * simply be visible. prefers-reduced-motion is handled globally in globals.css.
 */
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      // WHY the negative bottom margin: fire only once the block has actually climbed into the
      // viewport, so the animation is seen instead of finishing off-screen.
      { threshold: 0.1, rootMargin: '0px 0px -18% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className={`${shown ? 'animate-rise' : 'opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Decorative night-sky backdrop for dark sections: twinkling stars plus slowly orbiting rings
 * with a small copper "planet" on each. Pure CSS, aria-hidden; reduced-motion disables animation.
 * WHY deterministic stars: random positions would change on every render and break SSR/tests.
 */
const STARS = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  delay: (i % 9) * 0.45,
  size: i % 5 === 0 ? 3 : 2,
}));

function Cosmos({
  tone = 'dark',
  shift = 'center',
  comet = false,
}: {
  tone?: 'dark' | 'light';
  shift?: 'center' | 'left' | 'right';
  comet?: boolean;
}) {
  const dark = tone === 'dark';
  const star = dark ? 'bg-white' : 'bg-forest/60';
  const ringA = dark ? 'border-white/10' : 'border-sandstone';
  const ringB = dark ? 'border-copper/20' : 'border-copper/25';
  const x = shift === 'left' ? 'left-[15%]' : shift === 'right' ? 'left-[85%]' : 'left-1/2';
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {STARS.map((st, i) => (
        <span
          key={i}
          className={`animate-twinkle absolute rounded-full ${star} ${dark ? '' : 'max-sm:hidden'}`}
          style={{
            left: `${(st.left + (shift === 'left' ? 17 : shift === 'right' ? 41 : 0)) % 100}%`,
            top: `${st.top}%`,
            width: st.size,
            height: st.size,
            animationDelay: `${st.delay}s`,
          }}
        />
      ))}
      <div
        className={`animate-orbit absolute top-1/2 ${x} size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full border ${ringA}`}
      >
        <span className="absolute -top-1.5 left-1/2 size-3 rounded-full bg-copper" />
      </div>
      <div
        className={`animate-orbit-rev absolute top-1/2 ${x} size-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full border ${ringB}`}
      >
        <span className="absolute top-1/2 -right-1 size-2 rounded-full bg-sage" />
      </div>
      {comet && (
        <span
          className={`animate-comet absolute top-[18%] right-[12%] h-px w-28 bg-gradient-to-r from-transparent ${dark ? 'to-white' : 'to-copper'}`}
        />
      )}
    </div>
  );
}

const HIGHLIGHTS = [
  {
    icon: Scale,
    title: 'One status rule',
    body: 'A single definition of healthy, low and out of stock drives every screen.',
  },
  {
    icon: ShieldCheck,
    title: 'Per-organization isolation',
    body: 'Your data is scoped to your organization. No other team can see it.',
  },
  {
    icon: BellRing,
    title: 'Real-time attention list',
    body: 'Products that need reordering surface the moment stock changes.',
  },
];

const RULES: { status: StockStatus; body: string }[] = [
  { status: 'OUT_OF_STOCK', body: 'The quantity on hand is zero.' },
  {
    status: 'LOW_STOCK',
    body: 'The quantity is at or below the product\u2019s threshold, or your organization default when it has none.',
  },
  { status: 'HEALTHY', body: 'Comfortably above the threshold.' },
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

/**
 * Opening sequence: a full-screen limestone curtain; the logo mark pops in, then "StockFlow" is
 * typed out one letter at a time at giant size; after a short hold the whole wordmark shrinks and
 * glides into the real hero logo's spot while the curtain fades. `onDone` then lets the rest of
 * the hero animate in.
 * WHY a separate overlay wordmark (not transforming the real logo): the real logo stays untouched
 * and hidden until the hand-off, so React StrictMode's double effect run or a re-render can never
 * leave it mis-measured. The overlay has the same natural size as the real logo, so its final
 * transform (translate to the target's top-left, scale 1) lands pixel-exact.
 * EDGE CASE: skipped for reduced-motion, when scrolled, or when the layout has no size (jsdom).
 */
const LETTER_MS = 120;
const HOLD_MS = 700;
const MOVE_MS = 1100;

function IntroLogo({ onDone, onLanded }: { onDone: () => void; onLanded: () => void }) {
  const targetRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [revealed, setRevealed] = useState(0); // 0 = nothing, 1 = mark, 2.. = letters
  const [fading, setFading] = useState(false);
  const letters = PRODUCT_NAME.split('');

  useLayoutEffect(() => {
    const target = targetRef.current;
    const overlay = overlayRef.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // WHY reset first: in dev, React StrictMode runs this effect twice, and a bounding box read
    // while the first run's scale is still applied would be ~9x too large (shrinking the intro).
    if (overlay) {
      overlay.style.transition = 'none';
      overlay.style.transform = 'none';
    }
    const natural = overlay?.getBoundingClientRect();
    if (!target || !overlay || !natural || natural.width === 0 || reduce || window.scrollY > 0) {
      setActive(false);
      onDone();
      onLanded();
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min((vw * 0.8) / natural.width, 9);
    // Start: wordmark centered on screen, scaled up about its own center.
    overlay.style.transition = 'none';
    overlay.style.transform = `translate(${(vw - natural.width) / 2}px, ${(vh - natural.height) / 2}px) scale(${scale})`;
    document.body.style.overflow = 'hidden';

    const timers: number[] = [];
    const total = letters.length + 1;
    let step = 0;
    const typer = window.setInterval(() => {
      step += 1;
      setRevealed(step);
      if (step < total) return;
      window.clearInterval(typer);
      timers.push(
        window.setTimeout(() => {
          const to = target.getBoundingClientRect();
          overlay.style.transition = `transform ${MOVE_MS}ms cubic-bezier(0.65, 0, 0.2, 1)`;
          overlay.style.transform = `translate(${to.left}px, ${to.top}px) scale(1)`;
          setFading(true);
          // Start the hero copy while the logo is still landing so the hand-off flows.
          timers.push(window.setTimeout(onDone, MOVE_MS * 0.6));
          timers.push(
            window.setTimeout(() => {
              document.body.style.overflow = '';
              setActive(false);
              onLanded();
            }, MOVE_MS),
          );
        }, HOLD_MS),
      );
    }, LETTER_MS);
    return () => {
      window.clearInterval(typer);
      timers.forEach(clearTimeout);
      document.body.style.overflow = '';
      setRevealed(0);
      setFading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount by design
  }, []);

  return (
    <>
      {/* The real logo: reserves the final spot, hidden until the overlay lands on it. */}
      <div className="mb-10 flex justify-center">
        <span ref={targetRef} className={active ? 'invisible' : ''}>
          <Logo className="text-brand" />
        </span>
      </div>
      {active &&
        createPortal(
          <div aria-hidden="true" className="fixed inset-0 z-50">
            {/* WHY a separate backdrop: only the curtain fades. Fading the wordmark with it made the
                letters dim and pop back when the real logo took over. */}
            <div
              className={`absolute inset-0 bg-limestone transition-opacity ease-in-out ${fading ? 'opacity-0' : 'opacity-100'}`}
              style={{ transitionDuration: `${MOVE_MS}ms` }}
            />
            <div
              ref={overlayRef}
              className="absolute top-0 left-0 inline-flex items-center gap-2.5 text-brand will-change-transform"
            >
              <LogoMark
                className={`transition-all duration-300 ${revealed >= 1 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
              />
              <span className="text-lg font-semibold tracking-tight">
                {letters.map((ch, i) => (
                  <span
                    key={i}
                    className={`inline-block transition-all duration-200 ${revealed >= i + 2 ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}
                  >
                    {ch}
                  </span>
                ))}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function LandingPage() {
  const { data: user } = useCurrentUser();
  const { theme } = useTheme();
  // Hero copy waits (invisible) until the opening logo sequence finishes.
  const [ready, setReady] = useState(false);
  // WHY rings wait: the WebGL rings stall the main thread while initialising, which made the
  // logo's glide stutter. They mount only after the logo has landed and fade in.
  const [landed, setLanded] = useState(false);
  const rise = ready ? 'animate-rise' : 'opacity-0';

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
          <div
            aria-hidden="true"
            className="animate-fade-in absolute inset-0 -z-20 opacity-45 [animation-duration:1200ms] sm:opacity-100"
          >
            {landed && (
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
            )}
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
            <IntroLogo onDone={() => setReady(true)} onLanded={() => setLanded(true)} />
            <h1
              className={`${rise} mx-auto max-w-2xl text-4xl font-semibold tracking-tight text-balance [animation-delay:0ms] sm:text-5xl lg:text-6xl`}
            >
              Know what is on your shelves{' '}
              <span className="animate-sweep bg-[linear-gradient(90deg,var(--color-brand),var(--color-copper),var(--color-brand))] bg-[length:200%_100%] bg-clip-text text-transparent">
                before it runs out.
              </span>
            </h1>
            <p
              className={`${rise} mx-auto mt-6 max-w-xl text-base text-graphite-soft [animation-delay:150ms] sm:text-lg`}
            >
              {PRODUCT_NAME} keeps a clear ledger of your products and stock levels. Set a low-stock
              threshold, and the dashboard tells you what needs attention, so reordering is a
              decision and not a surprise.
            </p>
            <div
              className={`${rise} mt-9 flex flex-wrap justify-center gap-3 [animation-delay:300ms]`}
            >
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
          <a
            href="#highlights"
            onClick={(e) => {
              // WHY: the default anchor jump teleports; smooth-scroll instead, unless the visitor
              // prefers reduced motion. The href remains as the no-JS fallback.
              e.preventDefault();
              const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              document
                .getElementById('highlights')
                ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
            }}
            aria-label="Scroll to learn more"
            className={`${rise} absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full p-2 text-graphite-soft transition-colors [animation-delay:700ms] hover:text-copper`}
          >
            <ChevronDown aria-hidden="true" className="size-6 animate-bounce" />
          </a>
        </section>

        {/* ===== Why StockFlow: cosmic highlights section ===== */}
        <section
          id="highlights"
          aria-labelledby="highlights-heading"
          className="relative isolate overflow-hidden bg-forest text-white"
        >
          <Cosmos comet />
          <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-10">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">
                Why {PRODUCT_NAME}
              </p>
              <div className="mx-auto mt-1.5 mb-4 h-px w-10 bg-copper" aria-hidden="true" />
              <h2
                id="highlights-heading"
                className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
              >
                Three guarantees, built into every screen.
              </h2>
            </Reveal>
            <ul className="mt-14 grid gap-5 md:grid-cols-3">
              {HIGHLIGHTS.map((h, i) => (
                <li key={h.title} className={i === 1 ? 'md:mt-8' : ''}>
                  <Reveal delay={i * 120} className="h-full">
                    <div
                      className="animate-float h-full rounded-lg border border-white/15 bg-forest/80 p-7 transition-colors duration-300 hover:border-copper"
                      style={{ animationDelay: `${i * 1.2}s` }}
                    >
                      <h.icon aria-hidden="true" className="size-7 text-copper" strokeWidth={1.5} />
                      <h3 className="mt-6 text-xl font-semibold">{h.title}</h3>
                      <p className="mt-2 text-sm text-white/75">{h.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ===== Example ledger: copy beside a framed specimen ===== */}
        <section
          aria-labelledby="example-heading"
          className="relative isolate overflow-hidden border-y border-sandstone bg-paper"
        >
          <Cosmos tone="light" shift="right" />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-5 lg:px-10">
            <Reveal className="lg:col-span-2">
              <Eyebrow>At a glance</Eyebrow>
              <h2
                id="example-heading"
                className="text-3xl font-semibold tracking-tight text-balance"
              >
                The items that need you, first.
              </h2>
              <p className="mt-4 text-graphite-soft">
                Out-of-stock and low-stock products rise to the top of your dashboard, with the
                quantity and threshold side by side, so you can act without digging.
              </p>
            </Reveal>
            <Reveal delay={120} className="lg:col-span-3">
              <figure
                aria-label="Example of the inventory attention list"
                className="overflow-hidden rounded-lg border border-sandstone bg-limestone shadow-[0_20px_40px_-24px_rgb(23_63_53/0.35)]"
              >
                <figcaption className="flex items-center gap-2 border-b border-sandstone px-4 py-2.5 text-xs font-semibold tracking-wide text-graphite-soft uppercase">
                  <span aria-hidden="true" className="size-2 rounded-full bg-copper" />
                  Example: what needs attention
                </figcaption>
                <Table caption="Example inventory attention list" className="min-w-0!">
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
            </Reveal>
          </div>
        </section>

        {/* ===== What it does: numbered boxes ===== */}
        <section aria-labelledby="principles-heading" className="relative isolate overflow-hidden">
          <Cosmos tone="light" shift="left" />
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-10">
            <Eyebrow>What it does</Eyebrow>
            <h2
              id="principles-heading"
              className="max-w-2xl text-3xl font-semibold tracking-tight text-balance"
            >
              Everything you need to keep stock honest.
            </h2>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {PRINCIPLES.map((p, i) => (
                <li key={p.title}>
                  <Reveal delay={i * 120} className="h-full">
                    <div className="group relative h-full overflow-hidden rounded-lg border border-sandstone bg-paper p-6 pt-8 transition-colors duration-300 hover:border-copper">
                      <span className="font-data absolute top-3 right-4 text-5xl font-medium text-sandstone transition-colors duration-300 group-hover:text-copper/40">
                        0{i + 1}
                      </span>
                      <div
                        className="h-px w-8 bg-copper transition-all duration-300 group-hover:w-16"
                        aria-hidden="true"
                      />
                      <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                      <p className="mt-2 text-sm text-graphite-soft">{p.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ===== The one rule: dark panel, three status boxes ===== */}
        <section
          aria-labelledby="rule-heading"
          className="relative isolate overflow-hidden border-y border-sandstone bg-paper"
        >
          <Cosmos tone="light" shift="right" comet />
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-10">
            <p className="text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">
              The one rule
            </p>
            <div className="mt-1.5 mb-4 h-px w-10 bg-copper" aria-hidden="true" />
            <h2
              id="rule-heading"
              className="max-w-2xl text-3xl font-semibold tracking-tight text-balance"
            >
              One definition of stock status, everywhere.
            </h2>
            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              {RULES.map((r, i) => (
                <Reveal key={r.status} delay={i * 100} className="h-full">
                  <div className="h-full rounded-lg border border-sandstone bg-limestone p-6 transition-colors hover:border-copper">
                    <dt>
                      <StatusBadge status={r.status} />
                    </dt>
                    <dd className="mt-4 text-sm text-graphite-soft">{r.body}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* ===== Closing call to action: cosmic ===== */}
        <section
          aria-labelledby="cta-heading"
          className="relative isolate overflow-hidden bg-forest text-white"
        >
          <Cosmos />
          <Reveal className="relative mx-auto max-w-3xl px-4 py-28 text-center sm:px-6">
            <h2
              id="cta-heading"
              className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
            >
              Give every product a clear status.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-white/75">
              Set up your organization in a minute and see what needs attention today.
            </p>
            <div className="mt-9 flex justify-center">
              <Link
                to={user ? '/dashboard' : '/signup'}
                className="inline-flex h-11 items-center rounded-md bg-copper px-7 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
              >
                {user ? 'Open dashboard' : 'Get started'}
              </Link>
            </div>
          </Reveal>
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
