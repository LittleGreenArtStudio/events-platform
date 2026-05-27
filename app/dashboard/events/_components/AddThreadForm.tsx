"use client"

import { useState, useTransition } from "react"
import { addThread } from "../actions"
import styles from "../folder.module.css"

const THREAD_TYPES = [
  { value: "note", label: "Note" },
  { value: "email", label: "Email" },
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
]

export default function AddThreadForm({
  eventKind,
  eventId,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("note")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!body.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addThread(eventKind, eventId, body, subject, type)
      if ("error" in res) {
        setError(res.error)
      } else {
        setType("note")
        setSubject("")
        setBody("")
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + Add Note
      </button>
    )
  }

  return (
    <div className={styles.addForm}>
      <div className={styles.addFormTitle}>Add Note</div>
      <div className={styles.addFormFields}>
        <div className={styles.addFormRow}>
          <select
            className={styles.addSelect}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {THREAD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Subject (optional)"
            className={styles.addInput}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <textarea
          placeholder="Note content…"
          className={styles.addTextarea}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {error && <p className={styles.addError}>{error}</p>}
      <div className={styles.addFormActions}>
        <button className={styles.addSubmitBtn} onClick={handleSubmit} disabled={!body.trim()}>
          Save Note
        </button>
        <button className={styles.addCancelBtn} onClick={() => { setOpen(false); setError(null) }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
