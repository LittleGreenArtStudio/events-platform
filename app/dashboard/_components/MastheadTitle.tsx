"use client"

import { usePathname } from "next/navigation"
import styles from "../dashboard.module.css"

export default function MastheadTitle() {
  const pathname = usePathname()
  const isEvents = pathname.startsWith("/dashboard/events")
  return (
    <h1 className={styles.mastheadTitle}>
      {isEvents ? (
        <em className={styles.mastheadTitleAccent}>Events</em>
      ) : (
        <>
          Studio <em className={styles.mastheadTitleAccent}>HQ</em>
        </>
      )}
    </h1>
  )
}
