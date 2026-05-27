import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import { notFound } from "next/navigation"
import styles from "../../people.module.css"

type StaffDetail = {
  id: string
  first_name: string | null
  last_name: string | null
  role_title: string | null
  email: string | null
  phone: string | null
  hourly_rate: number | null
  is_active: boolean
  notes: string | null
}

function formatRate(rate: number | null): string {
  if (rate == null) return "—"
  return `$${rate % 1 === 0 ? rate : rate.toFixed(2)}/hr`
}

export default async function StaffProfilePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("staff")
    .select("*")
    .eq("id", params.id)
    .maybeSingle()

  if (!data) notFound()

  const member = data as unknown as StaffDetail

  const displayName =
    [member.first_name, member.last_name].filter(Boolean).join(" ") || "Staff Member"

  const sub = [member.role_title, member.email].filter(Boolean).join(" · ")

  const infoItems = [
    { label: "First Name", value: member.first_name ?? "—" },
    { label: "Last Name", value: member.last_name ?? "—" },
    { label: "Role", value: member.role_title ?? "—" },
    { label: "Email", value: member.email ?? "—" },
    { label: "Phone", value: member.phone ?? "—" },
    { label: "Hourly Rate", value: formatRate(member.hourly_rate) },
    { label: "Status", value: member.is_active ? "Active" : "Inactive" },
    ...(member.notes ? [{ label: "Notes", value: member.notes }] : []),
  ]

  return (
    <>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/people" className={styles.breadcrumbLink}>People</Link>
        <span className={styles.breadcrumbSep}>→</span>
        <Link href="/dashboard/people/staff" className={styles.breadcrumbLink}>Staff</Link>
        <span className={styles.breadcrumbSep}>→</span>
        <span className={styles.breadcrumbCurrent}>{displayName}</span>
      </div>

      <div className={styles.profileHeader}>
        <div className={styles.profileTypeRow}>
          <span className={styles.profileTypeLabel}>Staff Member</span>
          <span className={member.is_active ? styles.activePill : styles.inactivePill}>
            {member.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <h2 className={styles.profileName}>
          {member.first_name ?? displayName}{" "}
          {member.last_name && (
            <em className={styles.profileNameAccent}>{member.last_name}</em>
          )}
        </h2>
        {sub && <p className={styles.profileSub}>{sub}</p>}
      </div>

      <div className={styles.profileDoubleRule} />

      <div className={styles.profileContent}>
        <div>
          <div className={styles.infoSectionTitle}>Details</div>
          {infoItems.map(({ label, value }) => (
            <div key={label} className={styles.infoItem}>
              <span className={styles.infoLabel}>{label}</span>
              <span className={styles.infoValue}>{value}</span>
            </div>
          ))}
        </div>

        <div>
          <div className={styles.eventsSectionTitle}>Events</div>
          <p className={styles.noEvents}>Event assignments coming soon.</p>
        </div>
      </div>
    </>
  )
}
