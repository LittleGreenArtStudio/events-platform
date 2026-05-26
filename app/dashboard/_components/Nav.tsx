"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import styles from "../dashboard.module.css"

const NAV_ITEMS: { label: string; href: string | null }[] = [
  { label: "Studio HQ", href: "/dashboard" },
  { label: "Events", href: "/dashboard/events" },
  { label: "Craft Library", href: null },
  { label: "People", href: "/dashboard/people" },
  { label: "Tasks", href: null },
  { label: "Integrations", href: "/dashboard/integrations" },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(({ label, href }) => {
        if (!href) {
          return (
            <span key={label} className={styles.navItem}>
              {label}
            </span>
          )
        }
        const isActive =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href)
        return (
          <Link
            key={label}
            href={href}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
