import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import Image from "next/image"
import { BLUR_DATA_URL } from "@/lib/blur-data-url"
import styles from "./crafts.module.css"

const CATEGORIES = [
  "Visual Arts",
  "Candle Making",
  "Floral & Outdoor",
  "Textiles & Fibercraft",
  "Jewelry & Metals",
  "Wellness",
  "All Things Autumn",
  "Winter Holidays",
]

type Craft = {
  id: string
  name: string
  category: string | null
  skill_level: string | null
  time_per_guest: number | null
  min_guests: number | null
  max_guests: number | null
  is_active: boolean | null
  image_urls: string[] | null
}

function skillClass(level: string | null, s: Record<string, string>) {
  if (level === "beginner") return s.skillBeginner
  if (level === "intermediate") return s.skillIntermediate
  if (level === "advanced") return s.skillAdvanced
  return s.skillUnknown
}

export default async function CraftLibraryPage({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const supabase = await createSupabaseServerClient()
  const activeCategory = searchParams.category ?? ""

  let query = supabase
    .from("crafts")
    .select("id, name, category, skill_level, time_per_guest, min_guests, max_guests, is_active, image_urls")
    .order("name")

  if (activeCategory) query = query.eq("category", activeCategory)

  const { data } = await query
  const crafts = (data ?? []) as unknown as Craft[]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.listHeader}>
        <h1 className={styles.listTitle}>Craft Library</h1>
        <Link href="/dashboard/crafts/new" className={styles.newBtn}>
          + New Craft
        </Link>
      </div>

      {/* Category filter tabs */}
      <div className={styles.filterBar}>
        <Link
          href="/dashboard/crafts"
          className={`${styles.filterTab} ${!activeCategory ? styles.filterTabActive : ""}`}
        >
          All
        </Link>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/dashboard/crafts?category=${encodeURIComponent(cat)}`}
            className={`${styles.filterTab} ${activeCategory === cat ? styles.filterTabActive : ""}`}
          >
            {cat}
          </Link>
        ))}
      </div>

      {/* Craft list */}
      <div className={styles.craftList}>
        {crafts.length === 0 ? (
          <p className={styles.emptyState}>
            {activeCategory ? `No crafts in "${activeCategory}" yet.` : "No crafts yet — add your first one."}
          </p>
        ) : (
          crafts.map((craft, craftIdx) => {
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
                {craft.image_urls?.[0] && (
                  <div className={styles.craftThumb}>
                    <Image
                      src={craft.image_urls[0]}
                      alt=""
                      fill
                      sizes="400px"
                      style={{ objectFit: "cover" }}
                      priority={craftIdx < 8}
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                    />
                  </div>
                )}
                <div className={styles.craftMain}>
                  <div className={styles.craftName}>{craft.name}</div>
                  <div className={styles.craftMeta}>
                    {craft.category && (
                      <span className={styles.categoryLabel}>{craft.category}</span>
                    )}
                    {craft.category && metaParts.length > 0 && (
                      <span className={styles.craftMetaSep}>·</span>
                    )}
                    {metaParts.join(" · ")}
                  </div>
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
