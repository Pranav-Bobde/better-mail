import type { Metadata } from "next";

import { TermsOfService } from "@/features/legal/components/terms-of-service";

export const metadata: Metadata = {
  title: "Terms of Service · Mail",
  description: "Terms for using the Mail hosted service.",
};

export default function TermsPage() {
  return <TermsOfService />;
}
