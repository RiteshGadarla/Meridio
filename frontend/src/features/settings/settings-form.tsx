/**
 * FILE: frontend/src/features/settings/settings-form.tsx
 * PURPOSE: The "Inventory Defaults" form: one field, the default low-stock threshold.
 * LAYER: Feature UI
 * USED BY: pages/settings-page.tsx
 * DEPENDS ON: @meridio/contracts (updateSettingsSchema), react-hook-form
 * NOTES: The input is text so invalid entries (empty, decimal, letters) can be shown with the shared
 *        schema's messages instead of being silently coerced by the browser. Save stays disabled
 *        until the value is changed AND valid.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { updateSettingsSchema, type SettingsDto } from '@meridio/contracts';
import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/form';
import { useToast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api-client';
import { useUpdateSettings } from './hooks';

interface FormValues {
  defaultLowStockThreshold: string;
}

// WHY a piped schema: convert the typed string to a number first, then validate with the SHARED
// schema, so the rules and messages exist in one place only.
const formSchema = z
  .custom<FormValues>()
  .transform((v) => ({
    defaultLowStockThreshold:
      v.defaultLowStockThreshold.trim() === '' ? undefined : Number(v.defaultLowStockThreshold),
  }))
  .pipe(updateSettingsSchema);

const blockNonInteger = (e: KeyboardEvent<HTMLInputElement>) => {
  if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
};

export function SettingsForm({ settings }: { settings: SettingsDto }) {
  const update = useUpdateSettings();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    mode: 'onChange',
    defaultValues: { defaultLowStockThreshold: String(settings.defaultLowStockThreshold) },
  });

  const onSubmit = handleSubmit(async (validated) => {
    setSaved(false);
    const { defaultLowStockThreshold } = validated as unknown as {
      defaultLowStockThreshold: number;
    };
    try {
      const result = await update.mutateAsync({ defaultLowStockThreshold });
      reset({ defaultLowStockThreshold: String(result.defaultLowStockThreshold) }); // pristine again
      setSaved(true);
      toast.success('Settings saved');
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
      const fieldMessage =
        error instanceof ApiError ? error.fieldErrors?.defaultLowStockThreshold : undefined;
      if (fieldMessage) setError('defaultLowStockThreshold', { message: fieldMessage });
      else setError('root', { message });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md">
      {errors.root?.message && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-status-out/40 bg-status-out-tint/50 px-3 py-2 text-sm"
        >
          {errors.root.message}
        </p>
      )}

      <Field
        label="Default low-stock threshold"
        error={errors.defaultLowStockThreshold?.message}
        hint="A product is low stock when its quantity is at or below its threshold. Products with their own threshold override this default."
      >
        {(p) => (
          <Input
            mono
            type="text"
            inputMode="numeric"
            onKeyDown={blockNonInteger}
            {...p}
            {...register('defaultLowStockThreshold', { onChange: () => setSaved(false) })}
          />
        )}
      </Field>

      <div className="mt-5 flex items-center gap-4">
        <Button type="submit" disabled={!isDirty || !isValid} loading={update.isPending}>
          Save changes
        </Button>
        <p role="status" className="text-sm text-status-healthy">
          {saved ? 'Saved' : ''}
        </p>
      </div>
    </form>
  );
}
