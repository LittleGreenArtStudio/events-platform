"use client"

import { useState, useTransition } from "react"
import { setEventStatus, toggleDepositPaid } from "../actions"
import styles from "../folder.module.css"

const STATUS_ORDER = ["inquiry", "proposal_sent", "confirmed", "in_progress", "completed"]

export default function MilestoneToggle({
  eventKind,
  eventId,
  milestoneKey,
  label,
  done,
  targetStatus,
  isDeposit,
  depositPaid,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  milestoneKey: string
  label: string
  done: boolean
  targetStatus?: string
  isDeposit?: boolean
  depositPaid?: boolean
}) {
  const [optimisticDone, setOptimisticDone] = useState(done)
  const [, startTransition] = useTransition()

  const isFixed = milestoneKey === "inquiry_received"

  const handleClick = () => {
    if (isFixed) return
    const nextDone = !optimisticDone
    setOptimisticDone(nextDone)

    startTransition(async () => {
      if (isDeposit) {
        await toggleDepositPaid(eventKind, eventId, depositPaid ?? false)
      } else if (targetStatus) {
        let newStatus: string
        if (nextDone) {
          newStatus = targetStatus
        } else {
          const idx = STATUS_ORDER.indexOf(targetStatus)
          newStatus = idx > 0 ? STATUS_ORDER[idx - 1] : "inquiry"
        }
        await setEventStatus(eventKind, eventId, newStatus)
      }
    })
  }

  return (
    <div
      className={styles.milestone}
      onClick={handleClick}
      style={{ cursor: isFixed ? "default" : "pointer" }}
    >
      <div
        className={`${styles.milestoneCheck} ${optimisticDone ? styles.milestoneCheckDone : ""}`}
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
      <span
        className={`${styles.milestoneLabel} ${!optimisticDone ? styles.milestoneLabelPending : ""}`}
      >
        {label}
      </span>
    </div>
  )
}
