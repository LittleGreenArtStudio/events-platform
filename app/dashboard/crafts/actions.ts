"use server"

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseServerClient } from "@/lib/auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export type AISuggestion = {
  name: string
  unit: string
  qty_per_guest: number | null
  unit_cost: number | null
  vendor_suggestion?: string
}

// ── Create Craft ──────────────────────────────────────────────────────────

export async function createCraft(formData: FormData) {
  const supabase = await createSupabaseServerClient()

  const timeRaw = formData.get("time_per_guest") as string
  const minRaw = formData.get("min_guests") as string
  const maxRaw = formData.get("max_guests") as string

  const { data, error } = await supabase
    .from("crafts")
    .insert({
      name: (formData.get("name") as string).trim() || "New Craft",
      description: (formData.get("description") as string).trim() || null,
      category: (formData.get("category") as string) || null,
      skill_level: (formData.get("skill_level") as string) || null,
      time_per_guest: timeRaw ? Number(timeRaw) : null,
      min_guests: minRaw ? Number(minRaw) : null,
      max_guests: maxRaw ? Number(maxRaw) : null,
      setup_notes: (formData.get("setup_notes") as string).trim() || null,
      teardown_notes: (formData.get("teardown_notes") as string).trim() || null,
      is_active: formData.get("is_active") === "true",
    })
    .select("id")
    .single()

  if (error) {
    console.error("[crafts/createCraft]", error.code, error.message)
    const msg = encodeURIComponent(`${error.code}: ${error.message}`)
    redirect(`/dashboard/crafts/new?error=${msg}`)
  }

  redirect(`/dashboard/crafts/${(data as { id: string }).id}`)
}

// ── Add Existing Supply to Craft ──────────────────────────────────────────

export async function addExistingSupply(
  craftId: string,
  supplyId: string,
  qtyPerGuest: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.from("craft_supplies").insert({
    craft_id: craftId,
    supply_id: supplyId,
    qty_per_guest: parseFloat(qtyPerGuest) || null,
  })

  if (error) {
    console.error("[crafts/addExistingSupply]", error.message)
    return { error: error.message }
  }

  revalidatePath(`/dashboard/crafts/${craftId}`)
  return { ok: true }
}

// ── Create New Supply and Add to Craft ────────────────────────────────────

export async function createAndAddSupply(
  craftId: string,
  formData: FormData
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()

  const costRaw = formData.get("unit_cost") as string
  const vendorRaw = formData.get("vendor_id") as string

  const { data: supplyData, error: supplyError } = await supabase
    .from("supplies")
    .insert({
      name: (formData.get("name") as string).trim() || "New Supply",
      unit: (formData.get("unit") as string).trim() || null,
      unit_cost: costRaw ? parseFloat(costRaw) : null,
      vendor_id: vendorRaw || null,
    })
    .select("id")
    .single()

  if (supplyError) {
    console.error("[crafts/createAndAddSupply] supply insert:", supplyError.message)
    return { error: supplyError.message }
  }

  const supplyId = (supplyData as { id: string }).id
  const qtyRaw = formData.get("qty_per_guest") as string

  const { error: linkError } = await supabase.from("craft_supplies").insert({
    craft_id: craftId,
    supply_id: supplyId,
    qty_per_guest: qtyRaw ? parseFloat(qtyRaw) : null,
  })

  if (linkError) {
    console.error("[crafts/createAndAddSupply] link insert:", linkError.message)
    return { error: linkError.message }
  }

  revalidatePath(`/dashboard/crafts/${craftId}`)
  return { ok: true }
}

// ── AI Supply Drafter ─────────────────────────────────────────────────────

