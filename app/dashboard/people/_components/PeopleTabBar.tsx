import Link from "next/link"
import styles from "../people.module.css"

type Tab = "clients" | "staff" | "vendors"

export default function PeopleTabBar({
  activeTab,
  counts,
}: {
  activeTab: Tab
  counts: { clients: number; staff: number; vendors: number }
}) {
  const newHref =
    activeTab === "staff"
      ? "/dashboard/people/staff/new"
      : activeTab === "vendors"
      ? "/dashboard/people/vendors/new"
      : "/dashboard/people/clients/new"

  const newLabel =
    activeTab === "staff"
      ? "+ New Staff Member"
      : activeTab === "vendors"
      ? "+ New Vendor"
      : "+ New Client"

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabs}>
        <Link
          href="/dashboard/people"
          className={`${styles.tab} ${activeTab === "clients" ? styles.tabActive : ""}`}
        >
          Clients
          <span className={styles.tabBadge}>{counts.clients}</span>
        </Link>
        <Link
          href="/dashboard/people/staff"
          className={`${styles.tab} ${activeTab === "staff" ? styles.tabActive : ""}`}
        >
          Staff
          <span className={styles.tabBadge}>{counts.staff}</span>
        </Link>
        <Link
          href="/dashboard/people/vendors"
          className={`${styles.tab} ${activeTab === "vendors" ? styles.tabActive : ""}`}
        >
          Vendors
          <span className={styles.tabBadge}>{counts.vendors}</span>
        </Link>
      </div>
      <Link href={newHref} className={styles.newBtn}>
        {newLabel}
      </Link>
    </div>
  )
}
