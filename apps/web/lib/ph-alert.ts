export function nextLowPhAlert(previous: boolean, ph: number | null, available: boolean) {
  if (!available || ph === null || !Number.isFinite(ph)) return false;
  // Hysteresis prevents repeated alerts when samples hover around the boundary.
  return previous ? ph < 6.6 : ph < 6.5;
}
