import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import PeopleTabBar from "./_components/PeopleTabBar"
import styles from "./people.module.css"

type ClientRow = {
  id: string
  first_name: string | null
  last_name: string | null
  company: string | null
  email: string | null
  phone: string | null
}

export default async function PeopleClientsPage() {
  const supabase = await createSupabaseServerClient()

  const [
    clientsResult,
    { count: staffCount },
    { count: vendorCount },
    offsiteIdsResult,
    studioIdsResult,
  ] = await Promise.all([
    supabase.from("clients").select("*").order("first_name"),
    supabase.from("staff").select("*", { count: "exact", head: true }),
    supabase.from("vendors").select("*", { count: "exact", head: true }),
    supabase.from("offsite_events").select("client_id").not("client_id", "is", null),
    supabase.from("in_studio_events").select("client_id").not("client_id", "is", null),
  ])

  const clients = (clientsResult.data ?? []) as unknown as ClientRow[]

  // Build per-client event count
  type IdRow = { client_id: string }
  const eventCounts = new Map<string, number>()
  for (const { client_id } of [
    ...((offsiteIdsResult.data ?? []) as IdRow[]),
    ...((studioIdsResult.data ?? []) as IdRow[]),
  ]) {
    if (client_id) eventCounts.set(client_id, (eventCounts.get(client_id) ?? 0) + 1)
  }

  return (
    <>
      <PeopleTabBar
        activeTab="clients"
        counts={{
          clients: clients.length,
          staff: staffCount ?? 0,
          vendors: vendorCount ?? 0,
        }}
      />
      <div className={styles.peopleList}>
        {clients.length === 0 ? (
          <p className={styles.emptyState}>No clients yet.</p>
        ) : (
          clients.map((c) => {
            const displayName =
              [c.first_name, c.last_name].filter(Boolean).join(" ") ||
              c.company ||
              "Unnamed Client"
            const meta = [c.company, c.email, c.phone].filter(Boolean).join(" · ")
            const count = eventCounts.get(c.id) ?? 0
            return (
              <Link
                key={c.id}
                href={`/dashboard/people/clients/${c.id}`}
                className={styles.personRow}
              >
                <div className={styles.personMain}>
                  <div className={styles.personName}>{displayName}</div>
                  {meta && <div className={styles.personMeta}>{meta}</div>}
                </div>
                <div className={styles.personRight}>
                  {count > 0 && (
                    <span className={styles.eventCountBadge}>
                      {count} event{count !== 1 ? "s" : ""}
                    </span>
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
