"use client"

import { useState, useTransition } from "react"
import { getEventCrafts, estimateSupplies, saveEstimateToEvent } from "../actions"
import type { EventOption, CraftInfo } from "../types"
import styles from "../copilot.module.css"

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function SupplyEstimator({ events }: { events: EventOption[] }) {
  const [selectedValue, setSelectedValue] = useState("")
  const [guestCount, setGuestCount] = useState<number | string>(0)
  const [bufferPct, setBufferPct] = useState<number | string>(15)
  const [crafts, setCrafts] = useState<CraftInfo[] | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [copied, setCopied] = useState(false)

  const [craftsLoading, startCraftsTransition] = useTransition()
  const [isPending, startEstimateTransition] = useTransition()

  const [selectedType, selectedId] = selectedValue
    ? selectedValue.split(":")
    : ["", ""]

  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedValue(value)
    setResult(null)
    setError(null)
    setCrafts(null)
    setSaveState("idle")
    setCopied(false)

    if (!value) {
      setGuestCount(0)
      return
    }

    const [type, id] = value.split(":")
    const event = events.find((ev) => ev.id === id && ev.type === type)
    setGuestCount(event?.guestCount ?? 0)

    startCraftsTransition(async () => {
      const res = await getEventCrafts(type, id)
      if ("crafts" in res) setCrafts(res.crafts)
    })
  }

  const handleEstimate = () => {
    if (!selectedValue) return
    setError(null)
    setResult(null)
    setSaveState("idle")
    setCopied(false)

    const fd = new FormData()
    fd.set("event_type", selectedType)
    fd.set("event_id", selectedId)
    fd.set("guest_count", String(guestCount))
    fd.set("buffer", String(bufferPct))

    startEstimateTransition(async () => {
      const res = await estimateSupplies(fd)
      if ("error" in res) {
        setError(res.error)
      } else {
        setResult(res.text)
      }
    })
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!result || !selectedValue) return
    setSaveState("saving")
    const res = await saveEstimateToEvent(selectedType, selectedId, result)
    setSaveState(res.ok ? "saved" : "error")
  }

  return (
    <section className={styles.toolSection}>
      <div className={styles.toolTitle}>Supply Estimator</div>
      <p className={styles.toolDesc}>
        Select an event to calculate exact supply quantities with buffer overage.
        Claude reads the crafts and supply list attached to the event and does the math.
      </p>

      <div className={styles.toolForm}>
        {/* Event dropdown */}
        <div className={styles.formField}>
          <label className={styles.formLabel}>Event</label>
          <select
            value={selectedValue}
            onChange={handleEventChange}
            className={styles.formSelect}
          >
            <option value="">— Select an event —</option>
            <optgroup label="Offsite Events">
              {events
                .filter((e) => e.type === "offsite")
                .map((e) => (
                  <option key={`${e.type}:${e.id}`} value={`${e.type}:${e.id}`}>
                    {e.title} · {formatDate(e.date)}
                  </option>
                ))}
            </optgroup>
            <optgroup label="In-Studio Events">
              {events
                .filter((e) => e.type === "in-studio")
                .map((e) => (
                  <option key={`${e.type}:${e.id}`} value={`${e.type}:${e.id}`}>
                    {e.title} · {formatDate(e.date)}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        {/* Crafts preview */}
        {craftsLoading && (
          <p className={styles.loadingHint}>Loading crafts…</p>
        )}
        {crafts !== null && crafts.length === 0 && (
          <p className={styles.craftsEmpty}>
            No crafts attached to this event — supply estimate will be limited.
          </p>
        )}
        {crafts !== null && crafts.length > 0 && (
          <div className={styles.craftsPreview}>
            <div className={styles.craftsPreviewTitle}>
              Crafts on this event
            </div>
            {crafts.map((craft) => (
              <div key={craft.id} className={styles.craftItem}>
                <span className={styles.craftItemName}>{craft.name}</span>
                <span className={styles.craftItemMeta}>
                  {craft.quantity != null ? `×${craft.quantity}` : ""}
                  {craft.quantity != null && craft.supplies.length > 0 ? " · " : ""}
                  {craft.supplies.length > 0
                    ? `${craft.supplies.length} supply item${craft.supplies.length !== 1 ? "s" : ""}`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Guest count + buffer */}
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Guest Count</label>
            <input
              type="number"
              min="0"
              className={styles.formInput}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Buffer %</label>
            <input
              type="number"
              min="0"
              max="100"
              className={styles.formInput}
              value={bufferPct}
              onChange={(e) => setBufferPct(e.target.value)}
            />
          </div>
        </div>

        <button
          className={styles.primaryBtn}
          onClick={handleEstimate}
          disabled={!selectedValue || isPending}
        >
          {isPending ? "Estimating…" : "Estimate Supplies"}
        </button>
      </div>

      {error && <p className={styles.errorBox}>{error}</p>}

      {result && (
        <div className={styles.resultWrap}>
          <div className={styles.resultActions}>
            <button className={styles.actionBtn} onClick={handleCopy}>
              {copied ? "Copied ✓" : "Copy to Clipboard"}
            </button>
            <button
              className={styles.actionBtn}
              onClick={handleSave}
              disabled={saveState === "saving" || saveState === "saved"}
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                ? "Saved to Event ✓"
                : saveState === "error"
                ? "Save Failed"
                : "Save to Event"}
            </button>
          </div>
          <pre className={styles.resultText}>{result}</pre>
        </div>
      )}
    </section>
  )
}
