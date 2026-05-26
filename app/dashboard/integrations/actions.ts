"use server"

import { createSupabaseServerClient } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function importCalendarEvent(formData: FormData) {
  const supabase = await createSupabaseServerClient()

  const eventType = formData.get("event_type") as string
  const isOffsite = eventType === "offsite"
  const table = isOffsite ? "offsite_events" : "in_studio_events"

  const startRaw = formData.get("start_time") as string
  const endRaw = formData.get("end_time") as string

  const payload: Record<string, unknown> = {
    title: formData.get("title") as string,
    status: "inquiry",
    event_date: formData.get("date") as string,
    start_time: startRaw ? `${startRaw}:00` : null,
    end_time: endRaw ? `${endRaw}:00` : null,
    guest_count: null,
    notes: (formData.get("description") as string) || null,
  }

  if (isOffsite) {
    payload.location = (formData.get("location") as string) || null
  }

  const { error } = await supabase.from(table).insert(payload)

  if (error) {
    console.error("[importCalendarEvent] error:", error.message)
    return { error: error.message }
  }

  revalidatePath("/dashboard/integrations")
  return { ok: true }
}
