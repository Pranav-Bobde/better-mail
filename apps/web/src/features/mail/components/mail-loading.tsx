import { cn } from "@code-main/ui/lib/utils";

import { MailMark } from "@/shared/components/mail-mark";

// Loading state: the brand "M" mark with its sheen sweeping on a loop. The
// glyph is static; the band of light passing through it signals activity.
export function MailLoading({ className }: { readonly className?: string }) {
  return (
    <div
      aria-label="Loading"
      className={cn("flex h-full w-full items-center justify-center bg-background", className)}
      role="status"
    >
      <MailMark size={120} className="text-foreground" />
    </div>
  );
}
