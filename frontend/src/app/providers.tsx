/**
 * FILE: frontend/src/app/providers.tsx
 * PURPOSE: Wraps the app in the QueryClient and Toast providers; hosts the cold-start notice.
 * LAYER: App wiring
 * USED BY: App.tsx
 */
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ServerWakingNotice } from '../components/server-waking-notice';
import { ToastProvider } from '../components/ui/toast';
import { createQueryClient } from './query-client';

/** `client` is injectable so tests can inspect and control the cache. */
export function Providers({
  children,
  client: injected,
}: {
  children: ReactNode;
  client?: QueryClient;
}) {
  const [created] = useState(createQueryClient); // one client per mount
  const client = injected ?? created;
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        {children}
        <ServerWakingNotice />
      </ToastProvider>
    </QueryClientProvider>
  );
}
