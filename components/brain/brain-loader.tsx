/**
 * Lightweight, CSS-only loading animation shown while the shared brain is being
 * fetched and assembled. Themed to match the canvas (cyan/violet neuron glow).
 */
export function BrainLoader({ label = "waking up the shared brain…" }: { label?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5">
      <div className="relative h-20 w-20">
        {/* soft halo */}
        <span className="absolute inset-0 animate-pulse rounded-full bg-accent/20 blur-xl" />
        {/* expanding rings */}
        <span className="absolute inset-0 animate-ping rounded-full border border-accent/40" />
        <span className="absolute inset-2 animate-ping rounded-full border border-accent-2/40 [animation-delay:300ms]" />
        {/* orbiting neurons */}
        <span className="absolute inset-0 animate-spin [animation-duration:2.4s]">
          <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_10px_2px_var(--color-accent)]" />
        </span>
        <span className="absolute inset-0 animate-spin [animation-direction:reverse] [animation-duration:3.6s]">
          <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent-2 shadow-[0_0_8px_2px_var(--color-accent-2)]" />
        </span>
        {/* core */}
        <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/90" />
      </div>
      <p className="font-mono text-xs text-muted">{label}</p>
    </div>
  );
}
