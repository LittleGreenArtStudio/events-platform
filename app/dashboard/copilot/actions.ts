"use server"

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseServerClient } from "@/lib/auth"
import type { CraftInfo } from "./types"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Fetch crafts for an event (used by the supply estimator preview) ───────

export async function getEventCrafts(
  eventType: string,
  eventId: string
): Promise<{ crafts: CraftInfo[] } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const craftTable =
    eventType === "offsite" ? "offsite_event_crafts" : "in_studio_event_crafts"
  const fk =
    eventType === "offsite" ? "offsite_event_id" : "in_studio_event_id"

  const { data, error } = await supabase
    .from(craftTable)
    .select(
      `quantity,
       crafts (
         id,
         name,
         craft_supplies (
           qty_per_guest,
           supplies ( name, unit, unit_cost )
         )
       )`
    )
    .eq(fk, eventId)

  if (error) return { error: error.message }

  type RawCS = { qty_per_guest: number | null; supplies: { name: string; unit: string | null; unit_cost: number | null } | null }
  type RawCraft = { id: string; name: string; craft_supplies: RawCS[] | null }
  type RawRow = { quantity: number | null; crafts: RawCraft | null }

  const crafts: CraftInfo[] = ((data ?? []) as unknown as RawRow[]).map((row) => ({
    id: row.crafts?.id ?? "",
    name: row.crafts?.name ?? "Unknown craft",
    quantity: row.quantity,
    supplies: (row.crafts?.craft_supplies ?? []).map((cs) => ({
      name: cs.supplies?.name ?? "Unknown supply",
      unit: cs.supplies?.unit ?? null,
      qty_per_guest: cs.qty_per_guest,
      unit_cost: cs.supplies?.unit_cost ?? null,
    })),
  }))

  return { crafts }
}

// ── Supply Estimator ───────────────────────────────────────────────────────

export async function estimateSupplies(
  formData: FormData
): Promise<{ text: string } | { error: string }> {
  const supabase = await createSupabaseServerClient()

  const eventType = formData.get("event_type") as string
  const eventId = formData.get("event_id") as string
  const guestCount = parseInt(formData.get("guest_count") as string) || 0
  const buffer = parseFloat(formData.get("buffer") as string) || 15

  const table = eventType === "offsite" ? "offsite_events" : "in_studio_events"
  const craftTable =
    eventType === "offsite" ? "offsite_event_crafts" : "in_studio_event_crafts"
  const fk =
    eventType === "offsite" ? "offsite_event_id" : "in_studio_event_id"
  const eventSelect =
    eventType === "offsite"
      ? "title, event_date, guest_count, venue_address"
      : "title, event_date, guest_count"

  const [eventResult, craftsResult] = await Promise.all([
    supabase.from(table).select(eventSelect).eq("id", eventId).maybeSingle(),
    supabase
      .from(craftTable)
      .select(
        `quantity, notes,
         crafts (
           name,
           craft_supplies (
             qty_per_guest,
             supplies ( name, unit, unit_cost )
           )
         )`
      )
      .eq(fk, eventId),
  ])

  if (!eventResult.data) return { error: "Event not found" }

  type EventRow = { title: string; event_date: string; guest_count: number | null; venue_address?: string | null }
  const ev = eventResult.data as unknown as EventRow

  type RawCS = { qty_per_guest: number | null; supplies: { name: string; unit: string | null; unit_cost: number | null } | null }
  type RawRow = { quantity: number | null; notes: string | null; crafts: { name: string; craft_supplies: RawCS[] | null } | null }
  const rows = ((craftsResult.data ?? []) as unknown as RawRow[])

  // Build the craft+supply section of the prompt
  const craftLines = rows.length === 0
    ? "No crafts attached to this event."
    : rows.map((row) => {
        const craftName = row.crafts?.name ?? "Unknown craft"
        const qty = row.quantity != null ? ` (×${row.quantity})` : ""
        const supplies = (row.crafts?.craft_supplies ?? [])
          .map((cs) => {
            const s = cs.supplies
            if (!s) return null
            return `  - ${s.name} | ${s.unit ?? "unit"} | ${cs.qty_per_guest ?? "?"} per guest | $${s.unit_cost ?? "?"} per ${s.unit ?? "unit"}`
          })
          .filter(Boolean)
          .join("\n")
        return `${craftName}${qty}\n${supplies || "  (no supply data)"}`
      }).join("\n\n")

  const locationLine = ev.venue_address ? `Venue: ${ev.venue_address}` : ""

  const prompt = `You are a supply planning assistant for Forager Crafts, a professional craft event studio.

EVENT DETAILS
─────────────
Title: ${ev.title}
Date: ${ev.event_date}
Guest Count: ${guestCount} guests${locationLine ? `\n${locationLine}` : ""}
Supply Buffer: ${buffer}%

CRAFTS FOR THIS EVENT
─────────────────────
${craftLines}

─────────────────────────────────────────────────────────────────────────────

Calculate the total supplies needed. For each supply item:
  Base Qty     = qty_per_guest × ${guestCount}
  Buffered Qty = ceil(Base Qty × (1 + ${buffer}/100))
  Total Cost   = Buffered Qty × unit_cost

FORMAT YOUR RESPONSE EXACTLY AS:

For each craft, a table like this:
  CRAFT NAME (×quantity)
  Supply             | Unit  | Per Guest | Base Qty | Buffered Qty | Unit Cost | Total Cost
  ───────────────────|───────|─────────── |──────────|──────────────|───────────|───────────
  [supply name]      | [unit]|  [n]      |  [base]  |   [buffered] |   $[cost] |   $[total]

Then a grand total section:
  ═══════════════════════════════════════════════════════════════════
  TOTAL ESTIMATED SUPPLY COST: $[grand total]
  ═══════════════════════════════════════════════════════════════════

Then a brief NOTES & RECOMMENDATIONS section with any flags:
  - Items that need early ordering
  - High-cost line items worth reviewing
  - Any missing data that affects accuracy
  - Any other practical notes for the studio

Be precise. Round buffered quantities UP. Show all math.`

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    return { text }
  } catch (err) {
    console.error("[estimateSupplies] Claude error:", err)
    return { error: "Claude API error — check server logs" }
  }
}

// ── Save estimate as a note on the event ───────────────────────────────────

export async function saveEstimateToEvent(
  eventType: string,
  eventId: string,
  estimateText: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const table = eventType === "offsite" ? "offsite_events" : "in_studio_events"

  const { data } = await supabase
    .from(table)
    .select("notes")
    .eq("id", eventId)
    .maybeSingle()

  const current = ((data as { notes: string | null } | null)?.notes ?? "").trim()
  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const appended = [current, `--- Supply Estimate (${date}) ---\n${estimateText}`]
    .filter(Boolean)
    .join("\n\n")

  const { error } = await supabase
    .from(table)
    .update({ notes: appended })
    .eq("id", eventId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
