"use client"

import { useState, useTransition } from "react"
import { importCalendarEvent } from "./actions"
import styles from "./integrations.module.css"
import type { CalendarSuggestion } from "@/app/api/google/calendar/sync/route"

type ImportState = "idle" | "importing" | "done" | "error"

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function SuggestionRow({ suggestion }: { suggestion: CalendarSuggestion }) {
  const [offState, setOffState] = useState<ImportState>("idle")
  const [inState, setInState] = useState<ImportState>("idle")
  const [, startTransition] = useTransition()

  const doImport = (eventType: "offsite" | "in-studio", setState: (s: ImportState) => void) => {
    setState("importing")
    const fd = new FormData()
    fd.set("event_type", eventType)
    fd.set("title", suggestion.title)
    fd.set("date", suggestion.date)
    fd.set("start_time", suggestion.startTime ?? "")
    fd.set("end_time", suggestion.endTime ?? "")
    fd.set("location", suggestion.location ?? "")
    fd.set("description", suggestion.description ?? "")

    startTransition(async () => {
      const result = await importCalendarEvent(fd)
      setState(result.error ? "error" : "done")
    })
  }

  const isDone = offState === "done" || inState === "done"
  const meta = [
    formatDate(suggestion.date),
    suggestion.startTime && suggestion.endTime
      ? `${suggestion.startTime} – ${suggestion.endTime}`
      : suggestion.startTime ?? null,
    suggestion.location,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className={styles.suggRow}>
      <div className={styles.suggBody}>
        <div className={styles.suggTitle}>{suggestion.title}</div>
        {meta && <div className={styles.suggMeta}>{meta}</div>}
        {suggestion.description && (
          <div className={styles.suggMeta}>{suggestion.description.slice(0, 120)}</div>
        )}
      </div>
      <div className={styles.suggActions}>
        {suggestion.alreadyExists ? (
          <span className={styles.alreadyTag}>Already imported</span>
        ) : isDone ? (
          <span className={styles.importedTag}>Imported ✓</span>
        ) : (
          <>
            <button
              className={styles.importBtn}
              disabled={offState === "importing" || inState === "importing"}
              onClick={() => doImport("offsite", setOffState)}
            >
              {offState === "importing" ? "…" : "Offsite"}
            </button>
            <button
              className={styles.importBtn}
              disabled={offState === "importing" || inState === "importing"}
              onClick={() => doImport("in-studio", setInState)}
            >
              {inState === "importing" ? "…" : "In-Studio"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function GoogleCalendarCard({
  connected,
}: {
  connected: boolean
}) {
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<CalendarSuggestion[] | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    setSuggestions(null)
    try {
      const res = await fetch("/api/google/calendar/sync")
      const json = await res.json()
      if (!res.ok || json.error) {
        setSyncError(json.error ?? "Sync failed")
      } else {
        setSuggestions(json.suggestions)
      }
    } catch {
      setSyncError("Network error during sync")
    } finally {
      setSyncing(false)
    }
  }

  const newCount = suggestions?.filter((s) => !s.alreadyExists).length ?? 0
  const existingCount = suggestions?.filter((s) => s.alreadyExists).length ?? 0

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardInfo}>
          <div className={styles.cardTitle}>Google Calendar</div>
          <div className={styles.cardDesc}>
            Import events from your primary Google Calendar into the event list.
            <br />
            Scopes: Calendar (read), Gmail (read + send), Contacts (read).
          </div>
        </div>
        <div className={styles.cardActions}>
          {connected ? (
            <>
              <span className={styles.connectedBadge}>Connected ✓</span>
              <button
                className={styles.outlineBtn}
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? "Syncing…" : "Sync Calendar"}
              </button>
              <a href="/api/auth/google" className={styles.outlineBtn}>
                Reconnect
              </a>
            </>
          ) : (
            <a href="/api/auth/google" className={styles.connectBtn}>
              Connect Google
            </a>
          )}
        </div>
      </div>

      {/* Sync error */}
      {syncError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          {syncError}
        </div>
      )}

      {/* Results */}
      {suggestions !== null && (
        <div className={styles.syncSection}>
          <div className={styles.syncSectionTitle}>
            {suggestions.length === 0
              ? "No upcoming Google Calendar events"
              : `${newCount} new event${newCount !== 1 ? "s" : ""} · ${existingCount} already imported`}
          </div>

          {suggestions.length === 0 ? (
            <p className={styles.syncEmpty}>
              No events found in the next 90 days.
            </p>
          ) : (
            suggestions.map((s) => (
              <SuggestionRow key={s.googleId} suggestion={s} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
