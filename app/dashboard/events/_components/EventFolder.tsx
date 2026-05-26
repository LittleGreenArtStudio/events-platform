import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import styles from "../folder.module.css"

// ── Types ────────────────────────────────────────────────────────────────

type EventKind = "offsite" | "in-studio"

type ValidTab =
  | "overview"
  | "crafts"
  | "supplies"
  | "staff"
  | "tasks"
  | "timeline"
  | "threads"
  | "invoice"
  | "brief"

type ClientRef = { first_name: string | null; last_name: string | null }

type EventDetail = {
  id: string
  title: string
  status: string
  event_date: string
  start_time: string | null
  end_time: string | null
  venue_address: string | null
  guest_count: number | null
  budget: number | null
  deposit_amount: number | null
  notes: string | null
  clients: ClientRef | null
}

type CraftRef = { name: string; description: string | null }

type CraftRow = {
  id: string
  quantity: number | null
  notes: string | null
  crafts: CraftRef | null
}

type TaskRow = {
  id: string
  title: string
  status: string
  priority: string | null
  due_date: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────

const TABS: { key: ValidTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "crafts", label: "Crafts" },
  { key: "supplies", label: "Supplies" },
  { key: "staff", label: "Staff" },
  { key: "tasks", label: "Tasks" },
  { key: "timeline", label: "Timeline" },
  { key: "threads", label: "Threads" },
  { key: "invoice", label: "Invoice" },
  { key: "brief", label: "Brief" },
]

function formatLongDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

function daysUntil(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number)
  const event = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((event.getTime() - today.getTime()) / 86400000)
}

function daysLabel(n: number): string {
  if (n === 0) return "Today"
  if (n === 1) return "Tomorrow"
  if (n < 0) return `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"} ago`
  return `${n} day${n === 1 ? "" : "s"} away`
}

