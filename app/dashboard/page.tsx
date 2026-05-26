import { createSupabaseServerClient } from "@/lib/auth"
import { redirect } from "next/navigation"
import { signOut } from "./actions"
import styles from "./dashboard.module.css"

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

type TaskRow = {
  id: string
  title: string
  status: string
  priority: string | null
  due_date: string | null
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

// ── Sub-components ───────────────────────────────────────────────────────

function TodoRow({
  task,
  today,
  done = false,
}: {
  task: TaskRow
  today: string
  done?: boolean
}) {
  const isOverdue = !done && !!task.due_date && task.due_date < today
  return (
    <div className={styles.todoItem}>
      <div
        className={
          done
            ? `${styles.todoCheckbox} ${styles.todoCheckboxDone}`
            : styles.todoCheckbox
        }
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
      <div className={styles.todoBody}>
        <div
          className={
            done
              ? `${styles.todoTitle} ${styles.todoTitleDone}`
              : styles.todoTitle
          }
        >
          {task.title}
        </div>
        {task.priority && !done && (
          <div className={styles.todoPills}>
            <span className={styles.todoPill}>{task.priority}</span>
          </div>
        )}
      </div>
      <div
        className={
          isOverdue
            ? `${styles.todoDue} ${styles.todoDueOverdue}`
            : styles.todoDue
        }
      >
        {task.due_date ? formatShortDate(task.due_date) : ""}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // NOTE: if this query returns null, check the RLS policy on user_roles —
  // a recursive policy (policy → helper fn → queries user_roles) causes a
  // PostgreSQL stack-depth error (code 54001) that silently nulls the result.
  // Fix: DROP the recursive policy and replace with:
  //   CREATE POLICY "users_read_own_role" ON user_roles FOR SELECT
  //   TO authenticated USING (auth.uid() = user_id);
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("display_name, role")
    .eq("user_id", user.id)
    .maybeSingle()

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

  const overdueTasks = tasks.filter(
    (t) =>
      t.due_date &&
      t.due_date < today &&
      t.status !== "done" &&
      t.status !== "completed"
  )
  const todayTasks = tasks.filter(
    (t) =>
      t.due_date === today &&
      t.status !== "done" &&
      t.status !== "completed"
  )
  const upcomingTasks = tasks.filter(
    (t) =>
      (!t.due_date || t.due_date > today) &&
      t.status !== "done" &&
      t.status !== "completed"
  )
  const thisWeekTasks = tasks.filter(
    (t) =>
      t.due_date &&
      t.due_date >= today &&
      t.due_date <= weekEndStr &&
      t.status !== "done" &&
      t.status !== "completed"
  )
  const completedTasks = tasks
    .filter((t) => t.status === "done" || t.status === "completed")
    .slice(0, 3)

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

  const displayName = roleData?.display_name ?? user.email ?? "User"
  // Fall back to app_metadata.role when the user_roles query fails due to
  // the recursive RLS policy — app_metadata comes directly from the JWT
  // and does not hit the database.
  const appMetaRole = (user.app_metadata as Record<string, unknown>)
    ?.role as string | undefined
  const resolvedRole = roleData?.role ?? appMetaRole
  const roleLabel = resolvedRole?.toLowerCase() === "admin" ? "Admin" : "Assistant"

  const mastheadDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const openCount = openTasksCount.count ?? 0

  return (
    <div className={styles.page}>
      {/* ── Masthead ── */}
      <header className={styles.masthead}>
        <div className={styles.mastheadLeft}>
          <span className={styles.studioName}>Forager Crafts</span>
          <span className={styles.mastheadDate}>{mastheadDate}</span>
        </div>
        <div className={styles.mastheadCenter}>
          <h1 className={styles.mastheadTitle}>
            Studio <em className={styles.mastheadTitleAccent}>HQ</em>
          </h1>
        </div>
        <div className={styles.mastheadRight}>
          <span className={styles.mastheadPageLabel}>Studio HQ</span>
          <span className={styles.mastheadUser}>{displayName}</span>
          <span className={styles.mastheadRole}>{roleLabel}</span>
          <form action={signOut}>
            <button type="submit" className={styles.signOutBtn}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* ── Double Rule ── */}
      <div className={styles.doubleRule} />

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        {["Studio HQ", "Events", "Craft Library", "People", "Tasks"].map(
          (item) => (
            <span
              key={item}
              className={`${styles.navItem} ${
                item === "Studio HQ" ? styles.navItemActive : ""
              }`}
            >
              {item}
            </span>
          )
        )}
      </nav>

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
          <div className={styles.colHeader}>
            <span className={styles.colTitle}>Master Todo List</span>
            <span className={styles.colCount}>{openCount}</span>
          </div>

          <div className={styles.todoTabs}>
            {[
              {
                label: "All",
                count:
                  overdueTasks.length +
                  todayTasks.length +
                  upcomingTasks.length,
              },
              { label: "Today", count: todayTasks.length },
              { label: "This Week", count: thisWeekTasks.length },
              { label: "Overdue", count: overdueTasks.length },
            ].map(({ label, count }) => (
              <span
                key={label}
                className={`${styles.todoTab} ${
                  label === "All" ? styles.todoTabActive : ""
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={styles.todoTabBadge}>{count}</span>
                )}
              </span>
            ))}
          </div>

          {tasks.length === 0 && (
            <p className={styles.todoEmpty}>No tasks yet.</p>
          )}

          {overdueTasks.length > 0 && (
            <div className={styles.todoGroup}>
              <div className={styles.todoGroupLabel}>Overdue</div>
              {overdueTasks.map((task) => (
                <TodoRow key={task.id} task={task} today={today} />
              ))}
            </div>
          )}

          {todayTasks.length > 0 && (
            <div className={styles.todoGroup}>
              <div className={styles.todoGroupLabel}>Today</div>
              {todayTasks.map((task) => (
                <TodoRow key={task.id} task={task} today={today} />
              ))}
            </div>
          )}

          {upcomingTasks.length > 0 && (
            <div className={styles.todoGroup}>
              <div className={styles.todoGroupLabel}>Upcoming</div>
              {upcomingTasks.map((task) => (
                <TodoRow key={task.id} task={task} today={today} />
              ))}
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className={styles.todoGroup}>
              <div className={styles.todoGroupLabel}>Completed</div>
              {completedTasks.map((task) => (
                <TodoRow key={task.id} task={task} today={today} done />
              ))}
            </div>
          )}

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
              No items pending — {displayName} is all caught up.
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
    </div>
  )
}
