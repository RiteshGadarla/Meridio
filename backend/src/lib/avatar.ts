/**
 * FILE: backend/src/lib/avatar.ts
 * PURPOSE: Picks a random gradient and symbol for a new avatar. The result is stored in the
 *          database, so it is random once and then stable forever.
 * LAYER: Lib (pure)
 * USED BY: modules/auth/auth.service.ts, prisma seed
 * DEPENDS ON: node:crypto, @meridio/contracts (AVATAR_SYMBOLS)
 * NOTES: Colours are medium-dark so white letters/symbols keep contrast on any hue.
 */
import { randomInt } from 'node:crypto';
import { AVATAR_SYMBOLS, type AvatarStyle } from '@meridio/contracts';

/**
 * @returns a fresh random avatar look
 * @example prisma.organization.create({ data: { name, avatar: generateAvatar() } })
 */
export function generateAvatar(): AvatarStyle {
  const hue = randomInt(0, 360);
  const hue2 = (hue + randomInt(40, 90)) % 360; // a nearby but distinct second hue
  return {
    from: `hsl(${hue} 62% 42%)`,
    to: `hsl(${hue2} 66% 34%)`,
    angle: randomInt(120, 210),
    symbol: AVATAR_SYMBOLS[randomInt(0, AVATAR_SYMBOLS.length)]!,
  };
}
