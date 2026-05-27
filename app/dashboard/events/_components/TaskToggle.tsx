"use client"

import { useState, useTransition } from "react"
import { toggleTaskStatus } from "../actions"
import styles from "../folder.module.css"

function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export default function TaskToggle({
  eventKind,
  eventId,
  taskId,
  currentStatus,
  title,
  dueDate,
  priority,
  today,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  taskId: string
  currentStatus: string
  title: string
  dueDate: string | null
  priority: string | null
  today: string
}) {
  const [status, setStatus] = useState(currentStatus)
  const [, startTransition] = useTransition()

  const isDone = status === "done"
  const isOverdue = !isDone && !!dueDate && dueDate < today

  const handleClick = () => {
    const prev = status
    const next = isDone ? "todo" : "done"
    setStatus(next)
    startTransition(async () => {
      await toggleTaskStatus(eventKind, eventId, taskId, prev)
    })
  }

  return (
    <div className={styles.taskItem}>
      <div
        className={`${styles.taskCheckbox} ${isDone ? styles.taskCheckboxDone : ""}`}
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        {isDone && (
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
      <div className={`${styles.taskTitle} ${isDone ? styles.taskTitleDone : ""}`}>
        {title}
      </div>
      {priority && priority !== "normal" && (
        <span className={`${styles.priorityPill} ${styles[`priority_${priority}`]}`}>
          {priority}
        </span>
      )}
      {dueDate && (
        <div className={`${styles.taskDue} ${isOverdue ? styles.taskDueOverdue : ""}`}>
          {formatShortDate(dueDate)}
        </div>
      )}
    </div>
  )
}
