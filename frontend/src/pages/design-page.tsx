/**
 * FILE: frontend/src/pages/design-page.tsx
 * PURPOSE: DEV-ONLY living style guide at /design: every token, component and state in one place.
 * LAYER: Page (development tool)
 * USED BY: app/routes.tsx (lazy, only when import.meta.env.DEV)
 * NOTES: The sample values below are style-guide specimens, not application data. This module is
 *        not part of the production bundle.
 */
import type { StockStatus } from '@meridio/contracts';
import { useState, type ReactNode } from 'react';
import { StatusBadge, Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Drawer } from '../components/ui/drawer';
import { Field, Input, Select, Textarea } from '../components/ui/form';
import { MetricSkeleton, Skeleton, TableSkeleton } from '../components/ui/skeleton';
import { EmptyState, ErrorState } from '../components/ui/states';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/table';
import { useToast } from '../components/ui/toast';
import { LogoMark } from '../components/logo';
import { PageHeader } from '../layouts/page-header';
import { formatCurrency } from '../lib/format';

const SWATCHES = [
  ['forest', 'bg-forest', '#173F35'],
  ['limestone', 'bg-limestone border border-sandstone', '#F3F1E9'],
  ['copper', 'bg-copper', '#C46B48'],
  ['sage', 'bg-sage', '#DCE7D8'],
  ['graphite', 'bg-graphite', '#202923'],
  ['sandstone', 'bg-sandstone', '#E8DDD1'],
  ['status-healthy', 'bg-status-healthy', '#438365'],
  ['status-low', 'bg-status-low', '#BD7737'],
  ['status-out', 'bg-status-out', '#B74E43'],
] as const;

const STATUSES: StockStatus[] = ['HEALTHY', 'LOW_STOCK', 'OUT_OF_STOCK'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 border-b border-sandstone pb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState(false);
  const toast = useToast();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        eyebrow="Design system"
        title="StockFlow style guide"
        description="Development only. Every token, primitive and state used by the application."
        action={<Button>Primary action</Button>}
      />

      <Section title="Palette">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {SWATCHES.map(([name, cls, hex]) => (
            <div key={name}>
              <div className={`h-14 rounded-sm ${cls}`} />
              <p className="mt-1.5 text-xs font-medium">{name}</p>
              <p className="font-data text-xs text-graphite-soft">{hex}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <p className="text-3xl font-semibold tracking-tight">DM Sans heading</p>
        <p className="mt-2 text-sm">Interface text in DM Sans, graphite on limestone.</p>
        <p className="font-data mt-2 text-sm">
          KEY-001 · 1,240 units · $89.99 (IBM Plex Mono, tabular)
        </p>
        <LogoMark className="mt-4" />
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid max-w-md gap-4">
          <Field label="SKU" required hint="Letters, digits, dots and dashes.">
            {(p) => <Input mono placeholder="KEY-001" {...p} />}
          </Field>
          <Field label="Quantity" error="Quantity must be zero or positive">
            {(p) => <Input mono defaultValue="-3" {...p} />}
          </Field>
          <Field label="Description">{(p) => <Textarea {...p} />}</Field>
          <Field label="Sort by">
            {(p) => (
              <Select {...p}>
                <option>Newest</option>
                <option>Name</option>
              </Select>
            )}
          </Field>
          <Input disabled value="Disabled" readOnly />
        </div>
      </Section>

      <Section title="Status and badges">
        <div className="flex flex-wrap items-center gap-3">
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
          <Badge>14 products</Badge>
        </div>
      </Section>

      <Section title="Table">
        <Table caption="Specimen products">
          <THead>
            <TR>
              <TH>Product</TH>
              <TH>SKU</TH>
              <TH numeric>Quantity</TH>
              <TH>Status</TH>
              <TH numeric>Price</TH>
            </TR>
          </THead>
          <TBody>
            {[
              ['Mechanical Keyboard', 'KEY-001', 120, 'HEALTHY', '89.99'],
              ['USB-C Hub', 'HUB-014', 4, 'LOW_STOCK', '39.5'],
              ['Desk Lamp', 'LMP-220', 0, 'OUT_OF_STOCK', null],
            ].map(([name, sku, qty, status, price]) => (
              <TR key={String(sku)}>
                <TD className="font-medium">{name}</TD>
                <TD mono>{sku}</TD>
                <TD numeric>{qty}</TD>
                <TD>
                  <StatusBadge status={status as StockStatus} />
                </TD>
                <TD numeric>{formatCurrency(price as string | null)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section title="Loading, empty and error">
        <div className="grid gap-6">
          <div className="grid grid-cols-3 gap-6">
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </div>
          <TableSkeleton rows={3} columns={5} />
          <Skeleton className="h-4 w-48" />
          <EmptyState
            title="No products yet"
            description="Add your first product to start tracking stock."
            action={<Button>Add product</Button>}
          />
          <ErrorState
            message="We could not load your products."
            onRetry={() => toast.success('Retrying')}
          />
        </div>
      </Section>

      <Section title="Overlays and toasts">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            Open drawer
          </Button>
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Open confirm dialog
          </Button>
          <Button variant="ghost" onClick={() => toast.success('Product saved')}>
            Success toast
          </Button>
          <Button variant="ghost" onClick={() => toast.error('Could not save product')}>
            Error toast
          </Button>
        </div>
      </Section>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Edit product"
        description="Right-hand drawer on desktop, full screen on mobile."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDrawer(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDrawer(false)}>Save</Button>
          </div>
        }
      >
        <Field label="Name">{(p) => <Input {...p} />}</Field>
      </Drawer>
      <ConfirmDialog
        open={dialog}
        title="Delete this product?"
        description="This permanently removes the product and cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDialog(false)}
        onConfirm={() => setDialog(false)}
      />
    </main>
  );
}
