import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "9.5",
    timestamp: new Date().toISOString(),
  });
}
