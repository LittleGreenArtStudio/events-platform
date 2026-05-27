"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { draftSuppliesWithAI, saveSupplySuggestions } from "../../actions"
import type { AISuggestion } from "../../actions"
import styles from "../../crafts.module.css"

type EditRow = { qty: string; cost: string; selected: boolean }
type Status = "idle" | "loading" | "review" | "saving" | "saved" | "error"

export default function AIDraftPanel({
  craftId,
  craftName,
  category,
}: {
  craftId: string
  craftName: string
  category: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>("idle")
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [edits, setEdits] = useState<EditRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [, startDraftTransition] = useTransition()
  const [, startSaveTransition] = useTransition()

  const handleDraft = () => {
    setError(null)
    setStatus("loading")
    startDraftTransition(async () => {
      const res = await draftSuppliesWithAI(craftName, category)
      if ("error" in res) {
        setError(res.error)
        setStatus("error")
      } else {
        setSuggestions(res.suggestions)
        setEdits(
          res.suggestions.map((s) => ({
            qty: s.qty_per_guest != null ? String(s.qty_per_guest) : "",
            cost: s.unit_cost != null ? String(s.unit_cost) : "",
            selected: true,
          }))
        )
        setStatus("review")
      }
    })
  }

  const updateEdit = (i: number, field: keyof EditRow, value: string | boolean) => {
    setEdits((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)))
  }

  const allSelected = edits.length > 0 && edits.every((e) => e.selected)
  const selectedCount = edits.filter((e) => e.selected).length

  const handleSave = (which: "all" | "selected") => {
    const toSave = suggestions
      .map((s, i) => ({ s, e: edits[i] }))
      .filter(({ e }) => which === "all" || e?.selected)
      .map(({ s, e }) => ({
        name: s.name,
        unit: s.unit,
        qty_per_guest: e?.qty ? parseFloat(e.qty) : null,
        unit_cost: e?.cost ? parseFloat(e.cost) : null,
      }))

    if (toSave.length === 0) return
    setStatus("saving")
    startSaveTransition(async () => {
      const res = await saveSupplySuggestions(craftId, toSave)
      if ("error" in res) {
        setError(res.error)
        setStatus("review")
      } else {
        setStatus("saved")
        router.refresh()
        setTimeout(() => setStatus("idle"), 2200)
      }
    })
  }

  if (status === "idle" || status === "error") {
    return (
      <div className={styles.aiDraftWrap}>
        <button className={styles.aiDraftBtn} onClick={handleDraft}>
          ✦ Draft Supplies with AI
        </button>
        {error && <p className={styles.aiError}>{error}</p>}
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className={styles.aiStatusRow}>
        <span className={styles.aiStatusText}>Asking Claude for supply suggestions…</span>
      </div>
    )
  }

  if (status === "saved") {
    return (
      <div className={styles.aiStatusRow}>
        <span className={styles.aiStatusText}>Supplies saved ✓</span>
      </div>
    )
  }

  return (
    <div className={styles.aiPanel}>
      <div className={styles.aiPanelHeader}>
        <div>
          <span className={styles.aiPanelTitle}>AI Supply Suggestions</span>
          <span className={styles.aiPanelHint}>
            {suggestions.length} suggestions — review and edit before saving
          </span>
        </div>
        <button
          className={styles.aiPanelClose}
          onClick={() => setStatus("idle")}
          disabled={status === "saving"}
        >
          ✕
        </button>
      </div>

      <div className={styles.aiPanelBody}>
        <div className={styles.aiSelectAllRow}>
          <input
            type="checkbox"
            id="ai-select-all"
            checked={allSelected}
            onChange={(e) =>
              setEdits((prev) => prev.map((row) => ({ ...row, selected: e.target.checked })))
            }
          />
          <label htmlFor="ai-select-all" className={styles.aiSelectAllLabel}>
            Select all
          </label>
        </div>

        {suggestions.map((s, i) => (
          <div
            key={i}
            className={`${styles.aiSuggestionRow} ${!edits[i]?.selected ? styles.aiRowDeselected : ""}`}
          >
            <input
              type="checkbox"
              className={styles.aiCheckbox}
              checked={edits[i]?.selected ?? true}
              onChange={(e) => updateEdit(i, "selected", e.target.checked)}
            />
            <div className={styles.aiSuggestionMain}>
              <span className={styles.aiSuggestionName}>{s.name}</span>
              <span className={styles.aiSuggestionUnit}>{s.unit}</span>
              {s.vendor_suggestion && (
                <span className={styles.aiSuggestionVendor}>{s.vendor_suggestion}</span>
              )}
            </div>
            <div className={styles.aiSuggestionFields}>
              <div className={styles.aiField}>
                <label className={styles.aiFieldLabel}>Qty / guest</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={styles.aiFieldInput}
                  value={edits[i]?.qty ?? ""}
                  onChange={(e) => updateEdit(i, "qty", e.target.value)}
                />
              </div>
              <div className={styles.aiField}>
                <label className={styles.aiFieldLabel}>Unit cost $</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={styles.aiFieldInput}
                  value={edits[i]?.cost ?? ""}
                  onChange={(e) => updateEdit(i, "cost", e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className={styles.aiError} style={{ padding: "8px 16px", margin: 0 }}>{error}</p>}

      <div className={styles.aiPanelActions}>
        <button
          className={styles.aiSaveBtn}
          onClick={() => handleSave("selected")}
          disabled={selectedCount === 0 || status === "saving"}
        >
          {status === "saving" ? "Saving…" : `Save Selected (${selectedCount})`}
        </button>
        <button
          className={styles.aiSaveAllBtn}
          onClick={() => handleSave("all")}
          disabled={status === "saving"}
        >
          Save All ({suggestions.length})
        </button>
        <button
          className={styles.aiDismissBtn}
          onClick={() => setStatus("idle")}
          disabled={status === "saving"}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
