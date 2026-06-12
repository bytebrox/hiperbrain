/**
 * Minimal, premium page backdrop rendered behind all content (fixed, -z-10):
 * a deep-black base (set on <html>), a soft radial cyan/violet aura sitting
 * roughly where the hero brain glows, and a fine film grain on top. No moving
 * particles - the only animated element on the page is the brain itself.
 */
export function BackgroundFX() {
  return (
    <>
      <div aria-hidden className="bg-aura" />
      <div aria-hidden className="bg-grain" />
    </>
  );
}
