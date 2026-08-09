import { cookies } from "next/headers";
import { Suspense } from "react";
import { z } from "zod";

import { DemoBanner } from "@/features/mail/components/demo-banner";
import { HealthProbe } from "@/features/mail/components/health-probe";
import { Mail } from "@/features/mail/components/mail";
import {
  createMailLayout,
  defaultMailLayout,
  mailPanelIds,
} from "@/features/mail/components/mail-layout";
import { MailLoading } from "@/features/mail/components/mail-loading";

const mailLayoutCookieName = "react-resizable-panels:layout:mail";
const navCollapsedSize = 4;

const mailLayoutSchema = z.object({
  [mailPanelIds.sidebar]: z.number().min(navCollapsedSize).max(20),
  [mailPanelIds.list]: z.number().min(30),
  [mailPanelIds.detail]: z.number().min(0).max(100),
});

export async function MailPage({ demoMode = false }: { readonly demoMode?: boolean }) {
  const defaultLayout = await getDefaultMailLayout();
  const defaultCollapsed = defaultLayout[mailPanelIds.sidebar] <= navCollapsedSize + 0.5;

  return (
    <main className="h-full overflow-hidden bg-background text-foreground">
      {/* Nothing on the public demo may reach a real backend, so the probe is
          skipped entirely in demo mode instead of just not mattering. */}
      {demoMode ? null : <HealthProbe />}
      <section className="h-full overflow-hidden bg-background">
        <div className="hidden h-full flex-col md:flex">
          {demoMode ? <DemoBanner /> : null}
          {/* Mail reads the ?folder search param via useSearchParams, which
              requires a Suspense boundary under the App Router. The flex-1 wrapper
              gives the workspace a definite height to fill once the demo banner
              takes a slice of the column. */}
          <div className="min-h-0 flex-1">
            <Suspense fallback={<MailLoading />}>
              <Mail
                defaultCollapsed={defaultCollapsed}
                defaultLayout={defaultLayout}
                demoMode={demoMode}
                navCollapsedSize={navCollapsedSize}
              />
            </Suspense>
          </div>
        </div>
        <div className="p-8 text-sm text-muted-foreground md:hidden">
          Mail example is available on tablet and desktop widths.
        </div>
      </section>
    </main>
  );
}

async function getDefaultMailLayout() {
  const layoutCookie = (await cookies()).get(mailLayoutCookieName);

  if (!layoutCookie) {
    return defaultMailLayout;
  }

  try {
    const parsedLayout = mailLayoutSchema.safeParse(
      JSON.parse(decodeURIComponent(layoutCookie.value)),
    );

    if (parsedLayout.success) {
      return createMailLayout(parsedLayout.data);
    }
  } catch {
    return defaultMailLayout;
  }

  return defaultMailLayout;
}
