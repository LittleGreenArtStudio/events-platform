import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import { notFound } from "next/navigation"
import styles from "../../people.module.css"

type VendorDetail = {
  id: string
  name: string
  category: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  notes: string | null
}

export default async function VendorProfilePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", params.id)
    .maybeSingle()

  if (!data) notFound()

  const vendor = data as unknown as VendorDetail

  const sub = [vendor.category, vendor.contact_name].filter(Boolean).join(" · ")

  const infoItems = [
    { label: "Category", value: vendor.category ?? "—" },
    { label: "Contact", value: vendor.contact_name ?? "—" },
    { label: "Email", value: vendor.email ?? "—" },
    { label: "Phone", value: vendor.phone ?? "—" },
    { label: "Website", value: vendor.website ?? "—" },
    ...(vendor.notes ? [{ label: "Notes", value: vendor.notes }] : []),
  ]

  return (
    <>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/people" className={styles.breadcrumbLink}>People</Link>
        <span className={styles.breadcrumbSep}>→</span>
        <Link href="/dashboard/people/vendors" className={styles.breadcrumbLink}>Vendors</Link>
        <span className={styles.breadcrumbSep}>→</span>
        <span className={styles.breadcrumbCurrent}>{vendor.name}</span>
      </div>

      <div className={styles.profileHeader}>
        <div className={styles.profileTypeRow}>
          <span className={styles.profileTypeLabel}>Vendor</span>
          {vendor.category && (
            <span className={styles.eventCountBadge}>{vendor.category}</span>
          )}
        </div>
        <h2 className={styles.profileName}>
          {vendor.name}
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
              <span className={styles.infoValue}>
                {label === "Website" && vendor.website ? (
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "none" }}
                  >
                    {vendor.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  value
                )}
              </span>
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
