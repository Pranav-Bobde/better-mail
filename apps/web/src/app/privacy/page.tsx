import type { Metadata } from "next";

import { PrivacyPolicy } from "@/features/legal/components/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy Policy · Mail",
  description: "How Mail handles your Google account and Gmail data.",
};

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}
