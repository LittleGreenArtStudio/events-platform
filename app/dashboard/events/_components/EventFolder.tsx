import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import { notFound } from "next/navigation"
import styles from "../folder.module.css"
import MilestoneToggle from "./MilestoneToggle"
import AddEventCraftForm from "./AddEventCraftForm"
import RemoveEventCraftBtn from "./RemoveEventCraftBtn"
import AddEventStaffForm from "./AddEventStaffForm"
import RemoveEventStaffBtn from "./RemoveEventStaffBtn"
import ConfirmStaffToggle from "./ConfirmStaffToggle"
import TaskToggle from "./TaskToggle"
import AddTaskForm from "./AddTaskForm"
import AddThreadForm from "./AddThreadForm"
import InvoicePanel from "./InvoicePanel"
import EventBriefPanel from "./EventBriefPanel"
import EstimatePanel from "./EstimatePanel"

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
  | "estimate"

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
  deposit_paid: boolean | null
  notes: string | null
  clients: ClientRef | null
}

type SupplyRef = { id: string; name: string; unit: string | null; unit_cost: number | null }

type CraftSupplyRef = { qty_per_guest: number | null; supplies: SupplyRef | null }

type CraftRef = {
  id: string
  name: string
  description: string | null
  skill_level: string | null
  category: string | null
  craft_supplies: CraftSupplyRef[]
}

type EventCraftRow = {
  id: string
  craft_id: string
  guest_count_override: number | null
  notes: string | null
  crafts: CraftRef | null
}

type CraftOption = { id: string; name: string; category: string | null }

type StaffRef = {
  id: string
  first_name: string | null
  last_name: string | null
  role_title: string | null
  hourly_rate: number | null
}

type EventStaffRow = {
  id: string
  staff_id: string
  confirmed: boolean | null
  hours_worked: number | null
  staff: StaffRef | null
}

type StaffOption = {
  id: string
  first_name: string | null
  last_name: string | null
  role_title: string | null
}

type TaskRow = {
  id: string
  title: string
  status: string
  priority: string | null
  due_date: string | null
}

type ThreadRow = {
  id: string
  type: string | null
  subject: string | null
  body: string | null
  sender: string | null
  created_at: string
}

type LineItemRow = {
  id: string
  description: string
  quantity: number | null
  unit_price: number | null
}

type InvoiceRow = {
  id: string
  status: string
  tax_rate: number | null
  due_date: string | null
  notes: string | null
  subtotal: number | null
  total: number | null
  amount_paid: number | null
  created_at: string
  invoice_line_items: LineItemRow[]
}

// ── Constants ────────────────────────────────────────────────────────────

const TABS: { key: ValidTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "crafts", label: "Crafts" },
  { key: "supplies", label: "Supplies" },
  { key: "staff", label: "Staff" },
  { key: "tasks", label: "Tasks" },
  { key: "timeline", label: "Timeline" },
  { key: "threads", label: "Threads" },
  { key: "invoice", label: "Invoice" },
  { key: "estimate", label: "Estimate" },
  { key: "brief", label: "Brief" },
]

