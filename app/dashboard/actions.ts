"use server"

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseServerClient } from "@/lib/auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

// ── Task creation ─────────────────────────────────────────────────────────

export async function createDashboardTask(
  title: string,
  priority: string,
  dueDate: string,
  notes: string,
  eventId: string,
  eventType: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()

  const payload: Record<string, unknown> = {
    title: title.trim(),
    status: "todo",
    priority: priority || "normal",
    due_date: dueDate || null,
    description: notes.trim() || null,
  }

  if (eventId && eventType === "offsite") payload.offsite_event_id = eventId
  if (eventId && eventType === "in-studio") payload.in_studio_event_id = eventId

  const { error } = await supabase.from("tasks").insert(payload)
  if (error) return { error: error.message }

  revalidatePath("/dashboard")
  return { ok: true }
}

// ── Task toggle ───────────────────────────────────────────────────────────

export async function toggleDashboardTask(
  taskId: string,
  currentStatus: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const newStatus = currentStatus === "done" ? "todo" : "done"
  const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId)
  if (error) return { error: error.message }
  revalidatePath("/dashboard")
  return { ok: true }
}

// ── AI task suggestions ───────────────────────────────────────────────────

export async function suggestTasksWithAI(
  taskTitle: string,
  eventId: string,
  eventType: string
): Promise<{ suggestions: string[] } | { error: string }> {
  const supabase = await createSupabaseServerClient()

  const isOffsite = eventType === "offsite"
  const table = isOffsite ? "offsite_events" : "in_studio_events"
  const craftTable = isOffsite ? "offsite_event_crafts" : "in_studio_event_crafts"
  const fk = isOffsite ? "offsite_event_id" : "in_studio_event_id"

  const [eventResult, craftsResult, tasksResult] = await Promise.all([
    supabase
      .from(table)
      .select("title, event_date, guest_count, notes")
      .eq("id", eventId)
      .maybeSingle(),
    supabase
      .from(craftTable)
      .select("crafts(name)")
      .eq("event_id", eventId),
    supabase
      .from("tasks")
      .select("title")
      .eq(fk, eventId)
      .in("status", ["todo", "in_progress"]),
  ])

  type EvRow = { title: string; event_date: string; guest_count: number | null; notes: string | null }
  type CraftName = { crafts: { name: string } | null }
  type TaskTitle = { title: string }

  const ev = eventResult.data as unknown as EvRow | null
  if (!ev) return { error: "Event not found" }

  const craftNames = ((craftsResult.data ?? []) as unknown as CraftName[])
    .map((r) => r.crafts?.name)
    .filter(Boolean)
    .join(", ") || "none"

  const existingTitles = ((tasksResult.data ?? []) as unknown as TaskTitle[])
    .map((t) => `- ${t.title}`)
    .join("\n") || "none"

  const prompt = `You are a craft event coordinator assistant for Forager Crafts Studio.

Event: ${ev.title}
Date: ${ev.event_date}
Guests: ${ev.guest_count ?? "TBD"}
Crafts: ${craftNames}
Notes: ${ev.notes?.trim() || "none"}

The coordinator is working on a task called: "${taskTitle}"

Existing open tasks for this event:
${existingTitles}

Suggest 4 additional tasks that would be important to complete for this event. Focus on practical, actionable items related to the event type, crafts, and guest count. Do NOT repeat existing tasks.

Return ONLY a JSON array of task title strings, no markdown, no explanation. Example:
["Order extra glue guns", "Confirm venue setup time", "Print guest list", "Brief staff on craft stations"]`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    })

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()

    const suggestions = JSON.parse(raw) as string[]
    return { suggestions: suggestions.slice(0, 5) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[suggestTasksWithAI]", msg)
    return { error: `AI error: ${msg}` }
  }
}
