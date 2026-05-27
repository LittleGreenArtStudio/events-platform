"use server"

import { createSupabaseServerClient } from "@/lib/auth"
import { revalidatePath } from "next/cache"

type EventKind = "offsite" | "in-studio"

export type PhotoEntry = {
  url: string
  thumb?: string
  tag: string
  uploaded_at: string
}

function eventTable(eventKind: EventKind) {
  return eventKind === "offsite" ? "offsite_events" : "in_studio_events"
}

export async function updateEventPhotoUrls(
  eventKind: EventKind,
  eventId: string,
  photos: PhotoEntry[]
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from(eventTable(eventKind))
    .update({ photo_urls: photos })
    .eq("id", eventId)
  if (error) {
    console.error("[updateEventPhotoUrls]", error.message)
    return { error: error.message }
  }
  revalidatePath(`/dashboard/events/${eventKind}/${eventId}`)
  return { ok: true }
}
