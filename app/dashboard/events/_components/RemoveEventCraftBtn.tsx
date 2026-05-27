"use client"

import { useTransition } from "react"
import { removeCraftFromEvent } from "../actions"
import styles from "../folder.module.css"

export default function RemoveEventCraftBtn({
  eventKind,
  eventId,
  craftEventId,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  craftEventId: string
}) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      await removeCraftFromEvent(eventKind, eventId, craftEventId)
    })
  }

  return (
    <button
      className={styles.removeBtn}
      disabled={isPending}
      onClick={handleClick}
      title="Remove craft from event"
    >
      ×
    </button>
  )
}
