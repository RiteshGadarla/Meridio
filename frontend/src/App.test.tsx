/**
 * FILE: frontend/src/App.test.tsx
 * PURPOSE: Verifies the placeholder page renders and the contracts workspace link resolves in web.
 * LAYER: Test
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

// Protects: the SPA boots and the shared package is importable from the web app.
describe('<App />', () => {
  it('shows StockFlow', () => {
    render(<App />);
    expect(screen.getByText('StockFlow')).toBeInTheDocument();
  });
});
