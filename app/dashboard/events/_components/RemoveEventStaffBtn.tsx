"use client"

import { useTransition } from "react"
import { removeStaffFromEvent } from "../actions"
import styles from "../folder.module.css"

export default function RemoveEventStaffBtn({
  eventKind,
  eventId,
  staffEventId,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  staffEventId: string
}) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      await removeStaffFromEvent(eventKind, eventId, staffEventId)
    })
  }

  return (
    <button
      className={styles.removeBtn}
      disabled={isPending}
      onClick={handleClick}
      title="Remove from event"
    >
      ×
    </button>
  )
}
