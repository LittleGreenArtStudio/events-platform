"use server"

import { createSupabaseServerClient } from "@/lib/auth"
import { redirect } from "next/navigation"

// ── Clients ───────────────────────────────────────────────────────────────

export async function createClient(formData: FormData) {
  const supabase = await createSupabaseServerClient()

  const firstName = (formData.get("first_name") as string).trim()
  const lastName = (formData.get("last_name") as string).trim()
  const company = (formData.get("company") as string).trim()

  const name =
    [firstName, lastName].filter(Boolean).join(" ") || company || "New Client"

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      first_name: firstName || null,
      last_name: lastName || null,
      company: company || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[people/createClient]", error.code, error.message)
    const msg = encodeURIComponent(`${error.code}: ${error.message}`)
    redirect(`/dashboard/people/clients/new?error=${msg}`)
  }

  redirect(`/dashboard/people/clients/${(data as { id: string }).id}`)
}

// ── Staff ─────────────────────────────────────────────────────────────────

export async function createStaff(formData: FormData) {
  const supabase = await createSupabaseServerClient()

  const firstName = (formData.get("first_name") as string).trim()
  const lastName = (formData.get("last_name") as string).trim()
  const hourlyRaw = formData.get("hourly_rate") as string

  const { data, error } = await supabase
    .from("staff")
    .insert({
      first_name: firstName || null,
      last_name: lastName || null,
      name: [firstName, lastName].filter(Boolean).join(" ") || "New Staff Member",
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      role_title: (formData.get("role_title") as string) || null,
      hourly_rate: hourlyRaw ? Number(hourlyRaw) : null,
      notes: (formData.get("notes") as string) || null,
      is_active: true,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[people/createStaff]", error.code, error.message)
    const msg = encodeURIComponent(`${error.code}: ${error.message}`)
    redirect(`/dashboard/people/staff/new?error=${msg}`)
  }

  redirect(`/dashboard/people/staff/${(data as { id: string }).id}`)
}

// ── Vendors ───────────────────────────────────────────────────────────────

export async function createVendor(formData: FormData) {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      name: (formData.get("name") as string).trim() || "New Vendor",
      contact_name: (formData.get("contact_name") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      website: (formData.get("website") as string) || null,
      category: (formData.get("category") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[people/createVendor]", error.code, error.message)
    const msg = encodeURIComponent(`${error.code}: ${error.message}`)
    redirect(`/dashboard/people/vendors/new?error=${msg}`)
  }

  redirect(`/dashboard/people/vendors/${(data as { id: string }).id}`)
}
