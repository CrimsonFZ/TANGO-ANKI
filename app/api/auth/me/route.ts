import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
    },
  });
}
