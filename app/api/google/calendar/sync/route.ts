import { NextResponse } from "next/server"
import { google } from "googleapis"
import { createOAuth2Client } from "@/lib/google"
import { createSupabaseServerClient } from "@/lib/auth"
import type { CalendarSuggestion } from "@/app/dashboard/integrations/types"

function isoToDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return iso.substring(0, 10)
}

function isoToTime(iso: string | null | undefined): string | null {
  if (!iso) return null
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
    .select("access_token, refresh_token, expires_at, selected_calendar_ids, dismissed_event_ids")
    .eq("user_id", user.id)
    .maybeSingle()

  if (tokenError || !tokenRow) {
    return NextResponse.json(
      { error: "Google account not connected" },
      { status: 400 }
    )
  }

  type TokenRow = {
    access_token: string
    refresh_token: string | null
    expires_at: string | null
    selected_calendar_ids: string[] | null
    dismissed_event_ids: string[] | null
  }
  const row = tokenRow as unknown as TokenRow

  const calendarIds: string[] =
    row.selected_calendar_ids?.length ? row.selected_calendar_ids : ["primary"]

  const dismissedSet = new Set<string>(row.dismissed_event_ids ?? [])

  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token ?? undefined,
    expiry_date: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
  })

  oauth2.on("tokens", async (newTokens) => {
    await supabase.from("google_tokens").upsert(
      {
        user_id: user.id,
        access_token: newTokens.access_token ?? row.access_token,
        refresh_token: newTokens.refresh_token ?? row.refresh_token,
        expires_at: newTokens.expiry_date
          ? new Date(newTokens.expiry_date).toISOString()
          : row.expires_at,
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
    const responses = await Promise.allSettled(
      calendarIds.map((calendarId) =>
        calendar.events.list({
          calendarId,
          timeMin: now.toISOString(),
          timeMax: later.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 100,
        })
      )
    )

    const seenIds = new Set<string>()
    calItems = responses
      .flatMap((res) => {
        if (res.status === "rejected") {
          console.error("[calendar/sync] calendar fetch error:", res.reason)
          return []
        }
        return res.value.data.items ?? []
      })
      .filter((e) => {
        if (!e.id || seenIds.has(e.id)) return false
        seenIds.add(e.id)
        return true
      })
  } catch (err) {
    console.error("[calendar/sync] Google API error:", err)
    return NextResponse.json(
      { error: "Failed to fetch Google Calendar events" },
      { status: 500 }
    )
  }

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

  type ExistingRow = { title: string; event_date: string }
  const existing = new Set<string>()
  for (const row of ((offsiteResult.data ?? []) as ExistingRow[])) {
    existing.add(`${row.title.toLowerCase()}|${row.event_date}`)
  }
  for (const row of ((inStudioResult.data ?? []) as ExistingRow[])) {
    existing.add(`${row.title.toLowerCase()}|${row.event_date}`)
  }

  const suggestions: CalendarSuggestion[] = calItems
    .filter((e) => e.summary)
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
    .filter((s) => s.date && !dismissedSet.has(s.googleId))

  return NextResponse.json({ suggestions })
}
