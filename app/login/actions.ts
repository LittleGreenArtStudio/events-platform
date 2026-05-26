"use server"

import { createSupabaseServerClient } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect("/login?error=Invalid+email+or+password")
  }

  redirect("/dashboard")
}
