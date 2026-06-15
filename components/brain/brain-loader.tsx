/**
 * CSS-only loading animation shown while the shared brain is fetched and
 * assembled. Styled to match the canvas's screen-print look: a flat grid of
 * cyan halftone dots that swell in a diagonal wave - no neon glow or blur.
 */
const GRID = 5;
const DOTS = Array.from({ length: GRID * GRID }, (_, i) => ({
  row: Math.floor(i / GRID),
  col: i % GRID,
}));

export function BrainLoader({ label = "waking up the shared brain…" }: { label?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${GRID}, 0.5rem)` }}
        aria-hidden
      >
        {DOTS.map(({ row, col }, i) => {
          // Diagonal wave: dots further down-right start a touch later, so the
          // swell sweeps across the matrix like ink building up on the screen.
          const delay = (row + col) * 0.09;
          // Edge dots read slightly dimmer, hinting at the halftone falloff.
          const edge = Math.max(Math.abs(row - 2), Math.abs(col - 2));
          return (
            <span
              key={i}
              className="halftone-dot h-2 w-2 rounded-full bg-accent"
              style={{ animationDelay: `${delay}s`, opacity: 1 - edge * 0.12 }}
            />
          );
        })}
      </div>
      <p className="font-mono text-xs tracking-wide text-muted">{label}</p>
    </div>
  );
}
