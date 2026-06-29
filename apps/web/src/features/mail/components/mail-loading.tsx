import { cn } from "@code-main/ui/lib/utils";

// Refined draw animation with smooth easing and better visual feedback.
// The animation: draws the M stroke (0-60%), holds steady (60-80%), 
// clears/resets (80-100%), then loops. Uses cubic-bezier for smoother motion.
const mLoaderStyles = `
@keyframes mail-loader-draw {
  0% { 
    stroke-dashoffset: 100;
    opacity: 0.6;
  }
  15% {
    opacity: 1;
  }
  60% { 
    stroke-dashoffset: 0;
    opacity: 1;
  }
  80% { 
    stroke-dashoffset: 0;
    opacity: 1;
  }
  100% { 
    stroke-dashoffset: -100;
    opacity: 0.6;
  }
}

.mail-loader-path {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: mail-loader-draw 2s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
  paint-order: stroke;
}

.mail-loader-glow {
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.08));
}

@media (prefers-reduced-motion: reduce) {
  .mail-loader-path { 
    animation: none; 
    stroke-dashoffset: 0;
    opacity: 1;
  }
}
`;

// Minimal, clean loading animation: the "M" mark drawn in a single continuous stroke.
// The path flows left bar → middle V → right bar, animating with smooth easing.
// Includes subtle opacity breathing and drop shadow for polish.
export function MailLoading({ className }: { readonly className?: string }) {
  return (
    <div
      aria-label="Loading"
      className={cn("flex h-full w-full items-center justify-center bg-background", className)}
      role="status"
    >
      <style>{mLoaderStyles}</style>
      <svg 
        aria-hidden="true" 
        className="mail-loader-glow size-40 text-foreground" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <path
          className="mail-loader-path"
          d="M6 16L6 6L12 13L18 6L18 16"
          pathLength={100}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.2}
        />
      </svg>
    </div>
  );
}
