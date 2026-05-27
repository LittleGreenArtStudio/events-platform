import Link from "next/link"
import { createCraft } from "../actions"
import styles from "../crafts.module.css"

const CATEGORIES = [
  "Visual Arts",
  "Candle Making",
  "Floral & Outdoor",
  "Textiles & Fibercraft",
  "Jewelry & Metals",
  "Wellness",
  "All Things Autumn",
  "Winter Holidays",
]

export default async function NewCraftPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null

  return (
    <div className={styles.formWrap}>
      <h2 className={styles.formHeading}>New Craft</h2>
      <p className={styles.formSub}>
        Add a craft to your library. You can attach supplies from the craft detail page.
      </p>

      {error && <div className={styles.formError}>{error}</div>}

      <form action={createCraft}>
        <div className={styles.formSection}>
          <div className={styles.formSectionTitle}>Craft Details</div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Name</label>
            <input
              name="name"
              type="text"
              required
              autoFocus
              className={styles.formInput}
              placeholder="e.g. Watercolor Painting"
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>
              Description{" "}
              <span className={styles.formLabelOptional}>(optional)</span>
            </label>
            <textarea
              name="description"
              className={styles.formTextarea}
              placeholder="A short description of this craft activity…"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Category</label>
              <select name="category" className={styles.formSelect} defaultValue="">
                <option value="">— Select —</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Skill Level</label>
              <select name="skill_level" className={styles.formSelect} defaultValue="">
                <option value="">— Select —</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Time per Guest (min)</label>
              <input
                name="time_per_guest"
                type="number"
                min="0"
                className={styles.formInput}
                placeholder="e.g. 45"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Min Guests</label>
              <input
                name="min_guests"
                type="number"
                min="0"
                className={styles.formInput}
                placeholder="e.g. 5"
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Max Guests</label>
              <input
                name="max_guests"
                type="number"
                min="0"
                className={styles.formInput}
                placeholder="e.g. 50"
              />
            </div>
          </div>

          <div className={styles.toggleRow}>
            <input
              type="hidden"
              name="is_active"
              value="false"
            />
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              value="true"
              defaultChecked
            />
            <label htmlFor="is_active" className={styles.toggleLabel}>
              Active (available for events)
            </label>
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.formSectionTitle}>Notes</div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>
              Setup Notes{" "}
              <span className={styles.formLabelOptional}>(optional)</span>
            </label>
            <textarea
              name="setup_notes"
              className={styles.formTextarea}
              placeholder="What needs to happen before guests arrive…"
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>
              Teardown Notes{" "}
              <span className={styles.formLabelOptional}>(optional)</span>
            </label>
            <textarea
              name="teardown_notes"
              className={styles.formTextarea}
              placeholder="Cleanup and wrap-up steps…"
            />
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn}>
            Create Craft
          </button>
          <Link href="/dashboard/crafts" className={styles.cancelLink}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
