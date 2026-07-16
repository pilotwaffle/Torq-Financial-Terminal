import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runAdvisor } from "@/lib/advisor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let question = "";
  try {
    const body = await req.json();
    question = String(body?.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "question too long (max 2000 chars)" }, { status: 400 });
  }

  const result = await runAdvisor(question);

  // Audit log — record every advisory Q&A (the TORQ audit trail).
  await supabaseAdmin.from("news_advisor_queries").insert({
    question,
    answer: result.answer || null,
    model_used: result.model,
    intent: result.intent,
    tickers: result.tickers,
    context_summary: result.contextSummary,
    news_used: result.counts.news,
    filings_used: result.counts.filings,
    movers_used: result.counts.movers,
    congress_used: result.counts.congress,
    status: result.status,
    error: result.error ?? null,
  });

  if (result.status === "error") {
    return NextResponse.json(
      { error: result.error || "advisor error", intent: result.intent },
      { status: 500 }
    );
  }

  return NextResponse.json({
    answer: result.answer,
    model: result.model,
    intent: result.intent,
    tickers: result.tickers,
    status: result.status,
  });
}
