import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import { notFound } from "next/navigation"
import styles from "../../people.module.css"

type ClientDetail = {
  id: string
  first_name: string | null
  last_name: string | null
  company: string | null
  email: string | null
  phone: string | null
  notes: string | null
}

type EventRow = {
  id: string
  title: string
  status: string
  event_date: string
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function dotClass(status: string, s: Record<string, string>): string {
  if (status === "confirmed") return s.dotConfirmed
  if (status === "in_progress") return s.dotInProgress
  if (status === "completed" || status === "cancelled") return s.dotMuted
  return s.dotInquiry
}

function pillClass(status: string, s: Record<string, string>): string {
  switch (status) {
    case "confirmed": return s.pillGreen
    case "in_progress": return s.pillRed
    case "inquiry":
    case "proposal_sent": return s.pillAmber
    case "cancelled": return s.pillCancelled
    default: return s.pillMuted
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    inquiry: "Inquiry", proposal_sent: "Proposal Sent", confirmed: "Confirmed",
    in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
  }
  return map[status] ?? status
}

export default async function ClientProfilePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createSupabaseServerClient()

  const [clientResult, offsiteResult, studioResult] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("offsite_events")
      .select("id, title, status, event_date")
      .eq("client_id", params.id)
      .order("event_date"),
    supabase
      .from("in_studio_events")
      .select("id, title, status, event_date")
      .eq("client_id", params.id)
      .order("event_date"),
  ])

  if (!clientResult.data) notFound()

  const client = clientResult.data as unknown as ClientDetail
  const offsiteEvents = (offsiteResult.data ?? []) as EventRow[]
  const studioEvents = (studioResult.data ?? []) as EventRow[]

  const displayName =
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.company ||
    "Unnamed Client"

  const allEvents = [
    ...offsiteEvents.map((e) => ({ ...e, kind: "offsite" as const })),
    ...studioEvents.map((e) => ({ ...e, kind: "in-studio" as const })),
  ].sort((a, b) => a.event_date.localeCompare(b.event_date))

  const infoItems = [
    { label: "First Name", value: client.first_name ?? "—" },
    { label: "Last Name", value: client.last_name ?? "—" },
    { label: "Company", value: client.company ?? "—" },
    { label: "Email", value: client.email ?? "—" },
    { label: "Phone", value: client.phone ?? "—" },
    ...(client.notes ? [{ label: "Notes", value: client.notes }] : []),
  ]

  const sub = [client.company, client.email].filter(Boolean).join(" · ")

  return (
    <>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/people" className={styles.breadcrumbLink}>People</Link>
        <span className={styles.breadcrumbSep}>→</span>
        <Link href="/dashboard/people" className={styles.breadcrumbLink}>Clients</Link>
        <span className={styles.breadcrumbSep}>→</span>
        <span className={styles.breadcrumbCurrent}>{displayName}</span>
      </div>

      <div className={styles.profileHeader}>
        <div className={styles.profileTypeRow}>
          <span className={styles.profileTypeLabel}>Client</span>
        </div>
        <h2 className={styles.profileName}>
          {client.first_name ?? displayName}{" "}
          {client.last_name && (
            <em className={styles.profileNameAccent}>{client.last_name}</em>
          )}
        </h2>
        {sub && <p className={styles.profileSub}>{sub}</p>}
      </div>

      <div className={styles.profileDoubleRule} />

      <div className={styles.profileContent}>
        <div>
          <div className={styles.infoSectionTitle}>Details</div>
          {infoItems.map(({ label, value }) => (
            <div key={label} className={styles.infoItem}>
              <span className={styles.infoLabel}>{label}</span>
              <span className={styles.infoValue}>{value}</span>
            </div>
          ))}
        </div>

        <div>
          <div className={styles.eventsSectionTitle}>
            Events{allEvents.length > 0 ? ` · ${allEvents.length}` : ""}
          </div>
          {allEvents.length === 0 ? (
            <p className={styles.noEvents}>No events linked to this client.</p>
          ) : (
            allEvents.map((e) => (
              <Link
                key={`${e.kind}-${e.id}`}
                href={`/dashboard/events/${e.kind}/${e.id}`}
                className={styles.relatedEventRow}
              >
                <div
                  className={`${styles.statusDot} ${dotClass(e.status, styles as unknown as Record<string, string>)}`}
                />
                <div className={styles.relatedEventMain}>
                  <div className={styles.relatedEventTitle}>{e.title}</div>
                  <div className={styles.relatedEventMeta}>
                    {formatDate(e.event_date)} · {e.kind === "offsite" ? "Offsite" : "In-Studio"}
                  </div>
                </div>
                <span
                  className={`${styles.statusPill} ${pillClass(e.status, styles as unknown as Record<string, string>)}`}
                >
                  {statusLabel(e.status)}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  )
}
