"use server"

import { createSupabaseServerClient } from "@/lib/auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

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
