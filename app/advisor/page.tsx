import type { Metadata } from "next";
import Advisor from "@/components/Advisor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Advisor — TORQ News Desk",
  description:
    "Ask TORQ's Prince Flowers advisor about the market, tickers, filings, and congressional trades. Grounded in terminal data — not financial advice.",
};

export default function AdvisorPage() {
  return <Advisor />;
}
