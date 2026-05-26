import { createSupabaseServerClient } from "@/lib/auth"
import { redirect } from "next/navigation"
import { signOut } from "./actions"

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("display_name, role")
    .eq("user_id", user.id)
    .single()

  const displayName = roleData?.display_name ?? user.email
  const roleLabel =
    roleData?.role === "admin" ? "Administrator" : "Assistant"

  return (
    <main className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between">
        <span className="font-serif text-xl text-stone-800 tracking-wide">
          Craft Studio
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-stone-400 hover:text-stone-700 transition px-4 py-2 rounded-lg hover:bg-stone-100"
          >
            Sign out
          </button>
        </form>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-serif text-stone-800 tracking-wide">
          Welcome, {displayName}
        </h1>
        <p className="mt-3 text-stone-400 text-sm tracking-wide uppercase">
          {roleLabel} &middot; Craft Studio Operations
        </p>
      </div>
    </main>
  )
}
