import { NextResponse } from "next/server"
import { createOAuth2Client, GOOGLE_SCOPES } from "@/lib/google"

export async function GET() {
  const oauth2 = createOAuth2Client()
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    prompt: "consent", // always request refresh_token
  })
  return NextResponse.redirect(url)
}
