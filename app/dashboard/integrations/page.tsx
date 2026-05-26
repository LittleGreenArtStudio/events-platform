import { createSupabaseServerClient, getCachedUser } from "@/lib/auth"
import { createOAuth2Client } from "@/lib/google"
import { google } from "googleapis"
import GoogleCalendarCard from "./GoogleCalendarCard"
import type { CalendarOption } from "./types"
import styles from "./integrations.module.css"

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string }
}) {
  const user = await getCachedUser()
  const supabase = await createSupabaseServerClient()

  const { data: rawTokenRow } = user
    ? await supabase
        .from("google_tokens")
        .select("access_token, refresh_token, expires_at, selected_calendar_ids")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null }

  type TokenRow = {
    access_token: string
    refresh_token: string | null
    expires_at: string | null
    selected_calendar_ids: string[] | null
  }
  const tokenRow = rawTokenRow as unknown as TokenRow | null
  const isConnected = !!tokenRow

  let calendars: CalendarOption[] = []
  const selectedCalendarIds: string[] = tokenRow?.selected_calendar_ids ?? []

  if (tokenRow) {
    try {
      const oauth2 = createOAuth2Client()
      oauth2.setCredentials({
        access_token: tokenRow.access_token,
        refresh_token: tokenRow.refresh_token ?? undefined,
        expiry_date: tokenRow.expires_at
          ? new Date(tokenRow.expires_at).getTime()
          : undefined,
      })
      const calApi = google.calendar({ version: "v3", auth: oauth2 })
      const { data } = await calApi.calendarList.list({ maxResults: 50 })
      calendars = (data.items ?? []).map((c) => ({
        id: c.id ?? "",
        name: c.summary ?? c.id ?? "",
        color: c.backgroundColor ?? null,
      }))
    } catch {
      // calendar list fetch failed — proceed with empty list
    }
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Integrations</h2>
      <p className={styles.sub}>
        Connect external services to sync data with Forager Crafts.
      </p>

      {searchParams.connected === "1" && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          Google account connected successfully.
        </div>
      )}

      {searchParams.error && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          {decodeURIComponent(searchParams.error)}
        </div>
      )}

      <GoogleCalendarCard
        connected={isConnected}
        calendars={calendars}
        selectedCalendarIds={selectedCalendarIds}
      />
    </div>
  )
}
