import { cookies } from "next/headers";
import { z } from "zod";

import { HealthProbe } from "@/features/mail/components/health-probe";
import { Mail } from "@/features/mail/components/mail";
import {
  createMailLayout,
  defaultMailLayout,
  mailPanelIds,
} from "@/features/mail/components/mail-layout";

const mailLayoutCookieName = "react-resizable-panels:layout:mail";
const navCollapsedSize = 4;

const mailLayoutSchema = z.object({
  [mailPanelIds.sidebar]: z.number().min(navCollapsedSize).max(20),
  [mailPanelIds.list]: z.number().min(30),
  [mailPanelIds.detail]: z.number().min(0).max(100),
});

export async function MailPage() {
  const defaultLayout = await getDefaultMailLayout();
  const defaultCollapsed = defaultLayout[mailPanelIds.sidebar] <= navCollapsedSize + 0.5;

  return (
    <main className="h-full overflow-hidden bg-background p-0 text-foreground md:p-6">
      <HealthProbe />
      <section className="h-full overflow-hidden rounded-lg border bg-background shadow">
        <div className="hidden h-full flex-col md:flex">
          <Mail
            defaultCollapsed={defaultCollapsed}
            defaultLayout={defaultLayout}
            navCollapsedSize={navCollapsedSize}
          />
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
