/**
 * FILE: frontend/src/components/avatar.tsx
 * PURPOSE: Profile picture / organization mark. A photo when there is one; otherwise the stored
 *          gradient tile (letter for people, symbol for organizations); and when nothing is stored
 *          (older rows), white letter on black.
 * LAYER: UI
 * USED BY: layouts/app-shell.tsx, pages/google-organization-page.tsx
 * DEPENDS ON: @meridio/contracts (AvatarStyle)
 * NOTES: WHY referrerPolicy="no-referrer": Google's avatar host can refuse requests that carry
 *        another site's Referer. SECURITY: the gradient colours come from the database, so they are
 *        checked against a strict pattern before reaching a style attribute.
 */
import type { AvatarStyle, AvatarSymbol } from '@meridio/contracts';
import {
  Boxes,
  Container,
  Factory,
  Layers,
  Package,
  ShoppingBag,
  Store,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/cn';

const SYMBOL_ICONS: Record<AvatarSymbol, LucideIcon> = {
  boxes: Boxes,
  package: Package,
  warehouse: Warehouse,
  store: Store,
  factory: Factory,
  layers: Layers,
  container: Container,
  'shopping-bag': ShoppingBag,
};

const COLOR_PATTERN = /^hsl\(\d{1,3} \d{1,3}% \d{1,3}%\)$/;

/** True when the stored value is safe and complete enough to render as a gradient. */
function isRenderable(avatar: AvatarStyle | null | undefined): avatar is AvatarStyle {
  return (
    !!avatar &&
    COLOR_PATTERN.test(avatar.from) &&
    COLOR_PATTERN.test(avatar.to) &&
    Number.isFinite(avatar.angle)
  );
}

/**
 * @param name used for the initial and (for people) the letter shown
 * @param pictureUrl photo URL; null/undefined falls back to the tile
 * @param avatar stored gradient + symbol; null renders white-on-black
 * @param variant "user" = first letter; "organization" = the stored symbol
 * @example <Avatar name="Ada Lovelace" pictureUrl={user.pictureUrl} avatar={user.avatar} />
 * @example <Avatar variant="organization" name="Spirit and Co" avatar={org.avatar} />
 */
export function Avatar({
  name,
  pictureUrl,
  avatar,
  variant = 'user',
  className,
}: {
  name: string;
  pictureUrl?: string | null;
  avatar?: AvatarStyle | null;
  variant?: 'user' | 'organization';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const base = cn('size-10 shrink-0 rounded-sm', className);
  if (pictureUrl && !failed) {
    return (
      <img
        src={pictureUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn(base, 'bg-sandstone object-cover')}
      />
    );
  }

  const styled = isRenderable(avatar);
  const Icon = styled && variant === 'organization' ? SYMBOL_ICONS[avatar.symbol] : undefined;
  return (
    <span
      aria-hidden="true"
      style={
        styled
          ? { backgroundImage: `linear-gradient(${avatar.angle}deg, ${avatar.from}, ${avatar.to})` }
          : undefined
      }
      className={cn(
        base,
        'flex items-center justify-center text-base font-semibold text-white uppercase',
        !styled && 'bg-black', // no stored look: white letter on black
      )}
    >
      {Icon ? <Icon className="size-1/2" strokeWidth={1.75} /> : name.trim().charAt(0) || '?'}
    </span>
  );
}
