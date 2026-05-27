import { createSupabaseServerClient } from "@/lib/auth"
import styles from "./dashboard.module.css"
import TodoSection from "./_components/TodoSection"
import type { EventOption, TaskRow } from "./_components/TodoSection"

// ── Types ────────────────────────────────────────────────────────────────

type EventType = "Offsite" | "In-Studio"

type EventRow = {
  id: string
  title: string
  status: string
  event_date: string
  guest_count: number | null
  eventType: EventType
}

type RawEvent = {
  id: string
  title: string
  status: string
  event_date: string
  guest_count: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const d = new Date(year, month - 1, day)
  const dow = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
  const mon = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
  return `${dow} · ${mon} ${day}`
}

function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function dotClass(status: string): string {
  if (status === "confirmed") return styles.dotConfirmed
  if (status === "inquiry") return styles.dotInquiry
  return styles.dotInProgress
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  // Date ranges
  const today = new Date().toISOString().split("T")[0]
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split("T")[0]
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]

  // Parallel Supabase queries
  const [
    offsiteConfirmedCount,
    inStudioConfirmedCount,
    offsiteInquiryCount,
    inStudioInquiryCount,
    openTasksCount,
    clientsCount,
    offsiteMonthCount,
    inStudioMonthCount,
    invoicesCount,
    offsiteUpcoming,
    inStudioUpcoming,
    tasksAll,
    offsiteOptions,
    inStudioOptions,
  ] = await Promise.all([
    supabase
      .from("offsite_events")
      .select("*", { count: "exact", head: true })
      .gte("event_date", today)
      .eq("status", "confirmed"),
    supabase
      .from("in_studio_events")
      .select("*", { count: "exact", head: true })
      .gte("event_date", today)
      .eq("status", "confirmed"),
    supabase
      .from("offsite_events")
      .select("*", { count: "exact", head: true })
      .eq("status", "inquiry"),
    supabase
      .from("in_studio_events")
      .select("*", { count: "exact", head: true })
      .eq("status", "inquiry"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["todo", "in_progress"]),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase
      .from("offsite_events")
      .select("*", { count: "exact", head: true })
      .gte("event_date", firstOfMonth)
      .lte("event_date", lastOfMonth)
      .eq("status", "confirmed"),
    supabase
      .from("in_studio_events")
      .select("*", { count: "exact", head: true })
      .gte("event_date", firstOfMonth)
      .lte("event_date", lastOfMonth)
      .eq("status", "confirmed"),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .in("status", ["sent", "overdue"]),
    supabase
      .from("offsite_events")
      .select("id, title, status, event_date, guest_count")
      .gte("event_date", today)
      .order("event_date")
      .limit(10),
    supabase
      .from("in_studio_events")
      .select("id, title, status, event_date, guest_count")
      .gte("event_date", today)
      .order("event_date")
      .limit(10),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .order("due_date", { nullsFirst: false })
      .limit(30),
    supabase
      .from("offsite_events")
      .select("id, title, event_date")
      .gte("event_date", today)
      .order("event_date")
      .limit(50),
    supabase
      .from("in_studio_events")
      .select("id, title, event_date")
      .gte("event_date", today)
      .order("event_date")
      .limit(50),
  ])

  // Process events — cast raw Supabase data to known shape
  const offsiteRaw = (offsiteUpcoming.data ?? []) as RawEvent[]
  const inStudioRaw = (inStudioUpcoming.data ?? []) as RawEvent[]

  const allUpcoming: EventRow[] = [
    ...offsiteRaw.map((e) => ({ ...e, eventType: "Offsite" as EventType })),
    ...inStudioRaw.map((e) => ({ ...e, eventType: "In-Studio" as EventType })),
  ].sort((a, b) => a.event_date.localeCompare(b.event_date))

  const thisWeekEvents = allUpcoming
    .filter((e) => e.event_date <= weekEndStr)
    .slice(0, 8)
  const greenLightEvents = allUpcoming
    .filter((e) => e.status === "confirmed")
    .slice(0, 5)

  // Process tasks — cast raw Supabase data to known shape
  const tasks = (tasksAll.data ?? []) as TaskRow[]

  // Event options for task creation form
  type RawEventOption = { id: string; title: string; event_date: string }
  const eventOptions: EventOption[] = [
    ...((offsiteOptions.data ?? []) as unknown as RawEventOption[]).map((e) => ({
      id: e.id, title: e.title, date: e.event_date, type: "offsite" as const,
    })),
    ...((inStudioOptions.data ?? []) as unknown as RawEventOption[]).map((e) => ({
      id: e.id, title: e.title, date: e.event_date, type: "in-studio" as const,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  // Pulse bar stats
  const pulseStats = [
    {
      label: "Upcoming Events",
      value:
        (offsiteConfirmedCount.count ?? 0) +
        (inStudioConfirmedCount.count ?? 0),
    },
    {
      label: "Active Inquiries",
      value:
        (offsiteInquiryCount.count ?? 0) + (inStudioInquiryCount.count ?? 0),
    },
    { label: "Open Tasks", value: openTasksCount.count ?? 0 },
    { label: "Total Clients", value: clientsCount.count ?? 0 },
    {
      label: "Confirmed This Month",
      value:
        (offsiteMonthCount.count ?? 0) + (inStudioMonthCount.count ?? 0),
    },
    { label: "Outstanding Invoices", value: invoicesCount.count ?? 0 },
  ]

  return (
    <>
      {/* ── Pulse Bar ── */}
      <div className={styles.pulseBar}>
        {pulseStats.map(({ label, value }) => (
          <div key={label} className={styles.pulseCell}>
            <div className={styles.pulseCellLabel}>{label}</div>
            <div className={styles.pulseCellValue}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className={styles.mainGrid}>
        {/* Left — This Week */}
        <div>
          <div className={styles.colHeader}>
            <span className={styles.colTitle}>This Week</span>
            <span className={styles.colCount}>{thisWeekEvents.length}</span>
          </div>

          {thisWeekEvents.length === 0 ? (
            <p className={styles.weekEmpty}>Nothing scheduled this week.</p>
          ) : (
            thisWeekEvents.map((event) => (
              <div
                key={`${event.eventType}-${event.id}`}
                className={styles.weekEvent}
              >
                <div
                  className={`${styles.weekEventDot} ${dotClass(event.status)}`}
                />
                <div className={styles.weekEventBody}>
                  <div className={styles.weekEventDate}>
                    {formatEventDate(event.event_date)}
                  </div>
                  <div className={styles.weekEventName}>
                    {event.title}{" "}
                    <em className={styles.weekEventTypeLabel}>
                      {event.eventType}
                    </em>
                  </div>
                  <div className={styles.weekEventMeta}>
                    {event.guest_count != null
                      ? `${event.guest_count} guests`
                      : "—"}
                    {" · "}
                    {event.eventType}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Center — Master Todo List */}
        <div>
          <TodoSection tasks={tasks} eventOptions={eventOptions} today={today} />

          {/* Weekly Round-up */}
          <div className={styles.roundup}>
            <div className={styles.roundupHeader}>
              <span className={styles.roundupTitle}>Weekly Round-up</span>
              <span className={styles.roundupTag}>AI · Placeholder</span>
            </div>
            <div className={styles.roundupBody}>
              <p>
                This week brings a gentle rhythm — confirmed events anchor the
                schedule with careful attention to detail across all upcoming
                bookings. Supply orders are tracking on time and the team is
                well-positioned heading into the weekend.
              </p>
              <p>
                A few open inquiries merit follow-up before end of week. The
                Green-Light list continues to grow as confirmations come
                through — a promising sign for the season ahead.
              </p>
            </div>
          </div>
        </div>

        {/* Right — AI Copilot */}
        <div>
          <div className={styles.colHeader}>
            <span className={styles.colTitle}>AI Copilot</span>
            <span className={styles.colCount}>0</span>
          </div>

          <div className={styles.aiCard}>
            <p className={styles.aiCardText}>
              Nothing pending — all caught up.
            </p>
          </div>

          <div className={styles.greenLightBox}>
            <div className={styles.greenLightHeader}>Green-Light List</div>
            {greenLightEvents.length === 0 ? (
              <p className={styles.greenLightEmpty}>
                No confirmed events yet.
              </p>
            ) : (
              greenLightEvents.map((event) => (
                <div
                  key={`gl-${event.eventType}-${event.id}`}
                  className={styles.greenLightItem}
                >
                  <span className={styles.greenLightName}>{event.title}</span>
                  <span className={styles.greenLightDate}>
                    {formatShortDate(event.event_date)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          Forager Crafts Studio · Los Angeles, CA
        </div>
        <div className={styles.footerCenter}>
          Make it slowly. Make it beautifully.
        </div>
        <div className={styles.footerRight}>Last sync · just now</div>
      </footer>
    </>
  )
}
