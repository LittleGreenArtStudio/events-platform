"use server"

import { createSupabaseServerClient } from "@/lib/auth"
import { revalidatePath } from "next/cache"

type EventKind = "offsite" | "in-studio"

function eventTables(eventKind: EventKind) {
  const isOffsite = eventKind === "offsite"
  return {
    table: isOffsite ? "offsite_events" : "in_studio_events",
    craftTable: isOffsite ? "offsite_event_crafts" : "in_studio_event_crafts",
    staffTable: isOffsite ? "offsite_event_staff" : "in_studio_event_staff",
    eventFkColumn: isOffsite ? "offsite_event_id" : "in_studio_event_id",
  }
}

function revalidateEvent(eventKind: EventKind, eventId: string) {
  revalidatePath(`/dashboard/events/${eventKind}/${eventId}`)
}

// ── Milestones ────────────────────────────────────────────────────────────

export async function setEventStatus(
  eventKind: EventKind,
  eventId: string,
  status: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { table } = eventTables(eventKind)
  const { error } = await supabase.from(table).update({ status }).eq("id", eventId)
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

export async function toggleDepositPaid(
  eventKind: EventKind,
  eventId: string,
  current: boolean
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { table } = eventTables(eventKind)
  const { error } = await supabase.from(table).update({ deposit_paid: !current }).eq("id", eventId)
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

// ── Event Crafts ──────────────────────────────────────────────────────────

export async function addCraftToEvent(
  eventKind: EventKind,
  eventId: string,
  craftId: string,
  guestCountOverride: string,
  notes: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { craftTable } = eventTables(eventKind)
  const { error } = await supabase.from(craftTable).insert({
    event_id: eventId,
    craft_id: craftId,
    guest_count_override: guestCountOverride ? Number(guestCountOverride) : null,
    notes: notes.trim() || null,
  })
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

export async function removeCraftFromEvent(
  eventKind: EventKind,
  eventId: string,
  craftEventId: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { craftTable } = eventTables(eventKind)
  const { error } = await supabase.from(craftTable).delete().eq("id", craftEventId)
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

// ── Event Staff ───────────────────────────────────────────────────────────

export async function addStaffToEvent(
  eventKind: EventKind,
  eventId: string,
  staffId: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { staffTable } = eventTables(eventKind)
  const { error } = await supabase.from(staffTable).insert({
    event_id: eventId,
    staff_id: staffId,
    confirmed: false,
  })
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

export async function removeStaffFromEvent(
  eventKind: EventKind,
  eventId: string,
  staffEventId: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { staffTable } = eventTables(eventKind)
  const { error } = await supabase.from(staffTable).delete().eq("id", staffEventId)
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

export async function toggleStaffConfirmed(
  eventKind: EventKind,
  eventId: string,
  staffEventId: string,
  current: boolean
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { staffTable } = eventTables(eventKind)
  const { error } = await supabase
    .from(staffTable)
    .update({ confirmed: !current })
    .eq("id", staffEventId)
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

// ── Tasks ─────────────────────────────────────────────────────────────────

export async function toggleTaskStatus(
  eventKind: EventKind,
  eventId: string,
  taskId: string,
  currentStatus: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const newStatus = currentStatus === "done" ? "todo" : "done"
  const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId)
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

export async function addTask(
  eventKind: EventKind,
  eventId: string,
  title: string,
  priority: string,
  dueDate: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { eventFkColumn } = eventTables(eventKind)
  const { error } = await supabase.from("tasks").insert({
    [eventFkColumn]: eventId,
    title: title.trim(),
    status: "todo",
    priority: priority || "normal",
    due_date: dueDate || null,
  })
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

// ── Threads ───────────────────────────────────────────────────────────────

export async function addThread(
  eventKind: EventKind,
  eventId: string,
  body: string,
  subject: string,
  type: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { eventFkColumn } = eventTables(eventKind)
  const { error } = await supabase.from("threads").insert({
    [eventFkColumn]: eventId,
    body: body.trim(),
    subject: subject.trim() || null,
    type: type || "note",
    sender: "Team",
  })
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

// ── Invoices ──────────────────────────────────────────────────────────────

export async function createInvoice(
  eventKind: EventKind,
  eventId: string
): Promise<{ ok: true; id: string } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { eventFkColumn } = eventTables(eventKind)
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      [eventFkColumn]: eventId,
      status: "draft",
      subtotal: 0,
      total: 0,
      amount_paid: 0,
    })
    .select("id")
    .single()
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true, id: (data as { id: string }).id }
}

export async function addInvoiceLineItem(
  eventKind: EventKind,
  eventId: string,
  invoiceId: string,
  description: string,
  quantity: string,
  unitPrice: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const qty = parseFloat(quantity) || 1
  const price = parseFloat(unitPrice) || 0

  const { error: lineError } = await supabase.from("invoice_line_items").insert({
    invoice_id: invoiceId,
    description: description.trim(),
    quantity: qty,
    unit_price: price,
  })
  if (lineError) return { error: lineError.message }

  await recalcInvoiceTotals(supabase, invoiceId)
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

export async function removeInvoiceLineItem(
  eventKind: EventKind,
  eventId: string,
  invoiceId: string,
  lineItemId: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from("invoice_line_items").delete().eq("id", lineItemId)
  if (error) return { error: error.message }

  await recalcInvoiceTotals(supabase, invoiceId)
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

export async function updateInvoiceStatus(
  eventKind: EventKind,
  eventId: string,
  invoiceId: string,
  status: string,
  amountPaid?: number
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const update: Record<string, unknown> = { status }
  if (amountPaid !== undefined) update.amount_paid = amountPaid
  const { error } = await supabase.from("invoices").update(update).eq("id", invoiceId)
  if (error) return { error: error.message }
  revalidateEvent(eventKind, eventId)
  return { ok: true }
}

// ── Internal helpers ──────────────────────────────────────────────────────

async function recalcInvoiceTotals(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  invoiceId: string
) {
  const { data: items } = await supabase
    .from("invoice_line_items")
    .select("quantity, unit_price")
    .eq("invoice_id", invoiceId)

  type LI = { quantity: number; unit_price: number }
  const subtotal = ((items ?? []) as unknown as LI[]).reduce(
    (sum, li) => sum + (li.quantity ?? 0) * (li.unit_price ?? 0),
    0
  )

  const { data: inv } = await supabase
    .from("invoices")
    .select("tax_rate")
    .eq("id", invoiceId)
    .maybeSingle()
  type InvRow = { tax_rate: number | null }
  const taxRate = ((inv as unknown as InvRow)?.tax_rate ?? 0) / 100
  const total = subtotal * (1 + taxRate)

  await supabase.from("invoices").update({ subtotal, total }).eq("id", invoiceId)
}
