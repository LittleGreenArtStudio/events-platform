import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseServerClient } from "@/lib/auth"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { eventType, eventId } = body as { eventType?: string; eventId?: string }
  if (!eventType || !eventId) {
    return NextResponse.json({ error: "eventType and eventId are required" }, { status: 400 })
  }

  const isOffsite = eventType === "offsite"
  const table = isOffsite ? "offsite_events" : "in_studio_events"
  const craftTable = isOffsite ? "offsite_event_crafts" : "in_studio_event_crafts"
  // craft junction tables always use event_id, not the event-specific FK
  const craftEventFk = "event_id"
  const eventSelect = isOffsite
    ? "title, event_date, guest_count, venue_address, notes, clients(first_name, last_name, company, email, phone)"
    : "title, event_date, guest_count, notes, clients(first_name, last_name, company, email, phone)"

  const [eventResult, craftsResult] = await Promise.all([
    supabase.from(table).select(eventSelect).eq("id", eventId).maybeSingle(),
    supabase
      .from(craftTable)
      .select(
        `guest_count_override, notes,
         crafts (
           name, description,
           craft_supplies (
             qty_per_guest,
             supplies ( name, unit, unit_cost )
           )
         )`
      )
      .eq(craftEventFk, eventId),
  ])

  if (!eventResult.data) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  type ClientRow = { first_name: string | null; last_name: string | null; company: string | null; email: string | null; phone: string | null }
  type EventRow = { title: string; event_date: string; guest_count: number | null; venue_address?: string | null; notes: string | null; clients: ClientRow | null }
  type RawCS = { qty_per_guest: number | null; supplies: { name: string; unit: string | null; unit_cost: number | null } | null }
  type RawCraftRow = { guest_count_override: number | null; notes: string | null; crafts: { name: string; description: string | null; craft_supplies: RawCS[] | null } | null }

  const ev = eventResult.data as unknown as EventRow
  const craftRows = ((craftsResult.data ?? []) as unknown as RawCraftRow[])

  const clientName = ev.clients
    ? [[ev.clients.first_name, ev.clients.last_name].filter(Boolean).join(" "), ev.clients.company].filter(Boolean).join(" / ") || "—"
    : "—"
  const clientContact = ev.clients
    ? [ev.clients.email, ev.clients.phone].filter(Boolean).join(" · ") || "—"
    : "—"
  const venue = (ev as EventRow & { venue_address?: string | null }).venue_address ?? (isOffsite ? "—" : "Forager Crafts Studio")

  const craftSection = craftRows.length === 0
    ? "No crafts attached to this event."
    : craftRows.map((row) => {
        const name = row.crafts?.name ?? "Unknown craft"
        const desc = row.crafts?.description ? `\n  Description: ${row.crafts.description}` : ""
        const qty = row.guest_count_override != null ? ` (${row.guest_count_override} guests)` : ""
        const craftNote = row.notes ? `\n  Notes: ${row.notes}` : ""
        const supplies = (row.crafts?.craft_supplies ?? [])
          .map((cs) => {
            const s = cs.supplies
            if (!s) return null
            return `  - ${s.name} | ${cs.qty_per_guest ?? "?"} per guest | ${s.unit ?? "unit"} | $${s.unit_cost ?? "?"} per ${s.unit ?? "unit"}`
          })
          .filter(Boolean)
          .join("\n")
        return `${name}${qty}${desc}${craftNote}\n${supplies || "  (no supply data)"}`
      }).join("\n\n")

  const prompt = `You are the event coordinator for Forager Crafts, a professional craft event studio. Generate a concise, print-ready event brief for the team to use day-of.

EVENT DETAILS
─────────────
Title: ${ev.title}
Date: ${ev.event_date}
Type: ${isOffsite ? "Offsite Event" : "In-Studio Event"}
Guest Count: ${ev.guest_count ?? "TBD"}
Venue: ${venue}

CLIENT
──────
Name: ${clientName}
Contact: ${clientContact}

CRAFTS PLANNED
──────────────
${craftSection}

NOTES
─────
${ev.notes?.trim() || "No additional notes."}

─────────────────────────────────────────────────────────────────────────────

Write a professional event brief with the following sections. Use plain text formatting (no markdown symbols like ** or ##). Use ALL CAPS for section headers, dashed lines as dividers.

1. EVENT OVERVIEW — one short paragraph summarizing the event, who it's for, and what we're delivering

2. CLIENT CONTACT — client name and contact info, plus any relevant notes from the event record

3. DAY-OF TIMELINE — a realistic timeline from setup through teardown (make reasonable assumptions for a ${isOffsite ? "offsite" : "studio"} event of ${ev.guest_count ?? "this size"} guests with the crafts listed). Format as:
   [TIME]  [ACTIVITY]

4. CRAFT & DESIGN PLAN — for each craft, list the craft name, quantity, supplies needed (with buffered amounts at 15% over guest count), and any prep notes

5. STAFF CALL SHEET — note that staff assignments are pending, list the roles typically needed for this type of event

6. OPEN ITEMS — list anything missing, unclear, or that needs follow-up before the event

7. RISKS & WATCH-OUTS — flag anything that could go wrong: tight timelines, high-cost supplies, missing data, venue logistics for ${isOffsite ? "offsite" : "studio"} events

Keep it tight. This is a working document, not a sales pitch.`

  const encoder = new TextEncoder()
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  })

  const readable = new ReadableStream({
    start(controller) {
      stream.on("text", (delta) => {
        controller.enqueue(encoder.encode(delta))
      })
      stream.on("end", () => {
        controller.close()
      })
      stream.on("error", (err) => {
        console.error("[copilot/brief] stream error:", err)
        controller.error(err)
      })
    },
    cancel() {
      stream.controller.abort()
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
