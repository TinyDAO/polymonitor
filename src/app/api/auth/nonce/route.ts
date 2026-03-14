import { NextResponse } from "next/server";
import { generateNonce } from "siwe";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const nonce = generateNonce();
    const session = await getSession();
    session.nonce = nonce;
    await session.save();
    return NextResponse.json({ nonce });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate nonce" },
      { status: 500 }
    );
  }
}
