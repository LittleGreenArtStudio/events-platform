import { NextResponse } from "next/server"
import { google } from "googleapis"
import { createOAuth2Client } from "@/lib/google"
import { createSupabaseServerClient } from "@/lib/auth"

export type CalendarSuggestion = {
  googleId: string
  title: string
  date: string         // YYYY-MM-DD
  startTime: string | null  // HH:MM
  endTime: string | null
  location: string | null
  description: string | null
  alreadyExists: boolean
}

function isoToDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  // All-day events have only a date field; datetime events have dateTime
  return iso.substring(0, 10)
}

function isoToTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  // "2026-06-15T14:00:00-07:00" → "14:00"
  const match = iso.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (tokenError || !tokenRow) {
    return NextResponse.json(
      { error: "Google account not connected" },
      { status: 400 }
    )
  }

  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token ?? undefined,
    expiry_date: tokenRow.expires_at
      ? new Date(tokenRow.expires_at).getTime()
      : undefined,
  })

  // Persist refreshed tokens if googleapis auto-refreshes
  oauth2.on("tokens", async (newTokens) => {
    await supabase.from("google_tokens").upsert(
      {
        user_id: user.id,
        access_token: newTokens.access_token ?? tokenRow.access_token,
        refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
        expires_at: newTokens.expiry_date
          ? new Date(newTokens.expiry_date).toISOString()
          : tokenRow.expires_at,
      },
      { onConflict: "user_id" }
    )
  })

  const calendar = google.calendar({ version: "v3", auth: oauth2 })

  const now = new Date()
  const later = new Date()
  later.setDate(later.getDate() + 90)

  let calItems
  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: later.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    })
    calItems = res.data.items ?? []
  } catch (err) {
    console.error("[calendar/sync] Google API error:", err)
    return NextResponse.json(
      { error: "Failed to fetch Google Calendar events" },
      { status: 500 }
    )
  }

  // Collect all dates we need to check in bulk
  const calDates = calItems
    .map((e) => isoToDate(e.start?.dateTime ?? e.start?.date))
    .filter(Boolean) as string[]

  const [offsiteResult, inStudioResult] = await Promise.all([
    supabase
      .from("offsite_events")
      .select("title, event_date")
      .in("event_date", calDates.length ? calDates : [""]),
    supabase
      .from("in_studio_events")
      .select("title, event_date")
      .in("event_date", calDates.length ? calDates : [""]),
  ])

  // Build a set of "title|date" keys that already exist
  type ExistingRow = { title: string; event_date: string }
  const existing = new Set<string>()
  for (const row of ((offsiteResult.data ?? []) as ExistingRow[])) {
    existing.add(`${row.title.toLowerCase()}|${row.event_date}`)
  }
  for (const row of ((inStudioResult.data ?? []) as ExistingRow[])) {
    existing.add(`${row.title.toLowerCase()}|${row.event_date}`)
  }

  const suggestions: CalendarSuggestion[] = calItems
    .filter((e) => e.summary) // skip untitled events
    .map((e) => {
      const date = isoToDate(e.start?.dateTime ?? e.start?.date)
      const title = e.summary ?? ""
      return {
        googleId: e.id ?? "",
        title,
        date: date ?? "",
        startTime: isoToTime(e.start?.dateTime),
        endTime: isoToTime(e.end?.dateTime),
        location: e.location ?? null,
        description: e.description ?? null,
        alreadyExists: existing.has(`${title.toLowerCase()}|${date}`),
      }
    })
    .filter((s) => s.date) // drop all-day events with missing date

  return NextResponse.json({ suggestions })
}
