"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { addExistingSupply, createAndAddSupply } from "../../actions"
import styles from "../../crafts.module.css"

type Supply = { id: string; name: string; unit: string | null; unit_cost: number | null }
type Vendor = { id: string; name: string }

export default function AddSupplyForm({
  craftId,
  allSupplies,
  allVendors,
  existingSupplyIds,
}: {
  craftId: string
  allSupplies: Supply[]
  allVendors: Vendor[]
  existingSupplyIds: string[]
}) {
  const router = useRouter()
  const existingSet = new Set(existingSupplyIds)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [error, setError] = useState<string | null>(null)

  // Existing supply state
  const [selectedSupplyId, setSelectedSupplyId] = useState("")
  const [qty, setQty] = useState("")

  // New supply state
  const [newName, setNewName] = useState("")
  const [newUnit, setNewUnit] = useState("")
  const [newCost, setNewCost] = useState("")
  const [newVendorId, setNewVendorId] = useState("")
  const [newQty, setNewQty] = useState("")

  const [isPending, startTransition] = useTransition()

  const availableSupplies = allSupplies.filter((s) => !existingSet.has(s.id))

  const close = () => {
    setOpen(false)
    setError(null)
    setSelectedSupplyId("")
    setQty("")
  }

  const handleAddExisting = () => {
    if (!selectedSupplyId || !qty) return
    setError(null)
    startTransition(async () => {
      const res = await addExistingSupply(craftId, selectedSupplyId, qty)
      if ("error" in res) {
        setError(res.error)
      } else {
        close()
        router.refresh()
      }
    })
  }

  const handleCreateNew = () => {
    if (!newName || !newQty) return
    setError(null)
    const fd = new FormData()
    fd.set("name", newName)
    fd.set("unit", newUnit)
    fd.set("unit_cost", newCost)
    fd.set("vendor_id", newVendorId)
    fd.set("qty_per_guest", newQty)
    startTransition(async () => {
      const res = await createAndAddSupply(craftId, fd)
      if ("error" in res) {
        setError(res.error)
      } else {
        setOpen(false)
        setError(null)
        setNewName(""); setNewUnit(""); setNewCost(""); setNewVendorId(""); setNewQty("")
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <button className={styles.addSupplyBtn} onClick={() => setOpen(true)}>
        + Add Supply
      </button>
    )
  }

  return (
    <div className={styles.addSupplyPanel}>
      <div className={styles.addSupplyTabs}>
        <button
          className={`${styles.addSupplyTab} ${mode === "existing" ? styles.addSupplyTabActive : ""}`}
          onClick={() => { setMode("existing"); setError(null) }}
        >
          Existing Supply
        </button>
        <button
          className={`${styles.addSupplyTab} ${mode === "new" ? styles.addSupplyTabActive : ""}`}
          onClick={() => { setMode("new"); setError(null) }}
        >
          New Supply
        </button>
        <button className={styles.addSupplyClose} onClick={close}>✕</button>
      </div>

      {error && <p className={styles.panelError}>{error}</p>}

      {mode === "existing" && (
        <div className={styles.panelForm}>
          {availableSupplies.length === 0 ? (
            <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 15, color: "var(--muted-2)", margin: "0 0 12px" }}>
              All supplies in the library are already attached to this craft.
              Switch to &ldquo;New Supply&rdquo; to create one.
            </p>
          ) : (
            <>
              <div className={styles.panelField}>
                <label className={styles.panelLabel}>Supply</label>
                <select
                  className={styles.panelSelect}
                  value={selectedSupplyId}
                  onChange={(e) => setSelectedSupplyId(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {availableSupplies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.unit ? ` (${s.unit})` : ""}
                      {s.unit_cost != null ? ` · $${s.unit_cost}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.panelField}>
                <label className={styles.panelLabel}>Qty per Guest</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={styles.panelInput}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
              <div className={styles.panelActions}>
                <button
                  className={styles.panelSubmitBtn}
                  onClick={handleAddExisting}
                  disabled={!selectedSupplyId || !qty || isPending}
                >
                  {isPending ? "Adding…" : "Add"}
                </button>
                <button className={styles.panelCancelBtn} onClick={close}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === "new" && (
        <div className={styles.panelForm}>
          <div className={styles.panelRow}>
            <div className={styles.panelField}>
              <label className={styles.panelLabel}>Name</label>
              <input
                type="text"
                className={styles.panelInput}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Supply name"
              />
            </div>
            <div className={styles.panelField}>
              <label className={styles.panelLabel}>Unit</label>
              <input
                type="text"
                className={styles.panelInput}
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="e.g. sheet, each"
              />
            </div>
          </div>
          <div className={styles.panelRow}>
            <div className={styles.panelField}>
              <label className={styles.panelLabel}>Unit Cost ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={styles.panelInput}
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className={styles.panelField}>
              <label className={styles.panelLabel}>Qty per Guest</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={styles.panelInput}
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>
          </div>
          <div className={styles.panelField}>
            <label className={styles.panelLabel}>
              Vendor <span className={styles.panelOptional}>(optional)</span>
            </label>
            <select
              className={styles.panelSelect}
              value={newVendorId}
              onChange={(e) => setNewVendorId(e.target.value)}
            >
              <option value="">— None —</option>
              {allVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.panelActions}>
            <button
              className={styles.panelSubmitBtn}
              onClick={handleCreateNew}
              disabled={!newName || !newQty || isPending}
            >
              {isPending ? "Creating…" : "Create & Add"}
            </button>
            <button className={styles.panelCancelBtn} onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
