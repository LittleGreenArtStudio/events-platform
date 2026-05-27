"use client"

import { useState, useRef } from "react"
import styles from "../folder.module.css"

export default function EventBriefPanel({
  eventKind,
  eventId,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
}) {
  const [briefText, setBriefText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleGenerate = async () => {
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
        body: JSON.stringify({ eventType: eventKind, eventId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? "Failed to generate brief")
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
        const msg = err instanceof Error ? err.message : String(err)
        setError(`Stream error: ${msg}`)
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
    <div>
      <p className={styles.briefDesc}>
        Generate a print-ready event brief with timeline, craft plan, client details, and open items.
        Claude reads all attached event data.
      </p>

      <div className={styles.briefActions}>
        <button
          className={styles.addSubmitBtn}
          onClick={handleGenerate}
          disabled={isStreaming}
        >
          {isStreaming ? "Generating…" : briefText ? "Regenerate Brief" : "Generate Brief"}
        </button>
        {isDone && (
          <>
            <button className={styles.briefActionBtn} onClick={handleCopy}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button className={styles.briefActionBtn} onClick={() => window.print()}>
              Print
            </button>
          </>
        )}
        {isStreaming && (
          <button
            className={styles.briefActionBtn}
            onClick={() => { abortRef.current?.abort(); setIsStreaming(false) }}
          >
            Cancel
          </button>
        )}
      </div>

      {error && <p className={styles.addError}>{error}</p>}

      {(briefText || isStreaming) && (
        <pre className={styles.briefText}>
          {briefText}
          {isStreaming && <span className={styles.briefCursor}>▍</span>}
        </pre>
      )}
    </div>
  )
}
