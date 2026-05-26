import Link from "next/link"
import { createStaff } from "../../actions"
import styles from "../../people.module.css"

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <form action={createStaff} className={styles.formWrap}>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/people/staff" className={styles.breadcrumbLink}>
          People
        </Link>
        <span className={styles.breadcrumbSep}>→</span>
        <span className={styles.breadcrumbCurrent}>New Staff Member</span>
      </div>

      <h2 className={styles.formHeading}>New Staff Member</h2>
      <p className={styles.formSub}>Add a team member to your roster.</p>

      {searchParams.error && (
        <p className={styles.formError}>{decodeURIComponent(searchParams.error)}</p>
      )}

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>First Name</label>
          <input name="first_name" type="text" className={styles.formInput} placeholder="Alex" />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Last Name</label>
          <input name="last_name" type="text" className={styles.formInput} placeholder="Rivera" />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>
            Role <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input name="role_title" type="text" className={styles.formInput} placeholder="Lead Florist" />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>
            Hourly Rate ($) <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input name="hourly_rate" type="number" min="0" step="0.01" className={styles.formInput} placeholder="0" />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>
            Email <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input name="email" type="email" className={styles.formInput} placeholder="alex@example.com" />
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
          Notes <span className={styles.formLabelOptional}>(optional)</span>
        </label>
        <textarea name="notes" rows={3} className={styles.formTextarea} placeholder="Skills, availability, notes…" />
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.submitBtn}>Create Staff Member</button>
        <Link href="/dashboard/people/staff" className={styles.cancelLink}>Cancel</Link>
      </div>
    </form>
  )
}
