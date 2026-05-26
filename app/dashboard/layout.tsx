import { getCachedUser, createSupabaseServerClient } from "@/lib/auth"
import { redirect } from "next/navigation"
import { signOut } from "./actions"
import MastheadTitle from "./_components/MastheadTitle"
import PageLabel from "./_components/PageLabel"
import Nav from "./_components/Nav"
import styles from "./dashboard.module.css"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()
  if (!user) redirect("/login")

  const supabase = await createSupabaseServerClient()
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("display_name, role")
    .eq("user_id", user.id)
    .maybeSingle()

  const displayName = roleData?.display_name ?? user.email ?? "User"
  const appMetaRole = (user.app_metadata as Record<string, unknown>)
    ?.role as string | undefined
  const resolvedRole = roleData?.role ?? appMetaRole
  const roleLabel =
    resolvedRole?.toLowerCase() === "admin" ? "Admin" : "Assistant"
  const mastheadDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.mastheadLeft}>
          <span className={styles.studioName}>Forager Crafts</span>
          <span className={styles.mastheadDate}>{mastheadDate}</span>
        </div>
        <div className={styles.mastheadCenter}>
          <MastheadTitle />
        </div>
        <div className={styles.mastheadRight}>
          <PageLabel />
          <span className={styles.mastheadUser}>{displayName}</span>
          <span className={styles.mastheadRole}>{roleLabel}</span>
          <form action={signOut}>
            <button type="submit" className={styles.signOutBtn}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className={styles.doubleRule} />
      <Nav />
      {children}
    </div>
  )
}
