import Link from "next/link"
import { createClient } from "../../actions"
import styles from "../../people.module.css"

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <form action={createClient} className={styles.formWrap}>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/people" className={styles.breadcrumbLink}>
          People
        </Link>
        <span className={styles.breadcrumbSep}>→</span>
        <span className={styles.breadcrumbCurrent}>New Client</span>
      </div>

      <h2 className={styles.formHeading}>New Client</h2>
      <p className={styles.formSub}>Add a new client to your contact list.</p>

      {searchParams.error && (
        <p className={styles.formError}>{decodeURIComponent(searchParams.error)}</p>
      )}

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>First Name</label>
          <input name="first_name" type="text" className={styles.formInput} placeholder="Jane" />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Last Name</label>
          <input name="last_name" type="text" className={styles.formInput} placeholder="Smith" />
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>
          Company <span className={styles.formLabelOptional}>(optional)</span>
        </label>
        <input name="company" type="text" className={styles.formInput} placeholder="Smith Events LLC" />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>
            Email <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input name="email" type="email" className={styles.formInput} placeholder="jane@example.com" />
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
        <textarea name="notes" rows={3} className={styles.formTextarea} placeholder="Any notes about this client…" />
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.submitBtn}>Create Client</button>
        <Link href="/dashboard/people" className={styles.cancelLink}>Cancel</Link>
      </div>
    </form>
  )
}
