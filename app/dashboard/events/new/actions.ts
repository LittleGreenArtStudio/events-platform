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

  // <input type="time"> yields "HH:MM" — append seconds so Postgres accepts
  // it as a valid time literal regardless of server strictness.
  const rawStart = formData.get("start_time") as string
  const rawEnd = formData.get("end_time") as string
  const startTime = rawStart ? (rawStart.length === 5 ? `${rawStart}:00` : rawStart) : null
  const endTime = rawEnd ? (rawEnd.length === 5 ? `${rawEnd}:00` : rawEnd) : null

  const payload: Record<string, unknown> = {
    title: formData.get("title") as string,
    client_id: clientId || null,
    status: "inquiry",
    event_date: formData.get("event_date") as string,
    start_time: startTime,
    end_time: endTime,
    guest_count: guestCountRaw ? Number(guestCountRaw) : null,
    budget: budgetRaw ? Number(budgetRaw) : null,
    deposit_amount: depositRaw ? Number(depositRaw) : null,
    notes: (formData.get("notes") as string) || null,
  }

  if (isOffsite) {
    payload.location = (formData.get("location") as string) || null
  }

  console.log("[createEvent] table:", table)
  console.log("[createEvent] payload:", JSON.stringify(payload, null, 2))

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select("id")
    .single()

  if (error) {
    console.error("[createEvent] error:", error.code, error.message, error.details, error.hint)
    const msg = encodeURIComponent(`${error.code}: ${error.message}`)
    redirect(`/dashboard/events/new?error=${msg}`)
  }

  if (!data) {
    console.error("[createEvent] insert returned no data — check RLS SELECT policy")
    redirect("/dashboard/events/new?error=Insert+succeeded+but+no+row+returned+%E2%80%94+check+RLS+SELECT+policy")
  }

  redirect(`/dashboard/events/${eventType}/${data.id}`)
}

// ── Quick-add client ──────────────────────────────────────────────────────
// Returns the created client or an error string.
// Called programmatically from the form component (not a form action),
// so we return a value instead of redirecting.

export type NewClientInput = {
  firstName: string
  lastName: string
  company: string
  email: string
  phone: string
}

export type CreateClientResult =
  | { client: { id: string; name: string } }
  | { error: string }

export async function createClient(
  input: NewClientInput
): Promise<CreateClientResult> {
  const supabase = await createSupabaseServerClient()

  const name =
    [input.firstName.trim(), input.lastName.trim()].filter(Boolean).join(" ") ||
    input.company.trim() ||
    "New Client"

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      first_name: input.firstName || null,
      last_name: input.lastName || null,
      company: input.company || null,
      email: input.email || null,
      phone: input.phone || null,
    })
    .select("id, name")
    .single()

  if (error) {
    console.error("[createClient] error:", error.code, error.message)
    return { error: `${error.code}: ${error.message}` }
  }

  return { client: data as { id: string; name: string } }
}
