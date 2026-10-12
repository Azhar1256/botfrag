const UNITS = [
  ['y', 365 * 864e5],
  ['mo', 30 * 864e5],
  ['w', 7 * 864e5],
  ['d', 864e5],
  ['h', 36e5],
  ['m', 6e4],
];

export const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  for (const [unit, ms] of UNITS) {
    if (diff >= ms) return `${Math.floor(diff / ms)}${unit}`;
  }
  return 'now';
};

export const fullDate = (date) =>
  new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

export const compact = (n) => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n ?? 0);

// A stable colour per game, so cards without images still look distinct.
export const hueOf = (s = '') => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export const gameGradient = (slug) => {
  const h = hueOf(slug);
  return `linear-gradient(135deg, hsl(${h} 70% 28%), hsl(${(h + 50) % 360} 80% 14%))`;
};

export const scoreTone = (r) => (r >= 8 ? 'great' : r >= 5 ? 'mixed' : 'poor');

// Mirrors the server's slugify so links to game pages match.
export const slugifyGame = (s) =>
  s.toLowerCase().trim().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
