import Link from "next/link"
import { createVendor } from "../../actions"
import styles from "../../people.module.css"

export default async function NewVendorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <form action={createVendor} className={styles.formWrap}>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/people/vendors" className={styles.breadcrumbLink}>
          People
        </Link>
        <span className={styles.breadcrumbSep}>→</span>
        <span className={styles.breadcrumbCurrent}>New Vendor</span>
      </div>

      <h2 className={styles.formHeading}>New Vendor</h2>
      <p className={styles.formSub}>Add a supplier or vendor to your network.</p>

      {searchParams.error && (
        <p className={styles.formError}>{decodeURIComponent(searchParams.error)}</p>
      )}

      <div className={styles.formField}>
        <label className={styles.formLabel}>Vendor Name</label>
        <input name="name" type="text" required className={styles.formInput} placeholder="Bloom & Co." />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>
            Category <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input name="category" type="text" className={styles.formInput} placeholder="Florals, Rentals…" />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>
            Contact Name <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input name="contact_name" type="text" className={styles.formInput} placeholder="Maria Lopez" />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>
            Email <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input name="email" type="email" className={styles.formInput} placeholder="hello@bloom.co" />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>
            Phone <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input name="phone" type="tel" className={styles.formInput} placeholder="(323) 555-0100" />
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>
          Website <span className={styles.formLabelOptional}>(optional)</span>
        </label>
        <input name="website" type="url" className={styles.formInput} placeholder="https://bloom.co" />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>
          Notes <span className={styles.formLabelOptional}>(optional)</span>
        </label>
        <textarea name="notes" rows={3} className={styles.formTextarea} placeholder="Lead times, specialties, notes…" />
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.submitBtn}>Create Vendor</button>
        <Link href="/dashboard/people/vendors" className={styles.cancelLink}>Cancel</Link>
      </div>
    </form>
  )
}
