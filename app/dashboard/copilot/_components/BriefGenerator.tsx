"use client"

import { useState, useRef } from "react"
import type { EventOption } from "../types"
import styles from "../copilot.module.css"

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function BriefGenerator({ events }: { events: EventOption[] }) {
  const [selectedValue, setSelectedValue] = useState("")
  const [briefText, setBriefText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const [selectedType, selectedId] = selectedValue
    ? selectedValue.split(":")
    : ["", ""]

  const handleGenerate = async () => {
    if (!selectedValue) return
    setError(null)
    setBriefText("")
    setIsDone(false)
    setCopied(false)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsStreaming(true)

    try {
      const res = await fetch("/api/copilot/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: selectedType, eventId: selectedId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "Failed to generate brief")
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setError("No response body"); return }

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setBriefText((prev) => prev + decoder.decode(value, { stream: true }))
      }

      setIsDone(true)
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Stream error — check server logs")
      }
    } finally {
      setIsStreaming(false)
    }
  }

  const handleCopy = () => {
    if (!briefText) return
    navigator.clipboard.writeText(briefText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className={styles.toolSection}>
      <div className={styles.toolTitle}>Event Brief Generator</div>
      <p className={styles.toolDesc}>
        Generate a printable event brief with timeline, craft plan, client details, and open items.
        Claude reads all attached event data and writes the brief for you.
      </p>

      <div className={styles.toolForm}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Event</label>
          <select
            value={selectedValue}
            onChange={(e) => {
              setSelectedValue(e.target.value)
              setBriefText("")
              setIsDone(false)
              setError(null)
              setCopied(false)
            }}
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

        <button
          className={styles.primaryBtn}
          onClick={handleGenerate}
          disabled={!selectedValue || isStreaming}
        >
          {isStreaming ? "Generating…" : "Generate Brief"}
        </button>
      </div>

      {error && <p className={styles.errorBox}>{error}</p>}

      {(briefText || isStreaming) && (
        <div className={styles.briefWrap}>
          <div className={styles.briefActions}>
            {isDone && (
              <>
                <button className={styles.actionBtn} onClick={handleCopy}>
                  {copied ? "Copied ✓" : "Copy to Clipboard"}
                </button>
                <button className={styles.actionBtn} onClick={() => window.print()}>
                  Print
                </button>
                <span className={styles.briefNote}>
                  To save as PDF — choose &ldquo;Save as PDF&rdquo; in the print dialog
                </span>
              </>
            )}
          </div>
          <pre className={styles.briefText}>
            {briefText}
            {isStreaming && <span className={styles.cursor}>▍</span>}
          </pre>
        </div>
      )}
    </section>
  )
}
