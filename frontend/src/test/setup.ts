/**
 * FILE: frontend/src/test/setup.ts
 * PURPOSE: Vitest setup: adds jest-dom matchers and unmounts rendered trees between tests.
 * LAYER: Test config
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// WHY: globals are off, so RTL's automatic cleanup is not registered; do it explicitly.
afterEach(() => cleanup());