// ── Helpers ──────────────────────────────────────────────────────────────

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

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
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
  const activeTab = (TABS.some((t) => t.key === tab) ? tab : "overview") as ValidTab

  const supabase = await createSupabaseServerClient()

  const table = eventKind === "offsite" ? "offsite_events" : "in_studio_events"
  const craftTable = eventKind === "offsite" ? "offsite_event_crafts" : "in_studio_event_crafts"
  const staffTable = eventKind === "offsite" ? "offsite_event_staff" : "in_studio_event_staff"
  const eventFkColumn = eventKind === "offsite" ? "offsite_event_id" : "in_studio_event_id"

  const [
    eventResult,
    eventCraftsResult,
    allCraftsResult,
    eventStaffResult,
    allStaffResult,
    tasksResult,
    threadsResult,
    invoicesResult,
    estimateResult,
  ] = await Promise.all([
    supabase
      .from(table)
      .select(
        "id, title, status, event_date, start_time, end_time, venue_address, guest_count, budget, deposit_amount, deposit_paid, notes, clients(first_name, last_name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from(craftTable)
      .select(
        "id, craft_id, guest_count_override, notes, crafts(id, name, description, skill_level, category, craft_supplies(qty_per_guest, supplies(id, name, unit, unit_cost)))"
      )
      .eq("event_id", id)
      .order("id"),
    supabase
      .from("crafts")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from(staffTable)
      .select("id, staff_id, confirmed, hours_worked, staff(id, first_name, last_name, role_title, hourly_rate)")
      .eq("event_id", id)
      .order("id"),
    supabase
      .from("staff")
      .select("id, first_name, last_name, role_title")
      .eq("is_active", true)
      .order("first_name"),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .eq(eventFkColumn, id)
      .order("due_date", { nullsFirst: false }),
    supabase
      .from("threads")
      .select("id, type, subject, body, sender, created_at")
      .eq(eventFkColumn, id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(
        "id, status, tax_rate, due_date, notes, subtotal, total, amount_paid, created_at, invoice_line_items(id, description, quantity, unit_price)"
      )
      .eq(eventFkColumn, id)
      .order("created_at", { ascending: false }),
    supabase
      .from("estimates")
      .select("*")
      .eq(eventFkColumn, id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!eventResult.data) notFound()

  const event = eventResult.data as unknown as EventDetail
  const eventCrafts = (eventCraftsResult.data ?? []) as unknown as EventCraftRow[]
  const allCrafts = (allCraftsResult.data ?? []) as unknown as CraftOption[]
  const eventStaff = (eventStaffResult.data ?? []) as unknown as EventStaffRow[]
  const allStaff = (allStaffResult.data ?? []) as unknown as StaffOption[]
  const tasks = (tasksResult.data ?? []) as unknown as TaskRow[]
  const threads = (threadsResult.data ?? []) as unknown as ThreadRow[]
  const invoices = (invoicesResult.data ?? []) as unknown as InvoiceRow[]
  const estimate = estimateResult.data ?? null

  const today = new Date().toISOString().split("T")[0]
  const days = daysUntil(event.event_date)
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

  // Milestones
  const STATUS_ORDER = ["inquiry", "proposal_sent", "confirmed", "in_progress", "completed"]
  const statusIdx = STATUS_ORDER.indexOf(event.status)

  const milestones = [
    {
      key: "inquiry_received",
      label: "Inquiry received",
      done: statusIdx >= 0,
    },
    {
      key: "proposal_sent",
      label: "Proposal sent",
      done: statusIdx >= 1,
      targetStatus: "proposal_sent",
    },
    {
      key: "deposit_received",
      label: "Deposit received",
      done: event.deposit_paid === true,
      isDeposit: true,
      depositPaid: event.deposit_paid === true,
    },
    {
      key: "confirmed",
      label: "Confirmed",
      done: statusIdx >= 2,
      targetStatus: "confirmed",
    },
    {
      key: "event_complete",
      label: "Event complete",
      done: event.status === "completed",
      targetStatus: "completed",
    },
  ]

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
      value: event.deposit_amount != null ? formatCurrency(event.deposit_amount) : "—",
    },
  ]

  // Supplies calculation
  const suppliesMap = new Map<
    string,
    {
      supplyId: string
      name: string
      unit: string | null
      unitCost: number | null
      totalQty: number
      totalCost: number
      crafts: string[]
    }
  >()

  for (const ec of eventCrafts) {
    const guestCount = ec.guest_count_override ?? event.guest_count ?? 0
    const craftName = ec.crafts?.name ?? "Unknown craft"

    for (const cs of ec.crafts?.craft_supplies ?? []) {
      const s = cs.supplies
      if (!s) continue
      const baseQty = (cs.qty_per_guest ?? 0) * guestCount
      const bufferedQty = Math.ceil(baseQty * 1.15)
      const cost = bufferedQty * (s.unit_cost ?? 0)

      const existing = suppliesMap.get(s.id)
      if (existing) {
        existing.totalQty += bufferedQty
        existing.totalCost += cost
        if (!existing.crafts.includes(craftName)) existing.crafts.push(craftName)
      } else {
        suppliesMap.set(s.id, {
          supplyId: s.id,
          name: s.name,
          unit: s.unit,
          unitCost: s.unit_cost,
          totalQty: bufferedQty,
          totalCost: cost,
          crafts: [craftName],
        })
      }
    }
  }

  const suppliesRows = Array.from(suppliesMap.values())
  const grandTotalCost = suppliesRows.reduce((sum, r) => sum + r.totalCost, 0)

  const existingCraftIds = eventCrafts.map((ec) => ec.craft_id)
  const existingStaffIds = eventStaff.map((es) => es.staff_id)

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
            className={`${styles.folderTab} ${activeTab === key ? styles.folderTabActive : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className={styles.folderContent}>

        {/* ── Overview ── */}
        {activeTab === "overview" && (
          <div className={styles.overviewGrid}>
            <div>
              <div className={styles.infoListTitle}>Event Details</div>
              {infoItems.map(({ label, value }) => (
                <div key={label} className={styles.infoItem}>
                  <span className={styles.infoLabel}>{label}</span>
                  <span className={styles.infoValue}>{value}</span>
                </div>
              ))}
            </div>
            <div>
              <div className={styles.milestonesTitle}>Milestones</div>
              {milestones.map((m) => (
                <MilestoneToggle
                  key={m.key}
                  eventKind={eventKind}
                  eventId={id}
                  milestoneKey={m.key}
                  label={m.label}
                  done={m.done}
                  targetStatus={m.targetStatus}
                  isDeposit={m.isDeposit}
                  depositPaid={m.depositPaid}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Crafts ── */}
        {activeTab === "crafts" && (
          <div>
            {eventCrafts.length === 0 ? (
              <p className={styles.emptyState}>No crafts added yet.</p>
            ) : (
              <div className={styles.craftList}>
                {eventCrafts.map((ec) => {
                  const c = ec.crafts
                  const guestCount = ec.guest_count_override ?? event.guest_count
                  return (
                    <div key={ec.id} className={styles.craftRow}>
                      <div className={styles.craftRowMain}>
                        <div className={styles.craftName}>{c?.name ?? "Unknown craft"}</div>
                        <div className={styles.craftMeta}>
                          {c?.category && (
                            <span className={styles.craftMetaTag}>{c.category}</span>
                          )}
                          {c?.skill_level && (
                            <span className={`${styles.craftMetaTag} ${styles[`skill_${c.skill_level}`]}`}>
                              {c.skill_level}
                            </span>
                          )}
                          {guestCount != null && (
                            <span className={styles.craftMetaTag}>{guestCount} guests</span>
                          )}
                          {ec.notes && (
                            <span className={styles.craftNotes}>{ec.notes}</span>
                          )}
                        </div>
                      </div>
                      <RemoveEventCraftBtn
                        eventKind={eventKind}
                        eventId={id}
                        craftEventId={ec.id}
                      />
                    </div>
                  )
                })}
              </div>
            )}
            <div className={styles.tabActions}>
              <AddEventCraftForm
                eventKind={eventKind}
                eventId={id}
                allCrafts={allCrafts}
                existingCraftIds={existingCraftIds}
                guestCount={event.guest_count}
              />
            </div>
          </div>
        )}

        {/* ── Supplies ── */}
        {activeTab === "supplies" && (
          <div>
            {suppliesRows.length === 0 ? (
              <p className={styles.emptyState}>
                {eventCrafts.length === 0
                  ? "Add crafts to this event to see supply requirements."
                  : "No supply data attached to the crafts on this event."}
              </p>
            ) : (
              <>
                <table className={styles.suppliesTable}>
                  <thead className={styles.suppliesTableHead}>
                    <tr>
                      <th>Supply</th>
                      <th>Unit</th>
                      <th>Qty (+ 15% buffer)</th>
                      <th>Unit Cost</th>
                      <th>Est. Total</th>
                      <th>From Craft(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliesRows.map((row) => (
                      <tr key={row.supplyId} className={styles.supplyRow}>
                        <td className={styles.supplyName}>{row.name}</td>
                        <td className={styles.supplyUnit}>{row.unit ?? "—"}</td>
                        <td className={styles.supplyQty}>{row.totalQty}</td>
                        <td className={styles.supplyCost}>
                          {row.unitCost != null ? `$${row.unitCost.toFixed(2)}` : "—"}
                        </td>
                        <td className={styles.supplyTotal}>${row.totalCost.toFixed(2)}</td>
                        <td className={styles.supplyCrafts}>{row.crafts.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={styles.suppliesTotalRow}>
                      <td colSpan={4} className={styles.suppliesTotalLabel}>
                        Grand total (estimated)
                      </td>
                      <td className={styles.suppliesTotalValue}>${grandTotalCost.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
                <p className={styles.suppliesNote}>
                  Quantities include a 15% buffer over guest count. Unit costs from supply library.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Staff ── */}
        {activeTab === "staff" && (
          <div>
            {eventStaff.length === 0 ? (
              <p className={styles.emptyState}>No staff assigned yet.</p>
            ) : (
              <div className={styles.staffList}>
                {eventStaff.map((es) => {
                  const s = es.staff
                  return (
                    <div key={es.id} className={styles.staffRow}>
                      <div className={styles.staffRowMain}>
                        <div className={styles.staffName}>
                          {s
                            ? [s.first_name, s.last_name].filter(Boolean).join(" ")
                            : "Unknown"}
                        </div>
                        <div className={styles.staffMeta}>
                          {s?.role_title && (
                            <span className={styles.staffRole}>{s.role_title}</span>
                          )}
                          {s?.hourly_rate != null && (
                            <span className={styles.staffRate}>${s.hourly_rate}/hr</span>
                          )}
                          {es.hours_worked != null && (
                            <span className={styles.staffHours}>{es.hours_worked} hrs logged</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.staffRowActions}>
                        <ConfirmStaffToggle
                          eventKind={eventKind}
                          eventId={id}
                          staffEventId={es.id}
                          confirmed={es.confirmed === true}
                        />
                        <RemoveEventStaffBtn
                          eventKind={eventKind}
                          eventId={id}
                          staffEventId={es.id}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className={styles.tabActions}>
              <AddEventStaffForm
                eventKind={eventKind}
                eventId={id}
                allStaff={allStaff}
                existingStaffIds={existingStaffIds}
              />
            </div>
          </div>
        )}

        {/* ── Tasks ── */}
        {activeTab === "tasks" && (
          <div>
            {tasks.length === 0 ? (
              <p className={styles.emptyState}>No tasks for this event.</p>
            ) : (
              tasks.map((task) => (
                <TaskToggle
                  key={task.id}
                  eventKind={eventKind}
                  eventId={id}
                  taskId={task.id}
                  currentStatus={task.status}
                  title={task.title}
                  dueDate={task.due_date}
                  priority={task.priority}
                  today={today}
                />
              ))
            )}
            <div className={styles.tabActions}>
              <AddTaskForm eventKind={eventKind} eventId={id} />
            </div>
          </div>
        )}

        {/* ── Timeline (placeholder) ── */}
        {activeTab === "timeline" && (
          <p className={styles.comingSoon}>Timeline coming soon.</p>
        )}

        {/* ── Threads ── */}
        {activeTab === "threads" && (
          <div>
            {threads.length === 0 ? (
              <p className={styles.emptyState}>No notes or messages yet.</p>
            ) : (
              <div className={styles.threadList}>
                {threads.map((t) => (
                  <div key={t.id} className={styles.threadItem}>
                    <div className={styles.threadMeta}>
                      <span className={`${styles.threadTypePill} ${styles[`threadType_${t.type ?? "note"}`]}`}>
                        {t.type ?? "note"}
                      </span>
                      {t.subject && (
                        <span className={styles.threadSubject}>{t.subject}</span>
                      )}
                      <span className={styles.threadDate}>{formatDateTime(t.created_at)}</span>
                      {t.sender && (
                        <span className={styles.threadSender}>{t.sender}</span>
                      )}
                    </div>
                    {t.body && <div className={styles.threadBody}>{t.body}</div>}
                  </div>
                ))}
              </div>
            )}
            <div className={styles.tabActions}>
              <AddThreadForm eventKind={eventKind} eventId={id} />
            </div>
          </div>
        )}

        {/* ── Invoice ── */}
        {activeTab === "invoice" && (
          <InvoicePanel
            eventKind={eventKind}
            eventId={id}
            invoices={invoices}
          />
        )}

        {/* ── Estimate ── */}
        {activeTab === "estimate" && (
          <EstimatePanel
            eventKind={eventKind}
            eventId={id}
            estimate={estimate as Parameters<typeof EstimatePanel>[0]["estimate"]}
            eventCrafts={eventCrafts as Parameters<typeof EstimatePanel>[0]["eventCrafts"]}
            eventStaff={eventStaff as Parameters<typeof EstimatePanel>[0]["eventStaff"]}
            guestCount={event.guest_count}
            isOffsite={eventKind === "offsite"}
            clientName={
              event.clients
                ? [event.clients.first_name, event.clients.last_name].filter(Boolean).join(" ")
                : ""
            }
            eventTitle={event.title}
            eventDate={event.event_date}
            venueAddress={event.venue_address}
          />
        )}

        {/* ── Brief ── */}
        {activeTab === "brief" && (
          <EventBriefPanel eventKind={eventKind} eventId={id} />
        )}

      </div>
    </>
  )
}
