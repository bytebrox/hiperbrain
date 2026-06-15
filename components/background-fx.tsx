/**
 * Two-colour screen-print backdrop rendered behind all content (fixed, -z-10):
 * near-black paper (base set on <html>), a faint cyan ink wash + heavy vignette
 * (.bg-aura), a printed dot-screen concentrated around the hero (.bg-halftone)
 * and coarse paper grain on top (.bg-grain). All static - the only animated
 * element on the page is the brain itself.
 */
export function BackgroundFX() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[-20] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/bg.webp')" }}
      />
      {/* Darkening wash over the image so content stays readable. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[-19] bg-black/80" />
      <div aria-hidden className="bg-aura" />
      <div aria-hidden className="bg-halftone" />
      <div aria-hidden className="bg-grain" />
    </>
  );
}
