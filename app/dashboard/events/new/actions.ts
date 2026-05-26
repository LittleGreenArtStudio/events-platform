"use server"

import { createSupabaseServerClient } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function createEvent(formData: FormData) {
  const supabase = await createSupabaseServerClient()

  const eventType = formData.get("event_type") as string
  const isOffsite = eventType === "offsite"
  const table = isOffsite ? "offsite_events" : "in_studio_events"

  const clientId = formData.get("client_id") as string
  const guestCountRaw = formData.get("guest_count") as string
  const budgetRaw = formData.get("budget") as string
  const depositRaw = formData.get("deposit_amount") as string

  const payload: Record<string, unknown> = {
    title: formData.get("title") as string,
    client_id: clientId || null,
    status: "inquiry",
    event_date: formData.get("event_date") as string,
    start_time: (formData.get("start_time") as string) || null,
    end_time: (formData.get("end_time") as string) || null,
    guest_count: guestCountRaw ? Number(guestCountRaw) : null,
    budget: budgetRaw ? Number(budgetRaw) : null,
    deposit_amount: depositRaw ? Number(depositRaw) : null,
    notes: (formData.get("notes") as string) || null,
  }

  if (isOffsite) {
    payload.location = (formData.get("location") as string) || null
  }

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select("id")
    .single()

  if (error || !data) {
    redirect("/dashboard/events/new?error=Failed+to+create+event")
  }

  redirect(`/dashboard/events/${eventType}/${data.id}`)
}
