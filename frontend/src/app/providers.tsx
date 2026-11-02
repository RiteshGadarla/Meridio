/**
 * FILE: frontend/src/app/providers.tsx
 * PURPOSE: Wraps the app in the QueryClient and Toast providers.
 * LAYER: App wiring
 * USED BY: App.tsx
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '../components/ui/toast';
import { createQueryClient } from './query-client';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient); // one client per mount
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
