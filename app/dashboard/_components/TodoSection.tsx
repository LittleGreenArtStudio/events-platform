"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createDashboardTask,
  toggleDashboardTask,
  suggestTasksWithAI,
} from "../actions"
import styles from "../dashboard.module.css"

// ── Types ─────────────────────────────────────────────────────────────────

export type TaskRow = {
  id: string
  title: string
  status: string
  priority: string | null
  due_date: string | null
}

export type EventOption = {
  id: string
  title: string
  date: string
  type: "offsite" | "in-studio"
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function formatEventOptionLabel(e: EventOption): string {
  const [year, month, day] = e.date.split("-").map(Number)
  const dateStr = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
  return `${e.title} · ${dateStr} · ${e.type === "offsite" ? "Offsite" : "In-Studio"}`
}

// ── Live checkbox row ─────────────────────────────────────────────────────

function LiveTodoRow({
  task,
  today,
  done = false,
}: {
  task: TaskRow
  today: string
  done?: boolean
}) {
  const router = useRouter()
  const [optimisticDone, setOptimisticDone] = useState(done)
  const [, startTransition] = useTransition()

  const isOverdue = !optimisticDone && !!task.due_date && task.due_date < today

  const handleCheck = () => {
    setOptimisticDone((prev) => !prev)
    startTransition(async () => {
      await toggleDashboardTask(task.id, task.status)
      router.refresh()
    })
  }

  return (
    <div className={styles.todoItem}>
      <div
        className={
          optimisticDone
            ? `${styles.todoCheckbox} ${styles.todoCheckboxDone}`
            : styles.todoCheckbox
        }
        onClick={handleCheck}
        style={{ cursor: "pointer" }}
      >
        {optimisticDone && (
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
            optimisticDone
              ? `${styles.todoTitle} ${styles.todoTitleDone}`
              : styles.todoTitle
          }
        >
          {task.title}
        </div>
        {task.priority && task.priority !== "normal" && !optimisticDone && (
          <div className={styles.todoPills}>
            <span className={`${styles.todoPill} ${styles[`priority_${task.priority}`] ?? ""}`}>
              {task.priority}
            </span>
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

// ── Main component ────────────────────────────────────────────────────────

export default function TodoSection({
  tasks,
  eventOptions,
  today,
}: {
  tasks: TaskRow[]
  eventOptions: EventOption[]
  today: string
}) {
  const router = useRouter()
  const weekEnd = (() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return d.toISOString().split("T")[0]
  })()

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState("normal")
  const [dueDate, setDueDate] = useState("")
  const [eventValue, setEventValue] = useState("") // "id:type"
  const [notes, setNotes] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [, startSaveTransition] = useTransition()

  // AI suggestions state
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "error">("idle")
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set())
  const [, startSuggestTransition] = useTransition()
  const [, startChipTransition] = useTransition()

  const showAiBtn = title.trim().length >= 3 && eventValue !== ""
  const [eventId, eventType] = eventValue ? eventValue.split(":") : ["", ""]

  const resetForm = () => {
    setTitle("")
    setPriority("normal")
    setDueDate("")
    setEventValue("")
    setNotes("")
    setFormError(null)
    setAiStatus("idle")
    setAiSuggestions([])
    setAiError(null)
    setAddedSuggestions(new Set())
  }

  const handleSave = () => {
    if (!title.trim()) return
    setFormError(null)
    startSaveTransition(async () => {
      const res = await createDashboardTask(title, priority, dueDate, notes, eventId, eventType)
      if ("error" in res) {
        setFormError(res.error)
      } else {
        resetForm()
        setFormOpen(false)
        router.refresh()
      }
    })
  }

  const handleAiSuggest = () => {
    if (!showAiBtn) return
    setAiStatus("loading")
    setAiSuggestions([])
    setAiError(null)
    setAddedSuggestions(new Set())
    startSuggestTransition(async () => {
      const res = await suggestTasksWithAI(title, eventId, eventType)
      if ("error" in res) {
        setAiStatus("error")
        setAiError(res.error)
      } else {
        setAiSuggestions(res.suggestions)
        setAiStatus("idle")
      }
    })
  }

  const handleAddSuggestion = (suggestion: string) => {
    startChipTransition(async () => {
      const res = await createDashboardTask(suggestion, priority, dueDate, "", eventId, eventType)
      if (!("error" in res)) {
        setAddedSuggestions((prev) => new Set(Array.from(prev).concat(suggestion)))
        router.refresh()
      }
    })
  }

  // Task grouping
  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "completed")
  const overdueTasks = tasks.filter(
    (t) => t.due_date && t.due_date < today && t.status !== "done" && t.status !== "completed"
  )
  const todayTasks = tasks.filter(
    (t) => t.due_date === today && t.status !== "done" && t.status !== "completed"
  )
  const upcomingTasks = tasks.filter(
    (t) => (!t.due_date || t.due_date > today) && t.status !== "done" && t.status !== "completed"
  )
  const thisWeekTasks = tasks.filter(
    (t) =>
      t.due_date &&
      t.due_date >= today &&
      t.due_date <= weekEnd &&
      t.status !== "done" &&
      t.status !== "completed"
  )
  const completedTasks = tasks
    .filter((t) => t.status === "done" || t.status === "completed")
    .slice(0, 3)

  return (
    <>
      {/* Column header with + New Task */}
      <div className={styles.colHeaderRow}>
        <div className={styles.colHeaderLeft}>
          <span className={styles.colTitle}>Master Todo List</span>
          <span className={styles.colCount}>{openTasks.length}</span>
        </div>
        <button
          className={styles.newTaskBtn}
          onClick={() => {
            if (formOpen) { resetForm(); setFormOpen(false) } else { setFormOpen(true) }
          }}
        >
          {formOpen ? "✕ Cancel" : "+ New Task"}
        </button>
      </div>

      {/* Inline task form */}
      {formOpen && (
        <div className={styles.taskForm}>
          <input
            type="text"
            placeholder="Task title"
            className={styles.taskFormInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />

          <div className={styles.taskFormRow}>
            <select
              className={styles.taskFormSelect}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input
              type="date"
              className={styles.taskFormInput}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Event selector + AI suggest */}
          <div className={styles.taskFormEventRow}>
            <select
              className={`${styles.taskFormSelect} ${styles.taskFormEventSelect}`}
              value={eventValue}
              onChange={(e) => {
                setEventValue(e.target.value)
                setAiSuggestions([])
                setAiStatus("idle")
              }}
            >
              <option value="">— Link to event (optional) —</option>
              {eventOptions.map((e) => (
                <option key={`${e.id}:${e.type}`} value={`${e.id}:${e.type}`}>
                  {formatEventOptionLabel(e)}
                </option>
              ))}
            </select>
            {showAiBtn && (
              <button
                className={styles.aiSuggestBtn}
                onClick={handleAiSuggest}
                disabled={aiStatus === "loading"}
                title="Suggest related tasks from event"
              >
                {aiStatus === "loading" ? "…" : "✦ Suggest"}
              </button>
            )}
          </div>

          {/* AI suggestions */}
          {aiSuggestions.length > 0 && (
            <div className={styles.aiSuggestPanel}>
              <div className={styles.aiSuggestLabel}>Suggested tasks — click to add</div>
              <div className={styles.aiSuggestChips}>
                {aiSuggestions.map((s) => (
                  <button
                    key={s}
                    className={`${styles.aiSuggestChip} ${addedSuggestions.has(s) ? styles.aiSuggestChipDone : ""}`}
                    onClick={() => !addedSuggestions.has(s) && handleAddSuggestion(s)}
                    disabled={addedSuggestions.has(s)}
                  >
                    {addedSuggestions.has(s) ? `${s} ✓` : `+ ${s}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {aiError && <p className={styles.taskFormError}>{aiError}</p>}

          <textarea
            placeholder="Notes (optional)"
            className={styles.taskFormTextarea}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {formError && <p className={styles.taskFormError}>{formError}</p>}

          <div className={styles.taskFormActions}>
            <button
              className={styles.taskFormSaveBtn}
              onClick={handleSave}
              disabled={!title.trim()}
            >
              Save Task
            </button>
            <button
              className={styles.taskFormCancelBtn}
              onClick={() => { resetForm(); setFormOpen(false) }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.todoTabs}>
        {[
          { label: "All", count: overdueTasks.length + todayTasks.length + upcomingTasks.length },
          { label: "Today", count: todayTasks.length },
          { label: "This Week", count: thisWeekTasks.length },
          { label: "Overdue", count: overdueTasks.length },
        ].map(({ label, count }) => (
          <span
            key={label}
            className={`${styles.todoTab} ${label === "All" ? styles.todoTabActive : ""}`}
          >
            {label}
            {count > 0 && <span className={styles.todoTabBadge}>{count}</span>}
          </span>
        ))}
      </div>

      {tasks.length === 0 && <p className={styles.todoEmpty}>No tasks yet.</p>}

      {overdueTasks.length > 0 && (
        <div className={styles.todoGroup}>
          <div className={styles.todoGroupLabel}>Overdue</div>
          {overdueTasks.map((task) => (
            <LiveTodoRow key={task.id} task={task} today={today} />
          ))}
        </div>
      )}

      {todayTasks.length > 0 && (
        <div className={styles.todoGroup}>
          <div className={styles.todoGroupLabel}>Today</div>
          {todayTasks.map((task) => (
            <LiveTodoRow key={task.id} task={task} today={today} />
          ))}
        </div>
      )}

      {upcomingTasks.length > 0 && (
        <div className={styles.todoGroup}>
          <div className={styles.todoGroupLabel}>Upcoming</div>
          {upcomingTasks.map((task) => (
            <LiveTodoRow key={task.id} task={task} today={today} />
          ))}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className={styles.todoGroup}>
          <div className={styles.todoGroupLabel}>Completed</div>
          {completedTasks.map((task) => (
            <LiveTodoRow key={task.id} task={task} today={today} done />
          ))}
        </div>
      )}
    </>
  )
}
