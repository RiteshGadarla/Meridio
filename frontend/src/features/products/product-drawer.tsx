/**
 * FILE: frontend/src/features/products/product-drawer.tsx
 * PURPOSE: Add/edit drawer driven by the URL: ?new=1 opens create, ?edit=ID opens edit.
 * LAYER: Feature UI
 * USED BY: pages/products-page.tsx
 * DEPENDS ON: ui/drawer, product-form.tsx, hooks.ts, features/auth (org default threshold)
 * NOTES: Closing with unsaved changes asks for confirmation. Edit mode handles a product that no
 *        longer exists (404) with a friendly message instead of an empty form.
 */
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Drawer } from '../../components/ui/drawer';
import { Skeleton } from '../../components/ui/skeleton';
import { ErrorState } from '../../components/ui/states';
import { useToast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api-client';
import { useCurrentUser } from '../auth/hooks';
import { PRODUCT_FORM_ID, ProductForm } from './product-form';
import { useCreateProduct, useProduct, useUpdateProduct } from './hooks';

export function ProductDrawer() {
  const [params, setParams] = useSearchParams();
  const editId = params.get('edit') ?? undefined;
  const isCreate = params.get('new') === '1';
  const open = isCreate || Boolean(editId);

  const { data: user } = useCurrentUser();
  const orgDefault = user?.organization.defaultLowStockThreshold ?? 0;
  const toast = useToast();
  const product = useProduct(editId);
  const create = useCreateProduct();
  const update = useUpdateProduct();

  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const close = useCallback(() => {
    setConfirmDiscard(false);
    setDirty(false);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('new');
        next.delete('edit');
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  const requestClose = () => (dirty ? setConfirmDiscard(true) : close());

  const notFound = product.error instanceof ApiError && product.error.status === 404;
  const formReady = isCreate || Boolean(product.data);

  return (
    <>
      <Drawer
        open={open}
        // While the discard prompt is up, Escape/backdrop must not stack another prompt.
        onClose={confirmDiscard ? () => undefined : requestClose}
        title={isCreate ? 'Add product' : 'Edit product'}
        description={isCreate ? 'Add an item to your catalogue.' : product.data?.sku}
        footer={
          formReady ? (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={requestClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" form={PRODUCT_FORM_ID} loading={submitting}>
                {isCreate ? 'Add product' : 'Save changes'}
              </Button>
            </div>
          ) : undefined
        }
      >
        {editId && product.isPending && (
          <div role="status" aria-busy="true" aria-label="Loading product" className="grid gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {notFound && (
          <div role="alert" className="rounded-sm border border-sandstone px-4 py-5 text-sm">
            <p className="font-medium">This product no longer exists.</p>
            <p className="mt-1 text-graphite-soft">
              It may have been deleted. Close this panel to return to the list.
            </p>
          </div>
        )}
        {product.isError && !notFound && (
          <ErrorState
            message="We could not load this product."
            onRetry={() => void product.refetch()}
          />
        )}
        {formReady && (
          <ProductForm
            // key: a different product must start from a fresh form, never reuse another's state.
            key={editId ?? 'new'}
            product={isCreate ? undefined : product.data}
            orgDefaultThreshold={orgDefault}
            onDirtyChange={setDirty}
            onSubmittingChange={setSubmitting}
            onCreate={async (input) => {
              await create.mutateAsync(input);
              toast.success('Product added');
              close();
            }}
            onUpdate={async (changes) => {
              if (Object.keys(changes).length === 0) return close(); // EDGE CASE: nothing changed
              await update.mutateAsync({ id: editId as string, changes });
              toast.success('Product updated');
              close();
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        description="You have unsaved changes. If you close now they will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={close}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
