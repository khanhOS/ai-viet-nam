// GET /api — health check

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({
    name: "KhanhOS AI API",
    status: "ok",
    db: dbOk,
    time: new Date().toISOString(),
  });
}
