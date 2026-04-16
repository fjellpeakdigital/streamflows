import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { code } = await request.json();

  const betaCode = process.env.BETA_INVITE_CODE;
  if (!betaCode) {
    // If no code is configured, deny all signups so the app isn't accidentally open
    return NextResponse.json({ error: 'Beta signups are not currently open' }, { status: 403 });
  }

  if (!code || code.trim().toLowerCase() !== betaCode.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
