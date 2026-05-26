"use server"

import { createSupabaseServerClient } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function importCalendarEvent(
  formData: FormData
): Promise<{ eventId: string; eventType: string } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthenticated" }

  const eventType = formData.get("event_type") as string
  const isOffsite = eventType === "offsite"
  const table = isOffsite ? "offsite_events" : "in_studio_events"

  const startRaw = formData.get("start_time") as string
  const endRaw = formData.get("end_time") as string
  const startTime = startRaw ? (startRaw.length === 5 ? `${startRaw}:00` : startRaw) : null
  const endTime = endRaw ? (endRaw.length === 5 ? `${endRaw}:00` : endRaw) : null

  const payload: Record<string, unknown> = {
    title: formData.get("title") as string,
    status: "inquiry",
    event_date: formData.get("date") as string,
    start_time: startTime,
    end_time: endTime,
    notes: (formData.get("description") as string) || null,
  }

  if (isOffsite) {
    payload.venue_address = (formData.get("venue_address") as string) || null
  }

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select("id")
    .single()

  if (error) {
    console.error("[importCalendarEvent] error:", error.message)
    return { error: error.message }
  }

  revalidatePath("/dashboard/integrations")
  return { eventId: (data as { id: string }).id, eventType }
}

export async function updateCalendarPreferences(
  selectedIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthenticated" }

  const { error } = await supabase
    .from("google_tokens")
    .update({ selected_calendar_ids: selectedIds })
    .eq("user_id", user.id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function dismissEvent(
  googleEventId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthenticated" }

  const { data: tokenRow, error: readError } = await supabase
    .from("google_tokens")
    .select("dismissed_event_ids")
    .eq("user_id", user.id)
    .single()

  if (readError) return { ok: false, error: readError.message }

  const current =
    ((tokenRow as unknown as { dismissed_event_ids: string[] | null }).dismissed_event_ids) ?? []
  const updated = Array.from(new Set([...current, googleEventId]))

  const { error: updateError } = await supabase
    .from("google_tokens")
    .update({ dismissed_event_ids: updated })
    .eq("user_id", user.id)

  if (updateError) return { ok: false, error: updateError.message }
  return { ok: true }
}