function pillClass(status: string): string {
  switch (status) {
    case "confirmed": return styles.pillGreen
    case "in_progress": return styles.pillRed
    case "inquiry":
    case "proposal_sent": return styles.pillAmber
    case "cancelled": return styles.pillCancelled
    default: return styles.pillMuted
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

function getMilestones(
  status: string,
  depositAmount: number | null
): { label: string; done: boolean }[] {
  const order = ["inquiry", "proposal_sent", "confirmed", "in_progress", "completed"]
  const idx = order.indexOf(status)
  return [
    { label: "Inquiry received", done: idx >= 0 },
    { label: "Proposal sent", done: idx >= 1 },
    { label: "Deposit received", done: depositAmount != null && depositAmount > 0 },
    { label: "Confirmed", done: idx >= 2 },
    { label: "Event complete", done: status === "completed" },
  ]
}

function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

// ── Main Component ────────────────────────────────────────────────────────

export default async function EventFolder({
  eventKind,
  id,
  tab,
}: {
  eventKind: EventKind
  id: string
  tab: string
}) {
  const activeTab = (
    TABS.some((t) => t.key === tab) ? tab : "overview"
  ) as ValidTab

  const supabase = await createSupabaseServerClient()

  const table = eventKind === "offsite" ? "offsite_events" : "in_studio_events"
  const craftTable =
    eventKind === "offsite" ? "offsite_event_crafts" : "in_studio_event_crafts"
  const eventFkColumn =
    eventKind === "offsite" ? "offsite_event_id" : "in_studio_event_id"

  const [eventResult, craftsResult, tasksResult] = await Promise.all([
    supabase
      .from(table)
      .select(
        "id, title, status, event_date, start_time, end_time, venue_address, guest_count, budget, deposit_amount, notes, clients(first_name, last_name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from(craftTable)
      .select("id, quantity, notes, crafts(name, description)")
      .eq(eventFkColumn, id),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .eq(eventFkColumn, id)
      .order("due_date", { nullsFirst: false }),
  ])

  if (!eventResult.data) {
    return <p className={styles.notFound}>Event not found.</p>
  }

  const event = eventResult.data as unknown as EventDetail
  const crafts = (craftsResult.data ?? []) as unknown as CraftRow[]
  const tasks = (tasksResult.data ?? []) as TaskRow[]

  const days = daysUntil(event.event_date)
  const today = new Date().toISOString().split("T")[0]
  const kindLabel = eventKind === "offsite" ? "Offsite Event" : "In-Studio Event"
  const backHref = `/dashboard/events?tab=${eventKind}`

  const subtitle = [
    formatLongDate(event.event_date),
    event.start_time && event.end_time
      ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
      : event.start_time
      ? formatTime(event.start_time)
      : null,
    event.venue_address ?? (eventKind === "in-studio" ? "Studio" : null),
    event.guest_count != null ? `${event.guest_count} guests` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const milestones = getMilestones(event.status, event.deposit_amount)

  const infoItems = [
    {
      label: "Client",
      value: event.clients
        ? [event.clients.first_name, event.clients.last_name].filter(Boolean).join(" ") || "—"
        : "—",
    },
    { label: "Date", value: formatLongDate(event.event_date) },
    {
      label: "Time",
      value:
        event.start_time && event.end_time
          ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
          : event.start_time
          ? formatTime(event.start_time)
          : "—",
    },
    ...(eventKind === "offsite"
      ? [{ label: "Venue", value: event.venue_address ?? "—" }]
      : []),
    { label: "Guests", value: event.guest_count?.toString() ?? "—" },
    { label: "Status", value: statusLabel(event.status) },
    {
      label: "Budget",
      value: event.budget != null ? formatCurrency(event.budget) : "—",
    },
    {
      label: "Deposit",
      value:
        event.deposit_amount != null ? formatCurrency(event.deposit_amount) : "—",
    },
  ]

  return (
    <>
      {/* ── Breadcrumb ── */}
      <div className={styles.breadcrumb}>
        <Link href={backHref} className={styles.breadcrumbLink}>
          Events
        </Link>
        <span className={styles.breadcrumbSep}>→</span>
        <span className={styles.breadcrumbCurrent}>{event.title}</span>
      </div>

      {/* ── Header ── */}
      <div className={styles.folderHeader}>
        <div className={styles.folderTypeRow}>
          <span className={styles.folderTypeLabel}>{kindLabel}</span>
          <span className={`${styles.statusPill} ${pillClass(event.status)}`}>
            {statusLabel(event.status)}
          </span>
        </div>
        <h2 className={styles.folderTitle}>
          {event.title}{" "}
          <em className={styles.folderTitleAccent}>
            {eventKind === "offsite" ? "Offsite" : "In-Studio"}
          </em>
        </h2>
        <p className={styles.folderSubtitle}>{subtitle}</p>
        <div className={styles.folderActions}>
          <span className={styles.actionBtn}>Edit</span>
          <span className={styles.actionBtn}>New Task</span>
          <span className={styles.actionBtn}>Print Brief</span>
          <span className={styles.folderDaysUntil}>{daysLabel(days)}</span>
        </div>
      </div>

      {/* ── Double Rule ── */}
      <div className={styles.folderDoubleRule} />

      {/* ── Tab Nav ── */}
      <div className={styles.folderTabs}>
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/dashboard/events/${eventKind}/${id}?tab=${key}`}
            className={`${styles.folderTab} ${
              activeTab === key ? styles.folderTabActive : ""
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className={styles.folderContent}>
        {activeTab === "overview" && (
          <div className={styles.overviewGrid}>
            {/* Left — Info pairs */}
            <div>
              <div className={styles.infoListTitle}>Event Details</div>
              {infoItems.map(({ label, value }) => (
                <div key={label} className={styles.infoItem}>
                  <span className={styles.infoLabel}>{label}</span>
                  <span className={styles.infoValue}>{value}</span>
                </div>
              ))}
            </div>
            {/* Right — Milestone checklist */}
            <div>
              <div className={styles.milestonesTitle}>Milestones</div>
              {milestones.map(({ label, done }) => (
                <div key={label} className={styles.milestone}>
                  <div
                    className={`${styles.milestoneCheck} ${
                      done ? styles.milestoneCheckDone : ""
                    }`}
                  >
                    {done && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className={`${styles.milestoneLabel} ${
                      !done ? styles.milestoneLabelPending : ""
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "crafts" && (
          <div className={styles.craftList}>
            {crafts.length === 0 ? (
              <p className={styles.emptyState}>No crafts added yet.</p>
            ) : (
              crafts.map((craft) => (
                <div key={craft.id} className={styles.craftRow}>
                  <div>
                    <div className={styles.craftName}>
                      {craft.crafts?.name ?? "Unknown craft"}
                    </div>
                    {craft.crafts?.description && (
                      <div className={styles.craftMeta}>
                        {craft.crafts.description}
                      </div>
                    )}
                    {craft.notes && (
                      <div className={styles.craftMeta}>{craft.notes}</div>
                    )}
                  </div>
                  <div className={styles.craftQty}>
                    {craft.quantity != null ? `×${craft.quantity}` : "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <div>
            {tasks.length === 0 ? (
              <p className={styles.emptyState}>No tasks for this event.</p>
            ) : (
              tasks.map((task) => {
                const isDone =
                  task.status === "done" || task.status === "completed"
                const isOverdue =
                  !isDone && !!task.due_date && task.due_date < today
                return (
                  <div key={task.id} className={styles.taskItem}>
                    <div
                      className={`${styles.taskCheckbox} ${
                        isDone ? styles.taskCheckboxDone : ""
                      }`}
                    >
                      {isDone && (
                        <svg
                          width="10"
                          height="8"
                          viewBox="0 0 10 8"
                          fill="none"
                        >
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div
                      className={`${styles.taskTitle} ${
                        isDone ? styles.taskTitleDone : ""
                      }`}
                    >
                      {task.title}
                    </div>
                    {task.due_date && (
                      <div
                        className={`${styles.taskDue} ${
                          isOverdue ? styles.taskDueOverdue : ""
                        }`}
                      >
                        {formatShortDate(task.due_date)}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {(activeTab === "supplies" ||
          activeTab === "staff" ||
          activeTab === "timeline" ||
          activeTab === "threads" ||
          activeTab === "invoice" ||
          activeTab === "brief") && (
          <p className={styles.comingSoon}>Coming soon.</p>
        )}
      </div>
    </>
  )
}
