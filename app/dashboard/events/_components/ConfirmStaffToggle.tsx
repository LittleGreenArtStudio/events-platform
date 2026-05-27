"use client"

import { useState, useTransition } from "react"
import { toggleStaffConfirmed } from "../actions"
import styles from "../folder.module.css"

export default function ConfirmStaffToggle({
  eventKind,
  eventId,
  staffEventId,
  confirmed,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  staffEventId: string
  confirmed: boolean
}) {
  const [optimistic, setOptimistic] = useState(confirmed)
  const [, startTransition] = useTransition()

  const handleClick = () => {
    setOptimistic((prev) => !prev)
    startTransition(async () => {
      await toggleStaffConfirmed(eventKind, eventId, staffEventId, optimistic)
    })
  }

  return (
    <button
      className={`${styles.confirmToggle} ${optimistic ? styles.confirmToggleOn : ""}`}
      onClick={handleClick}
      title={optimistic ? "Mark unconfirmed" : "Mark confirmed"}
    >
      {optimistic ? "Confirmed" : "Confirm"}
    </button>
  )
}
