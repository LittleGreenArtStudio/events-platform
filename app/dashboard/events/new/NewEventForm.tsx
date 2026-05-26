"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { createEvent, createClient } from "./actions"
import type { NewClientInput } from "./actions"
import styles from "../events.module.css"

type Client = { id: string; name: string }

const EMPTY_CLIENT: NewClientInput = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
}

export default function NewEventForm({
  clients: initialClients,
  error,
}: {
  clients: Client[]
  error?: string
}) {
  // ── Event type ──────────────────────────────────────────────────────────
  const [eventType, setEventType] = useState<"offsite" | "in-studio">("offsite")

  // ── Client selection ────────────────────────────────────────────────────
  // clients list is kept in state so we can append a newly-created one
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [selectedClientId, setSelectedClientId] = useState("")
  const [showAddClient, setShowAddClient] = useState(false)

  // ── Inline add-client form ──────────────────────────────────────────────
  const [newClient, setNewClient] = useState<NewClientInput>(EMPTY_CLIENT)
  const [creatingClient, setCreatingClient] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === "__add_new__") {
      setShowAddClient(true)
    } else {
      setSelectedClientId(val)
      setShowAddClient(false)
    }
  }

  const handleNewClientField =
    (field: keyof NewClientInput) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setNewClient((prev) => ({ ...prev, [field]: e.target.value }))

  const handleCreateClient = () => {
    setCreatingClient(true)
    setClientError(null)
    startTransition(async () => {
      const result = await createClient(newClient)
      if ("error" in result) {
        setClientError(result.error)
        setCreatingClient(false)
        return
      }
      const created = result.client
      setClients((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      )
      setSelectedClientId(created.id)
      setShowAddClient(false)
      setNewClient(EMPTY_CLIENT)
      setCreatingClient(false)
    })
  }

  const cancelAddClient = () => {
    setShowAddClient(false)
    setNewClient(EMPTY_CLIENT)
    setClientError(null)
    // Leave selectedClientId unchanged — user can pick from the list
    if (selectedClientId === "") {
      // they had nothing selected before opening the panel; reset to blank
    }
  }

  return (
    <form action={createEvent} className={styles.newEventWrap}>
      {error && <p className={styles.formError}>{decodeURIComponent(error)}</p>}

      {/* client_id is submitted via hidden input so the select value
          "add_new__" never reaches the server action */}
      <input type="hidden" name="client_id" value={selectedClientId} />

      {/* ── Event Type ── */}
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

      {/* ── Title ── */}
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

      {/* ── Client (optional) ── */}
      <div className={styles.formField}>
        <label className={styles.formLabel}>
          Client{" "}
          <span className={styles.formLabelOptional}>(optional)</span>
        </label>
        <select
          value={showAddClient ? "__add_new__" : selectedClientId}
          onChange={handleClientSelect}
          className={styles.formSelect}
        >
          <option value="">— No client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__add_new__">+ Add new client…</option>
        </select>
      </div>

      {/* ── Inline add-client panel ── */}
      {showAddClient && (
        <div className={styles.addClientPanel}>
          <div className={styles.addClientPanelTitle}>New Client</div>

          {clientError && (
            <p className={styles.formError}>{clientError}</p>
          )}

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>First Name</label>
              <input
                type="text"
                className={styles.formInput}
                value={newClient.firstName}
                onChange={handleNewClientField("firstName")}
                placeholder="Jane"
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Last Name</label>
              <input
                type="text"
                className={styles.formInput}
                value={newClient.lastName}
                onChange={handleNewClientField("lastName")}
                placeholder="Smith"
              />
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Company</label>
            <input
              type="text"
              className={styles.formInput}
              value={newClient.company}
              onChange={handleNewClientField("company")}
              placeholder="Smith Events LLC"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Email</label>
              <input
                type="email"
                className={styles.formInput}
                value={newClient.email}
                onChange={handleNewClientField("email")}
                placeholder="jane@example.com"
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Phone</label>
              <input
                type="tel"
                className={styles.formInput}
                value={newClient.phone}
                onChange={handleNewClientField("phone")}
                placeholder="(323) 555-0100"
              />
            </div>
          </div>

          <div className={styles.addClientActions}>
            <button
              type="button"
              className={styles.addClientSaveBtn}
              onClick={handleCreateClient}
              disabled={creatingClient}
            >
              {creatingClient ? "Creating…" : "Create Client"}
            </button>
            <button
              type="button"
              className={styles.cancelLink}
              onClick={cancelAddClient}
              disabled={creatingClient}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Date + Times ── */}
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

      {/* ── Guest Count + Location ── */}
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
            <label className={styles.formLabel}>Venue / Address</label>
            <input
              name="venue_address"
              type="text"
              className={styles.formInput}
              placeholder="Venue name or address"
            />
          </div>
        )}
      </div>

      {/* ── Budget + Deposit ── */}
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

      {/* ── Notes ── */}
      <div className={styles.formField}>
        <label className={styles.formLabel}>Notes</label>
        <textarea
          name="notes"
          rows={4}
          className={styles.formTextarea}
          placeholder="Any additional details…"
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
