import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import PeopleTabBar from "../_components/PeopleTabBar"
import styles from "../people.module.css"

type VendorRow = {
  id: string
  name: string
  category: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
}

export default async function PeopleVendorsPage() {
  const supabase = await createSupabaseServerClient()

  const [vendorsResult, { count: clientCount }, { count: staffCount }] =
    await Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("staff").select("*", { count: "exact", head: true }),
    ])

  const vendors = (vendorsResult.data ?? []) as unknown as VendorRow[]

  return (
    <>
      <PeopleTabBar
        activeTab="vendors"
        counts={{
          clients: clientCount ?? 0,
          staff: staffCount ?? 0,
          vendors: vendors.length,
        }}
      />
      <div className={styles.peopleList}>
        {vendors.length === 0 ? (
          <p className={styles.emptyState}>No vendors yet.</p>
        ) : (
          vendors.map((v) => {
            const meta = [v.category, v.contact_name, v.email, v.phone]
              .filter(Boolean)
              .join(" · ")
            return (
              <Link
                key={v.id}
                href={`/dashboard/people/vendors/${v.id}`}
                className={styles.personRow}
              >
                <div className={styles.personMain}>
                  <div className={styles.personName}>{v.name}</div>
                  {meta && <div className={styles.personMeta}>{meta}</div>}
                </div>
                <div className={styles.personRight}>
                  {v.category && (
                    <span className={styles.eventCountBadge}>{v.category}</span>
                  )}
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
