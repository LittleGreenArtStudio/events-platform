import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import styles from "./crafts.module.css"

type Craft = {
  id: string
  name: string
  skill_level: string | null
  time_per_guest: number | null
  min_guests: number | null
  max_guests: number | null
  is_active: boolean | null
}

function skillClass(level: string | null, s: Record<string, string>) {
  if (level === "beginner") return s.skillBeginner
  if (level === "intermediate") return s.skillIntermediate
  if (level === "advanced") return s.skillAdvanced
  return s.skillUnknown
}

export default async function CraftLibraryPage() {
  const supabase = await createSupabaseServerClient()

  const { data } = await supabase
    .from("crafts")
    .select("id, name, skill_level, time_per_guest, min_guests, max_guests, is_active")
    .order("name")

  const crafts = (data ?? []) as unknown as Craft[]

  return (
    <div className={styles.page}>
      <div className={styles.listHeader}>
        <h1 className={styles.listTitle}>Craft Library</h1>
        <Link href="/dashboard/crafts/new" className={styles.newBtn}>
          + New Craft
        </Link>
      </div>

      <div className={styles.craftList}>
        {crafts.length === 0 ? (
          <p className={styles.emptyState}>No crafts yet — add your first one.</p>
        ) : (
          crafts.map((craft) => {
            const metaParts: string[] = []
            if (craft.time_per_guest) metaParts.push(`${craft.time_per_guest} min / guest`)
            if (craft.min_guests != null || craft.max_guests != null) {
              const range = [craft.min_guests, craft.max_guests]
                .filter((n) => n != null)
                .join("–")
              metaParts.push(`${range} guests`)
            }

            return (
              <Link
                key={craft.id}
                href={`/dashboard/crafts/${craft.id}`}
                className={styles.craftRow}
              >
                <div className={styles.craftMain}>
                  <div className={styles.craftName}>{craft.name}</div>
                  {metaParts.length > 0 && (
                    <div className={styles.craftMeta}>{metaParts.join(" · ")}</div>
                  )}
                </div>
                <div className={styles.craftRight}>
                  {craft.skill_level && (
                    <span className={`${styles.skillPill} ${skillClass(craft.skill_level, styles)}`}>
                      {craft.skill_level}
                    </span>
                  )}
                  <span className={craft.is_active ? styles.activePill : styles.inactivePill}>
                    {craft.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
