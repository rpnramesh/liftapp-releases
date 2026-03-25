// ── FORMATTERS ───────────────────────────────────────────
// Shared helper functions for formatting time values.

// Formats elapsed seconds into h:mm:ss or m:ss
export const formatElapsed = (s) => {
  if (!s) return '0:00';
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
};

// Formats seconds into m:ss (used for rest timers)
export const formatRest = (s) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Formats milliseconds into m:ss (used for video player)
export const formatMs = (ms) => {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};