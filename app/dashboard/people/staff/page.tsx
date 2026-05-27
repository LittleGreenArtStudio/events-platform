import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import PeopleTabBar from "../_components/PeopleTabBar"
import styles from "../people.module.css"

type StaffRow = {
  id: string
  first_name: string | null
  last_name: string | null
  role_title: string | null
  email: string | null
  phone: string | null
  hourly_rate: number | null
  is_active: boolean
}

function formatRate(rate: number | null): string | null {
  if (rate == null) return null
  return `$${rate % 1 === 0 ? rate : rate.toFixed(2)}/hr`
}

export default async function PeopleStaffPage() {
  const supabase = await createSupabaseServerClient()

  const [staffResult, { count: clientCount }, { count: vendorCount }] =
    await Promise.all([
      supabase.from("staff").select("*").order("first_name"),
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("vendors").select("*", { count: "exact", head: true }),
    ])

  const staff = (staffResult.data ?? []) as unknown as StaffRow[]

  return (
    <>
      <PeopleTabBar
        activeTab="staff"
        counts={{
          clients: clientCount ?? 0,
          staff: staff.length,
          vendors: vendorCount ?? 0,
        }}
      />
      <div className={styles.peopleList}>
        {staff.length === 0 ? (
          <p className={styles.emptyState}>No staff members yet.</p>
        ) : (
          staff.map((s) => {
            const displayName =
              [s.first_name, s.last_name].filter(Boolean).join(" ") || "—"
            const meta = [s.role_title, s.email, s.phone].filter(Boolean).join(" · ")
            const rate = formatRate(s.hourly_rate)
            return (
              <Link
                key={s.id}
                href={`/dashboard/people/staff/${s.id}`}
                className={styles.personRow}
              >
                <div className={styles.personMain}>
                  <div className={styles.personName}>{displayName}</div>
                  {meta && <div className={styles.personMeta}>{meta}</div>}
                </div>
                <div className={styles.personRight}>
                  {rate && <span className={styles.rateBadge}>{rate}</span>}
                  <span className={s.is_active ? styles.activePill : styles.inactivePill}>
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
