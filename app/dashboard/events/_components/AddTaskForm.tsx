"use client"

import { useState, useTransition } from "react"
import { addTask } from "../actions"
import styles from "../folder.module.css"

export default function AddTaskForm({
  eventKind,
  eventId,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState("normal")
  const [dueDate, setDueDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!title.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addTask(eventKind, eventId, title, priority, dueDate)
      if ("error" in res) {
        setError(res.error)
      } else {
        setTitle("")
        setPriority("normal")
        setDueDate("")
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + Add Task
      </button>
    )
  }

  return (
    <div className={styles.addForm}>
      <div className={styles.addFormTitle}>Add Task</div>
      <div className={styles.addFormFields}>
        <input
          type="text"
          placeholder="Task title"
          className={styles.addInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />
        <div className={styles.addFormRow}>
          <select
            className={styles.addSelect}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="low">Low</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <input
            type="date"
            className={styles.addInput}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      {error && <p className={styles.addError}>{error}</p>}
      <div className={styles.addFormActions}>
        <button className={styles.addSubmitBtn} onClick={handleSubmit} disabled={!title.trim()}>
          Add
        </button>
        <button className={styles.addCancelBtn} onClick={() => { setOpen(false); setError(null) }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
