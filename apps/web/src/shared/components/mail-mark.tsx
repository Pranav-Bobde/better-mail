"use client";

import * as React from "react";

/*
 * The Mail brand mark — "Sheen" (08): a static "M" with a band of light passing
 * through the stroke like a reflection sliding over brushed metal. The glyph
 * never moves; the sheen is an animated gradient sweeping across (2s, SMIL),
 * exactly per the logo ideation. Uses currentColor, so set text color on a
 * parent (e.g. `text-foreground`). Under prefers-reduced-motion it renders a
 * solid, static M with no sweep. Shared: wordmark, loader, etc.
 */
const M_PATH = "M5.5 17.5V6.5L12 14L18.5 6.5V17.5";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function MailMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Mail"
      fill="none"
    >
      <defs>
        <linearGradient id="mm-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          {reduced ? null : (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-1.2 0"
              to="1.2 0"
              dur="2s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
      </defs>
      <path
        d={M_PATH}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={reduced ? 1 : 0.3}
      />
      {reduced ? null : (
        <path
          d={M_PATH}
          stroke="url(#mm-sheen)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
