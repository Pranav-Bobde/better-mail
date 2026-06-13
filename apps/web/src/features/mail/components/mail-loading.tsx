import { cn } from "@code-main/ui/lib/utils";

// The draw animation is injected as a literal <style> element (raw runtime CSS)
// rather than going through Tailwind/index.css, so it is guaranteed to apply.
// stroke-dashoffset runs 100 → 0 (draws the M) → hold → -100 (clears) and loops.
const mLoaderStyles = `
@keyframes mail-loader-draw {
  0% { stroke-dashoffset: 100; }
  55% { stroke-dashoffset: 0; }
  75% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -100; }
}
.mail-loader-path {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: mail-loader-draw 1.8s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .mail-loader-path { animation: none; stroke-dashoffset: 0; }
}
`;

// Minimal loading state: the "M" mark drawn stroke by stroke on a loop. The path
// is one continuous polyline — left bar → middle V → right bar — so it draws the
// way you'd write an M by hand.
export function MailLoading({ className }: { readonly className?: string }) {
  return (
    <div
      aria-label="Loading"
      className={cn("flex h-full w-full items-center justify-center bg-background", className)}
      role="status"
    >
      <style>{mLoaderStyles}</style>
      <svg aria-hidden="true" className="size-40 text-foreground" fill="none" viewBox="0 0 24 24">
        <path
          className="mail-loader-path"
          d="M6 16L6 6L12 13L18 6L18 16"
          pathLength={100}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={0.6}
        />
      </svg>
    </div>
  );
}
