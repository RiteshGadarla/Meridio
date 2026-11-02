/**
 * FILE: frontend/src/features/products/search-input.tsx
 * PURPOSE: Debounced search box (300ms) bound to a URL value.
 * LAYER: Feature UI
 * USED BY: pages/products-page.tsx
 */
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '../../components/ui/form';

const DEBOUNCE_MS = 300;

export function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [text, setText] = useState(value);

  // Keep in sync when the URL changes from outside (back button, "Clear search"). Adjusting state
  // during render (not in an effect) avoids a wasted extra render with stale text.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) return;
    const id = setTimeout(() => onChange(text), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text, value, onChange]);

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-3 left-3 size-4 text-graphite-soft"
      />
      <Input
        type="search"
        aria-label="Search products by name or SKU"
        placeholder="Search name or SKU"
        className="pr-9 pl-9"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setText('');
            onChange('');
          }}
          className="absolute top-2.5 right-2.5 rounded-xs text-graphite-soft hover:text-graphite"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
