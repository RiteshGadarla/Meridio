/**
 * FILE: frontend/src/components/ui/ui.test.tsx
 * PURPOSE: Behaviour tests for the design-system primitives.
 * LAYER: Test (React Testing Library)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StatusBadge } from './badge';
import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';
import { Drawer } from './drawer';
import { Field, Input } from './form';
import { MetricSkeleton, Skeleton, TableSkeleton } from './skeleton';
import { EmptyState, ErrorState } from './states';
import { ToastProvider, useToast } from './toast';

// Protects: status is never communicated by colour alone.
describe('StatusBadge', () => {
  it.each([
    ['HEALTHY', 'Healthy'],
    ['LOW_STOCK', 'Low stock'],
    ['OUT_OF_STOCK', 'Out of stock'],
  ] as const)('%s shows the text "%s" and its own marker shape', (status, label) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(`svg[data-marker="${status}"]`)).toBeInTheDocument();
  });

  it('uses a different marker shape for each status', () => {
    const shapes = (['HEALTHY', 'LOW_STOCK', 'OUT_OF_STOCK'] as const).map((s) => {
      const { container, unmount } = render(<StatusBadge status={s} />);
      const html = container.querySelector('svg')!.innerHTML;
      unmount();
      return html;
    });
    expect(new Set(shapes).size).toBe(3);
  });
});

// Protects: a loading/disabled button can never fire a duplicate submit.
describe('Button', () => {
  it('loading blocks clicks and sets aria-busy', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled is not clickable; enabled fires once; defaults to type=button', async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    rerender(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Field', () => {
  // Protects: errors are announced and tied to their input.
  it('links the label, error and input and marks the input invalid', () => {
    render(
      <Field label="SKU" error="SKU taken">
        {(p) => <Input {...p} />}
      </Field>,
    );
    const input = screen.getByLabelText('SKU');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('SKU taken');
    expect(screen.getByRole('alert')).toHaveTextContent('SKU taken');
  });
});

describe('ConfirmDialog', () => {
  // Protects: keyboard users can safely answer, and callbacks fire exactly once.
  it('moves focus inside, closes on Escape, and fires confirm/cancel once', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete?"
        description="Gone forever"
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Delete?' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus(); // safe default

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="x"
        description="y"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('Drawer', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <button>Outside</button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Edit product">
          <input aria-label="Name" />
        </Drawer>
      </>
    );
  }

  // Protects: modal accessibility (focus trap, Escape, focus restoration, scroll lock).
  it('opens, traps focus, closes on Escape and restores focus to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(trigger);

    const drawer = screen.getByRole('dialog', { name: 'Edit product' });
    expect(drawer).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    // Tab through: close button -> input -> (wraps) close button; focus never leaves the drawer.
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(drawer).toContainElement(document.activeElement as HTMLElement);
    }

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
  });

  it('closes from the close button', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('states and skeletons', () => {
  it('EmptyState shows title, description and action', () => {
    render(
      <EmptyState title="No products yet" description="Add one." action={<button>Add</button>} />,
    );
    expect(screen.getByRole('heading', { name: 'No products yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('ErrorState announces the message and calls retry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Could not load" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('Skeleton, TableSkeleton and MetricSkeleton render with a busy status', () => {
    const { container } = render(
      <>
        <Skeleton className="h-4" />
        <TableSkeleton rows={2} columns={3} />
        <MetricSkeleton />
      </>,
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(screen.getAllByRole('status', { name: 'Loading' })).toHaveLength(2);
  });
});

describe('Toast', () => {
  function Trigger() {
    const toast = useToast();
    return (
      <>
        <button onClick={() => toast.success('Saved')}>ok</button>
        <button onClick={() => toast.error('Failed')}>bad</button>
      </>
    );
  }

  // Protects: feedback is announced to assistive tech (polite for success, assertive for errors).
  it('announces success politely and errors assertively, and can be dismissed', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'ok' }));
    await userEvent.click(screen.getByRole('button', { name: 'bad' }));
    expect(screen.getByText('Saved').closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Failed').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'assertive',
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[0]!);
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});
