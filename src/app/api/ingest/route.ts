// Ingestion endpoint. Vercel Cron sends GET; POST is for manual triggers.
import type { NextRequest } from "next/server";

import { ingestAll } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const result = await ingestAll();
    return Response.json(result);
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  try {
    const result = await ingestAll();
    return Response.json(result);
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
