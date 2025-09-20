export function generateProjectionAngles(count: number): number[] {
  const clamped = Math.max(1, Math.floor(count));
  const step = 180 / clamped;
  return Array.from({ length: clamped }, (_, i) => i * step);
}

export function nextAngle(current: number, stepDegrees: number): number {
  const step = Math.max(0.5, stepDegrees);
  const next = (current + step) % 180;
  return next;
}

