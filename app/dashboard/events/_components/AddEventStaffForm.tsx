"use client"

import { useState, useTransition } from "react"
import { addStaffToEvent } from "../actions"
import styles from "../folder.module.css"

type StaffOption = { id: string; first_name: string | null; last_name: string | null; role_title: string | null }

export default function AddEventStaffForm({
  eventKind,
  eventId,
  allStaff,
  existingStaffIds,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  allStaff: StaffOption[]
  existingStaffIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const [staffId, setStaffId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const available = allStaff.filter((s) => !existingStaffIds.includes(s.id))

  const handleSubmit = () => {
    if (!staffId) return
    setError(null)
    startTransition(async () => {
      const res = await addStaffToEvent(eventKind, eventId, staffId)
      if ("error" in res) {
        setError(res.error)
      } else {
        setStaffId("")
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + Add Staff
      </button>
    )
  }

  return (
    <div className={styles.addForm}>
      <div className={styles.addFormTitle}>Add Staff Member</div>
      <div className={styles.addFormFields}>
        <select
          className={styles.addSelect}
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
        >
          <option value="">— Select staff —</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {[s.first_name, s.last_name].filter(Boolean).join(" ")}
              {s.role_title ? ` · ${s.role_title}` : ""}
            </option>
          ))}
          {available.length === 0 && (
            <option disabled>All staff already added</option>
          )}
        </select>
      </div>
      {error && <p className={styles.addError}>{error}</p>}
      <div className={styles.addFormActions}>
        <button className={styles.addSubmitBtn} onClick={handleSubmit} disabled={!staffId}>
          Add
        </button>
        <button className={styles.addCancelBtn} onClick={() => { setOpen(false); setError(null) }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
