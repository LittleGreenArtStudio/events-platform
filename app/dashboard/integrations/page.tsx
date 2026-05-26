import { createSupabaseServerClient } from "@/lib/auth"
import GoogleCalendarCard from "./GoogleCalendarCard"
import styles from "./integrations.module.css"

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string }
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: tokenRow } = user
    ? await supabase
        .from("google_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null }

  const isConnected = !!tokenRow

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Integrations</h2>
      <p className={styles.sub}>
        Connect external services to sync data with Forager Crafts.
      </p>

      {searchParams.connected === "1" && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          Google account connected successfully.
        </div>
      )}

      {searchParams.error && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          {decodeURIComponent(searchParams.error)}
        </div>
      )}

      <GoogleCalendarCard connected={isConnected} />
    </div>
  )
}
