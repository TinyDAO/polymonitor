import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();
    if (!message || !signature) {
      return NextResponse.json(
        { error: "Missing message or signature" },
        { status: 400 }
      );
    }

    const session = await getSession();
    const nonce = session.nonce;
    if (!nonce) {
      return NextResponse.json(
        { error: "No nonce found. Request one first." },
        { status: 400 }
      );
    }

    const siweMessage = new SiweMessage(message);
    const { data: fields } = await siweMessage.verify({
      signature: signature as `0x${string}`,
      nonce,
    });

    if (fields.nonce !== nonce) {
      return NextResponse.json({ error: "Invalid nonce" }, { status: 400 });
    }

    const walletAddress = fields.address.toLowerCase();

    // Ensure user exists
    await db
      .insert(users)
      .values({ walletAddress })
      .onConflictDoNothing({ target: users.walletAddress });

    session.walletAddress = walletAddress;
    session.nonce = undefined;
    await session.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 400 }
    );
  }
}
