"use client"

import { useState } from "react"
import Link from "next/link"
import { createEvent } from "./actions"
import styles from "../events.module.css"

type Client = { id: string; name: string }

export default function NewEventForm({
  clients,
  error,
}: {
  clients: Client[]
  error?: string
}) {
  const [eventType, setEventType] = useState<"offsite" | "in-studio">("offsite")

  return (
    <form action={createEvent} className={styles.newEventWrap}>
      {error && <p className={styles.formError}>{decodeURIComponent(error)}</p>}

      {/* Event Type toggle */}
      <div className={styles.formTypeRow}>
        <button
          type="button"
          className={`${styles.typeBtn} ${
            eventType === "offsite" ? styles.typeBtnActive : ""
          }`}
          onClick={() => setEventType("offsite")}
        >
          Offsite
        </button>
        <button
          type="button"
          className={`${styles.typeBtn} ${
            eventType === "in-studio" ? styles.typeBtnActive : ""
          }`}
          onClick={() => setEventType("in-studio")}
        >
          In-Studio
        </button>
        <input type="hidden" name="event_type" value={eventType} />
      </div>

      {/* Title */}
      <div className={styles.formField}>
        <label className={styles.formLabel}>Event Title</label>
        <input
          name="title"
          type="text"
          required
          className={styles.formInput}
          placeholder="e.g. Smith Wedding, Spring Workshop"
        />
      </div>

      {/* Client */}
      <div className={styles.formField}>
        <label className={styles.formLabel}>Client</label>
        <select name="client_id" className={styles.formSelect}>
          <option value="">— Select client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date + Times */}
      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Event Date</label>
          <input
            name="event_date"
            type="date"
            required
            className={styles.formInput}
          />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Start Time</label>
          <input name="start_time" type="time" className={styles.formInput} />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>End Time</label>
          <input name="end_time" type="time" className={styles.formInput} />
        </div>
      </div>

      {/* Guest Count + Location (offsite only) */}
      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Guest Count</label>
          <input
            name="guest_count"
            type="number"
            min="0"
            className={styles.formInput}
            placeholder="0"
          />
        </div>
        {eventType === "offsite" && (
          <div className={`${styles.formField} ${styles.formFieldWide}`}>
            <label className={styles.formLabel}>Location</label>
            <input
              name="location"
              type="text"
              className={styles.formInput}
              placeholder="Venue name or address"
            />
          </div>
        )}
      </div>

      {/* Budget + Deposit */}
      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Budget ($)</label>
          <input
            name="budget"
            type="number"
            min="0"
            step="1"
            className={styles.formInput}
            placeholder="0"
          />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Deposit Amount ($)</label>
          <input
            name="deposit_amount"
            type="number"
            min="0"
            step="1"
            className={styles.formInput}
            placeholder="0"
          />
        </div>
      </div>

      {/* Notes */}
      <div className={styles.formField}>
        <label className={styles.formLabel}>Notes</label>
        <textarea
          name="notes"
          rows={4}
          className={styles.formTextarea}
          placeholder="Any additional details..."
        />
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.submitBtn}>
          Create Event
        </button>
        <Link href="/dashboard/events" className={styles.cancelLink}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
