"use client"

import { useState, useTransition } from "react"
import { addCraftToEvent } from "../actions"
import styles from "../folder.module.css"

type CraftOption = { id: string; name: string; category: string | null }

export default function AddEventCraftForm({
  eventKind,
  eventId,
  allCrafts,
  existingCraftIds,
  guestCount,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  allCrafts: CraftOption[]
  existingCraftIds: string[]
  guestCount: number | null
}) {
  const [open, setOpen] = useState(false)
  const [craftId, setCraftId] = useState("")
  const [guestOverride, setGuestOverride] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const available = allCrafts.filter((c) => !existingCraftIds.includes(c.id))

  const handleSubmit = () => {
    if (!craftId) return
    setError(null)
    startTransition(async () => {
      const res = await addCraftToEvent(eventKind, eventId, craftId, guestOverride, notes)
      if ("error" in res) {
        setError(res.error)
      } else {
        setCraftId("")
        setGuestOverride("")
        setNotes("")
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + Add Craft
      </button>
    )
  }

  return (
    <div className={styles.addForm}>
      <div className={styles.addFormTitle}>Add Craft to Event</div>
      <div className={styles.addFormFields}>
        <select
          className={styles.addSelect}
          value={craftId}
          onChange={(e) => setCraftId(e.target.value)}
        >
          <option value="">— Select craft —</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.category ? ` · ${c.category}` : ""}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          placeholder={`Guest count override (default: ${guestCount ?? "—"})`}
          className={styles.addInput}
          value={guestOverride}
          onChange={(e) => setGuestOverride(e.target.value)}
        />
        <input
          type="text"
          placeholder="Notes (optional)"
          className={styles.addInput}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error && <p className={styles.addError}>{error}</p>}
      <div className={styles.addFormActions}>
        <button className={styles.addSubmitBtn} onClick={handleSubmit} disabled={!craftId}>
          Add
        </button>
        <button className={styles.addCancelBtn} onClick={() => { setOpen(false); setError(null) }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
