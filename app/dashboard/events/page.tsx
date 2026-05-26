import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import styles from "./events.module.css"

type Tab = "offsite" | "in-studio"

type ClientRef = { name: string }

type EventListRow = {
  id: string
  title: string
  status: string
  event_date: string
  guest_count: number | null
  clients: ClientRef | null
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function dotClass(status: string): string {
  if (status === "confirmed") return styles.dotConfirmed
  if (status === "in_progress") return styles.dotInProgress
  if (status === "completed" || status === "cancelled") return styles.dotMuted
  return styles.dotInquiry
}

function pillClass(status: string): string {
  switch (status) {
    case "confirmed":
      return styles.pillGreen
    case "in_progress":
      return styles.pillRed
    case "inquiry":
    case "proposal_sent":
      return styles.pillAmber
    case "cancelled":
      return styles.pillCancelled
    default:
      return styles.pillMuted
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    inquiry: "Inquiry",
    proposal_sent: "Proposal Sent",
    confirmed: "Confirmed",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }
  return map[status] ?? status
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const tab: Tab =
    searchParams.tab === "in-studio" ? "in-studio" : "offsite"

  const supabase = await createSupabaseServerClient()

  const [offsiteResult, inStudioResult] = await Promise.all([
    supabase
      .from("offsite_events")
      .select("id, title, status, event_date, guest_count, clients(name)")
      .order("event_date"),
    supabase
      .from("in_studio_events")
      .select("id, title, status, event_date, guest_count, clients(name)")
      .order("event_date"),
  ])

  const offsiteEvents = (offsiteResult.data ?? []) as unknown as EventListRow[]
  const inStudioEvents = (inStudioResult.data ?? []) as unknown as EventListRow[]
  const activeEvents = tab === "offsite" ? offsiteEvents : inStudioEvents

  return (
    <>
      {/* ── Tab Bar ── */}
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          <Link
            href="/dashboard/events?tab=offsite"
            className={`${styles.tab} ${tab === "offsite" ? styles.tabActive : ""}`}
          >
            Offsite Events
            <span className={styles.tabBadge}>{offsiteEvents.length}</span>
          </Link>
          <Link
            href="/dashboard/events?tab=in-studio"
            className={`${styles.tab} ${tab === "in-studio" ? styles.tabActive : ""}`}
          >
            In-Studio Events
            <span className={styles.tabBadge}>{inStudioEvents.length}</span>
          </Link>
        </div>
        <Link href="/dashboard/events/new" className={styles.newBtn}>
          + New Event
        </Link>
      </div>

      {/* ── Event Rows ── */}
      <div className={styles.eventList}>
        {activeEvents.length === 0 ? (
          <p className={styles.emptyState}>
            No {tab === "offsite" ? "offsite" : "in-studio"} events yet.
          </p>
        ) : (
          activeEvents.map((event) => (
            <Link
              key={event.id}
              href={`/dashboard/events/${tab}/${event.id}`}
              className={styles.eventRow}
            >
              <div
                className={`${styles.statusDot} ${dotClass(event.status)}`}
              />
              <div className={styles.eventMain}>
                <div className={styles.eventTitle}>{event.title}</div>
                <div className={styles.eventMeta}>
                  {event.clients?.name ?? "—"}
                  {" · "}
                  {formatDate(event.event_date)}
                  {event.guest_count != null
                    ? ` · ${event.guest_count} guests`
                    : ""}
                </div>
              </div>
              <div
                className={`${styles.statusPill} ${pillClass(event.status)}`}
              >
                {statusLabel(event.status)}
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
