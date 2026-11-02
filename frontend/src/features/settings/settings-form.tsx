/**
 * FILE: frontend/src/features/settings/settings-form.tsx
 * PURPOSE: The "Inventory Defaults" form: the default low-stock threshold and the display currency.
 * LAYER: Feature UI
 * USED BY: pages/settings-page.tsx
 * DEPENDS ON: @meridio/contracts (updateSettingsSchema), react-hook-form
 * NOTES: The input is text so invalid entries (empty, decimal, letters) can be shown with the shared
 *        schema's messages instead of being silently coerced by the browser. Save stays disabled
 *        until the value is changed AND valid.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CURRENCIES,
  updateSettingsSchema,
  type Currency,
  type SettingsDto,
} from '@meridio/contracts';
import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Field, Input, Select } from '../../components/ui/form';
import { useToast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api-client';
import { useUpdateSettings } from './hooks';

interface FormValues {
  defaultLowStockThreshold: string;
  currency: Currency;
}

/** Dropdown labels: major currencies with their symbol, so the choice is recognisable. */
const CURRENCY_LABELS: Record<Currency, string> = {
  INR: 'INR – Indian Rupee (₹)',
  USD: 'USD – US Dollar ($)',
  EUR: 'EUR – Euro (€)',
  GBP: 'GBP – British Pound (£)',
  JPY: 'JPY – Japanese Yen (¥)',
  AUD: 'AUD – Australian Dollar (A$)',
  CAD: 'CAD – Canadian Dollar (C$)',
  CHF: 'CHF – Swiss Franc (CHF)',
  CNY: 'CNY – Chinese Yuan (CN¥)',
  SGD: 'SGD – Singapore Dollar (S$)',
  AED: 'AED – UAE Dirham (AED)',
};

// WHY a piped schema: convert the typed string to a number first, then validate with the SHARED
// schema, so the rules and messages exist in one place only.
const formSchema = z
  .custom<FormValues>()
  .transform(
    (v) =>
      ({
        // undefined (empty field) lets the shared schema report "Threshold must be a number".
        defaultLowStockThreshold:
          v.defaultLowStockThreshold.trim() === '' ? undefined : Number(v.defaultLowStockThreshold),
        currency: v.currency,
      }) as z.input<typeof updateSettingsSchema>,
  )
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
    defaultValues: {
      defaultLowStockThreshold: String(settings.defaultLowStockThreshold),
      currency: settings.currency,
    },
  });

  const onSubmit = handleSubmit(async (validated) => {
    setSaved(false);
    const { defaultLowStockThreshold, currency } = validated as unknown as {
      defaultLowStockThreshold: number;
      currency: Currency;
    };
    try {
      const result = await update.mutateAsync({ defaultLowStockThreshold, currency });
      reset({
        defaultLowStockThreshold: String(result.defaultLowStockThreshold),
        currency: result.currency,
      }); // pristine again
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

      <div className="mt-5">
        <Field
          label="Currency"
          error={errors.currency?.message}
          hint="Used to display cost and selling prices everywhere. Prices are not converted: only the symbol and formatting change."
        >
          {(p) => (
            <Select {...p} {...register('currency', { onChange: () => setSaved(false) })}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

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
