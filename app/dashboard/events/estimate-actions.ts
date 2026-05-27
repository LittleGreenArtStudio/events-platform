"use server"

import { createSupabaseServerClient } from "@/lib/auth"
import { revalidatePath } from "next/cache"

type EventKind = "offsite" | "in-studio"

function eventFk(eventKind: EventKind) {
  return eventKind === "offsite" ? "offsite_event_id" : "in_studio_event_id"
}

function revalidateEvent(eventKind: EventKind, eventId: string) {
  revalidatePath(`/dashboard/events/${eventKind}/${eventId}`)
}

export type SaveEstimatePayload = {
  estimateId: string | null
  pricingMode: "custom" | "per_guest"
  perGuestPrice: number | null
  materialsLines: unknown[]
  staffLines: unknown[]
  travelLines: unknown[]
  addonLines: unknown[]
  materialsSubtotal: number
  staffSubtotal: number
  travelSubtotal: number
  addonSubtotal: number
  totalCost: number
  markupPct: number
  clientTotal: number
  taxRate: number
  taxAmount: number
  depositPct: number
  depositAmount: number
  balanceDue: number
  clientNotes: string
}

export async function saveEstimate(
  eventKind: EventKind,
  eventId: string,
  payload: SaveEstimatePayload
): Promise<{ ok: true; id: string } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const fk = eventFk(eventKind)

  const record = {
    [fk]: eventId,
    pricing_mode: payload.pricingMode,
    per_guest_price: payload.perGuestPrice,
    materials_lines: payload.materialsLines,
    staff_lines: payload.staffLines,
    travel_lines: payload.travelLines,
    addon_lines: payload.addonLines,
    materials_subtotal: payload.materialsSubtotal,
    staff_subtotal: payload.staffSubtotal,
    travel_subtotal: payload.travelSubtotal,
    addon_subtotal: payload.addonSubtotal,
    total_cost: payload.totalCost,
    markup_pct: payload.markupPct,
    client_total: payload.clientTotal,
    tax_rate: payload.taxRate,
    tax_amount: payload.taxAmount,
    deposit_pct: payload.depositPct,
    deposit_amount: payload.depositAmount,
    balance_due: payload.balanceDue,
    client_notes: payload.clientNotes || null,
    updated_at: new Date().toISOString(),
  }

  if (payload.estimateId) {
    const { data, error } = await supabase
      .from("estimates")
      .update(record)
      .eq("id", payload.estimateId)
      .select("id")
      .single()
    if (error) return { error: error.message }
    revalidateEvent(eventKind, eventId)
    return { ok: true, id: (data as { id: string }).id }
  } else {
    const { data, error } = await supabase
      .from("estimates")
      .insert({ ...record, status: "draft" })
      .select("id")
      .single()
    if (error) return { error: error.message }
    revalidateEvent(eventKind, eventId)
    return { ok: true, id: (data as { id: string }).id }
  }
}

export async function updateEstimateStatus(
  eventKind: EventKind,
  eventId: string,
  estimateId: string,
  status: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === "sent") update.sent_at = new Date().toISOString()
  if (status === "accepted") update.accepted_at = new Date().toISOString()
  const { error } = await supabase.from("estimates").update(update).eq("id", estimateId)
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}