export async function draftSuppliesWithAI(
  craftName: string,
  category: string | null
): Promise<{ suggestions: AISuggestion[] } | { error: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are a craft supplies expert helping a craft events studio.
For the craft "${craftName}"${category ? ` in the category "${category}"` : ""}, suggest a realistic supply list for a group craft workshop setting.

For each supply provide:
- name: the supply name
- unit: unit of measure (sheet, bottle, yard, each, oz, ft, set, etc.)
- qty_per_guest: realistic quantity per participant (decimals like 0.5 are fine)
- unit_cost: estimated unit cost in USD based on bulk art supply pricing
- vendor_suggestion: a realistic vendor (Blick Art Materials, Michaels, Amazon, etc.)

Return ONLY a valid JSON array with no markdown, no explanation, no code blocks. Example:
[{"name":"Watercolor Paper","unit":"sheet","qty_per_guest":2,"unit_cost":0.45,"vendor_suggestion":"Blick Art Materials"}]

Suggest 6-10 supplies needed for this craft in a group workshop setting.`

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    const suggestions = JSON.parse(jsonText) as AISuggestion[]
    return { suggestions }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[draftSuppliesWithAI]", msg)
    return { error: `AI error: ${msg}` }
  }
}

// ── Save AI Suggestions ───────────────────────────────────────────────────

export async function saveSupplySuggestions(
  craftId: string,
  items: Array<{ name: string; unit: string; qty_per_guest: number | null; unit_cost: number | null }>
): Promise<{ ok: true; count: number } | { error: string }> {
  const supabase = await createSupabaseServerClient()

  for (const item of items) {
    const { data: supplyData, error: supplyError } = await supabase
      .from("supplies")
      .insert({
        name: item.name,
        unit: item.unit || null,
        unit_cost: item.unit_cost,
      })
      .select("id")
      .single()

    if (supplyError) {
      console.error("[saveSupplySuggestions] supply:", supplyError.message)
      return { error: supplyError.message }
    }

    const { error: linkError } = await supabase.from("craft_supplies").insert({
      craft_id: craftId,
      supply_id: (supplyData as { id: string }).id,
      qty_per_guest: item.qty_per_guest,
    })

    if (linkError) {
      console.error("[saveSupplySuggestions] link:", linkError.message)
      return { error: linkError.message }
    }
  }

  revalidatePath(`/dashboard/crafts/${craftId}`)
  return { ok: true, count: items.length }
}

// ── Photo Upload ──────────────────────────────────────────────────────────

// Storage upload happens client-side in PhotoUpload.tsx; this action
// only appends the resulting public URL to the craft's image_urls array.
export async function addCraftPhotoUrl(
  craftId: string,
  url: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()

  const { data: craftData } = await supabase
    .from("crafts")
    .select("image_urls")
    .eq("id", craftId)
    .maybeSingle()

  type ImgRow = { image_urls: string[] | null }
  const current = ((craftData as unknown as ImgRow)?.image_urls ?? [])

  const { error: updateError } = await supabase
    .from("crafts")
    .update({ image_urls: [...current, url] })
    .eq("id", craftId)

  if (updateError) {
    console.error("[addCraftPhotoUrl]", updateError.message)
    return { error: updateError.message }
  }

  revalidatePath(`/dashboard/crafts/${craftId}`)
  revalidatePath("/dashboard/crafts")
  return { ok: true }
}

// ── Photo Remove ──────────────────────────────────────────────────────────

export async function removeCraftPhoto(
  craftId: string,
  photoUrl: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()

  const match = photoUrl.match(/\/craft-images\/(.+)$/)
  if (match) {
    await supabase.storage.from("craft-images").remove([match[1]])
  }

  const { data: craftData } = await supabase
    .from("crafts")
    .select("image_urls")
    .eq("id", craftId)
    .maybeSingle()

  type ImgRow = { image_urls: string[] | null }
  const current = ((craftData as unknown as ImgRow)?.image_urls ?? [])

  const { error } = await supabase
    .from("crafts")
    .update({ image_urls: current.filter((u) => u !== photoUrl) })
    .eq("id", craftId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/crafts/${craftId}`)
  revalidatePath("/dashboard/crafts")
  return { ok: true }
}

// ── Remove Supply from Craft ──────────────────────────────────────────────

export async function removeCraftSupply(
  craftSupplyId: string,
  craftId: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from("craft_supplies")
    .delete()
    .eq("id", craftSupplyId)

  if (error) {
    console.error("[crafts/removeCraftSupply]", error.message)
    return { error: error.message }
  }

  revalidatePath(`/dashboard/crafts/${craftId}`)
  return { ok: true }
}
