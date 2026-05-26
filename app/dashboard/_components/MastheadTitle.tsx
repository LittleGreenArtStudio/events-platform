"use client"

import { usePathname } from "next/navigation"
import styles from "../dashboard.module.css"

export default function MastheadTitle() {
  const pathname = usePathname()
  const isEvents = pathname.startsWith("/dashboard/events")
  const isIntegrations = pathname.startsWith("/dashboard/integrations")
  const isPeople = pathname.startsWith("/dashboard/people")
  return (
    <h1 className={styles.mastheadTitle}>
      {isEvents ? (
        <em className={styles.mastheadTitleAccent}>Events</em>
      ) : isIntegrations ? (
        <em className={styles.mastheadTitleAccent}>Integrations</em>
      ) : isPeople ? (
        <em className={styles.mastheadTitleAccent}>People</em>
      ) : (
        <>
          Studio <em className={styles.mastheadTitleAccent}>HQ</em>
        </>
      )}
    </h1>
  )
}
