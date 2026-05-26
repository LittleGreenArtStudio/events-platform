"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { importCalendarEvent, updateCalendarPreferences, dismissEvent } from "./actions"
import styles from "./integrations.module.css"
import type { CalendarOption, CalendarSuggestion } from "./types"

type RowState =
  | "idle"
  | "importing"
  | "ignored"
  | { status: "imported"; eventId: string; eventType: string }
  | { status: "error"; message: string }

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
  const [state, setState] = useState<RowState>("idle")
  const [, startTransition] = useTransition()

  const doImport = (eventType: "offsite" | "in-studio") => {
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
      if ("error" in result) {
        setState({ status: "error", message: result.error })
      } else {
        setState({ status: "imported", eventId: result.eventId, eventType: result.eventType })
      }
    })
  }

  const doIgnore = () => {
    setState("ignored")
    startTransition(async () => {
      await dismissEvent(suggestion.googleId)
    })
  }

  if (state === "ignored") return null

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
        ) : state === "importing" ? (
          <span className={styles.savingIndicator}>Importing…</span>
        ) : typeof state === "object" && state.status === "imported" ? (
          <>
            <span className={styles.importedTag}>Imported ✓</span>
            <Link
              href={`/dashboard/events/${state.eventType}/${state.eventId}`}
              className={styles.openFolderLink}
            >
              Open event folder →
            </Link>
          </>
        ) : typeof state === "object" && state.status === "error" ? (
          <span className={styles.errorTag}>{state.message}</span>
        ) : (
          <>
            <button
              className={styles.importBtn}
              onClick={() => doImport("offsite")}
            >
              Offsite
            </button>
            <button
              className={styles.importBtn}
              onClick={() => doImport("in-studio")}
            >
              In-Studio
            </button>
            <button
              className={styles.ignoreBtn}
              onClick={doIgnore}
            >
              Ignore
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function GoogleCalendarCard({
  connected,
  calendars,
  selectedCalendarIds: initialSelectedIds,
}: {
  connected: boolean
  calendars: CalendarOption[]
  selectedCalendarIds: string[]
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedIds)
  )
  const [isPrefsPending, startPrefsTransition] = useTransition()

  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<CalendarSuggestion[] | null>(null)

  const toggleCalendar = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
    startPrefsTransition(async () => {
      await updateCalendarPreferences(Array.from(next))
    })
  }

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
            Import events from your Google Calendars into the event list.
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

      {connected && calendars.length > 0 && (
        <div className={styles.calChipsSection}>
          <div className={styles.calChipsLabel}>
            Calendars to sync
            {isPrefsPending && (
              <span className={styles.savingIndicator}> saving…</span>
            )}
          </div>
          <div className={styles.calChips}>
            {calendars.map((cal) => (
              <button
                key={cal.id}
                type="button"
                className={`${styles.calChip} ${
                  selectedIds.has(cal.id) ? styles.calChipActive : ""
                }`}
                onClick={() => toggleCalendar(cal.id)}
              >
                {cal.color && (
                  <span
                    className={styles.calChipDot}
                    style={{ background: cal.color }}
                  />
                )}
                {cal.name}
              </button>
            ))}
          </div>
          <div className={styles.calChipsHint}>
            {selectedIds.size === 0
              ? "No calendars selected — all calendars will be synced"
              : `${selectedIds.size} calendar${selectedIds.size !== 1 ? "s" : ""} selected`}
          </div>
        </div>
      )}

      {syncError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          {syncError}
        </div>
      )}

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
