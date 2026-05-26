import { NextRequest, NextResponse } from "next/server"
import { createOAuth2Client } from "@/lib/google"
import { createSupabaseServerClient } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error || !code) {
    const msg = encodeURIComponent(error ?? "No authorization code received")
    return NextResponse.redirect(`${appUrl}/dashboard/integrations?error=${msg}`)
  }

  const oauth2 = createOAuth2Client()

  let tokens
  try {
    const result = await oauth2.getToken(code)
    tokens = result.tokens
  } catch (err) {
    console.error("[google/callback] token exchange error:", err)
    const msg = encodeURIComponent("Token exchange failed — check server logs")
    return NextResponse.redirect(`${appUrl}/dashboard/integrations?error=${msg}`)
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { error: upsertError } = await supabase.from("google_tokens").upsert(
    {
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    },
    { onConflict: "user_id" }
  )

  if (upsertError) {
    console.error("[google/callback] upsert error:", upsertError)
    const msg = encodeURIComponent(`DB error: ${upsertError.message}`)
    return NextResponse.redirect(`${appUrl}/dashboard/integrations?error=${msg}`)
  }

  return NextResponse.redirect(`${appUrl}/dashboard/integrations?connected=1`)
}
