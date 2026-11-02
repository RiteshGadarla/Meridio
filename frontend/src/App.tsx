/**
 * FILE: frontend/src/App.tsx
 * PURPOSE: Root component: providers + browser router + route table.
 * LAYER: UI
 * USED BY: main.tsx
 * DEPENDS ON: app/providers.tsx, app/routes.tsx
 */
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './app/providers';
import { AppRoutes } from './app/routes';

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  );
}
