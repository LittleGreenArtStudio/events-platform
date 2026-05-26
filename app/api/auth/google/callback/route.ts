import { NextRequest, NextResponse } from "next/server"
import { createOAuth2Client } from "@/lib/google"
import { createSupabaseServerClient } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  console.log("[google/callback] invoked — code present:", !!code, "error:", error ?? "none")

  if (error || !code) {
    const msg = encodeURIComponent(error ?? "No authorization code received")
    return NextResponse.redirect(`${appUrl}/dashboard/integrations?error=${msg}`)
  }

  // ── 1. Exchange the code for Google tokens ──────────────────────────────
  const oauth2 = createOAuth2Client()

  let tokens
  try {
    const result = await oauth2.getToken(code)
    tokens = result.tokens
    console.log(
      "[google/callback] token exchange ok — access_token:", !!tokens.access_token,
      "refresh_token:", !!tokens.refresh_token,
      "expiry_date:", tokens.expiry_date ?? "none"
    )
  } catch (err) {
    console.error("[google/callback] token exchange failed:", err)
    const msg = encodeURIComponent("Google token exchange failed — check server logs")
    return NextResponse.redirect(`${appUrl}/dashboard/integrations?error=${msg}`)
  }

  if (!tokens.access_token) {
    console.error("[google/callback] token exchange returned no access_token")
    const msg = encodeURIComponent("Google did not return an access token")
    return NextResponse.redirect(`${appUrl}/dashboard/integrations?error=${msg}`)
  }

  // ── 2. Resolve the Supabase session user ────────────────────────────────
  // We must use the Supabase auth user ID (UUID from the session cookie),
  // NOT any ID from the Google token response.
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  console.log(
    "[google/callback] supabase.auth.getUser — user_id:", user?.id ?? "null",
    "auth error:", authError?.message ?? "none"
  )

  if (!user) {
    const msg = encodeURIComponent(
      authError
        ? `Session error: ${authError.message}`
        : "No active session — please log in and try again"
    )
    return NextResponse.redirect(`${appUrl}/dashboard/integrations?error=${msg}`)
  }

  // ── 3. Upsert Google tokens keyed by Supabase user ID ───────────────────
  const payload = {
    user_id: user.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
  }

  console.log("[google/callback] upserting to google_tokens for user_id:", user.id)

  const { error: upsertError } = await supabase
    .from("google_tokens")
    .upsert(payload, { onConflict: "user_id" })

  if (upsertError) {
    console.error(
      "[google/callback] upsert failed —",
      "code:", upsertError.code,
      "message:", upsertError.message,
      "details:", upsertError.details ?? "none",
      "hint:", upsertError.hint ?? "none"
    )
    const detail = [upsertError.code, upsertError.message, upsertError.hint]
      .filter(Boolean)
      .join(" · ")
    const msg = encodeURIComponent(`Token save failed: ${detail}`)
    return NextResponse.redirect(`${appUrl}/dashboard/integrations?error=${msg}`)
  }

  console.log("[google/callback] tokens saved — redirecting to integrations")
  return NextResponse.redirect(`${appUrl}/dashboard/integrations?connected=1`)
}
