"use client"

import { usePathname } from "next/navigation"
import styles from "../dashboard.module.css"

export default function PageLabel() {
  const pathname = usePathname()
  const label = pathname.startsWith("/dashboard/events")
    ? "Events"
    : pathname.startsWith("/dashboard/integrations")
    ? "Integrations"
    : "Studio HQ"
  return <span className={styles.mastheadPageLabel}>{label}</span>
}
