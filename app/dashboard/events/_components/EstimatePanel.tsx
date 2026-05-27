"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveEstimate, updateEstimateStatus } from "../estimate-actions"
import type { SaveEstimatePayload } from "../estimate-actions"
import styles from "../folder.module.css"

// ── Types ─────────────────────────────────────────────────────────────────

type MaterialLine = {
  id: string
  description: string
  unit: string
  unitCost: number
  qty: number
  total: number
  isAuto: boolean
  baseQtyPerGuest?: number
  supplyId?: string
}

type StaffLine = {
  id: string
  name: string
  role: string
  hours: number
  rate: number
  total: number
  staffId?: string
  isAuto: boolean
}

type TravelLine = {
  id: string
  description: string
  amount: number
}

type AddonLine = {
  id: string
  description: string
  qty: number
  unitPrice: number
  total: number
}

type EventCraftForEstimate = {
  guest_count_override: number | null
  crafts: {
    name: string
    craft_supplies: {
      qty_per_guest: number | null
      supplies: { id: string; name: string; unit: string | null; unit_cost: number | null } | null
    }[]
  } | null
}

type EventStaffForEstimate = {
  staff: {
    id: string
    first_name: string | null
    last_name: string | null
    role_title: string | null
    hourly_rate: number | null
  } | null
}

type SavedEstimate = {
  id: string
  status: string
  pricing_mode: string
  per_guest_price: number | null
  materials_lines: MaterialLine[]
  staff_lines: StaffLine[]
  travel_lines: TravelLine[]
  addon_lines: AddonLine[]
  markup_pct: number
  client_total: number
  tax_rate: number
  deposit_pct: number
  client_notes: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────

let _uid = 0
const uid = () => `e-${++_uid}`

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

function autoMaterials(
  crafts: EventCraftForEstimate[],
  guestCount: number,
  bufferPct: number
): MaterialLine[] {
  const map = new Map<string, MaterialLine>()
  for (const ec of crafts) {
    const guests = ec.guest_count_override ?? guestCount
    for (const cs of ec.crafts?.craft_supplies ?? []) {
      const s = cs.supplies
      if (!s) continue
      const baseQtyPerGuest = cs.qty_per_guest ?? 0
      const qty = Math.ceil(baseQtyPerGuest * guests * (1 + bufferPct / 100))
      const unitCost = s.unit_cost ?? 0
      const existing = map.get(s.id)
      if (existing) {
        existing.qty += qty
        existing.total += qty * unitCost
      } else {
        map.set(s.id, {
          id: uid(),
          description: s.name,
          unit: s.unit ?? "",
          unitCost,
          qty,
          total: qty * unitCost,
          isAuto: true,
          baseQtyPerGuest,
          supplyId: s.id,
        })
      }
    }
  }
  return Array.from(map.values())
}

function autoStaff(eventStaff: EventStaffForEstimate[]): StaffLine[] {
  return eventStaff
    .filter((es) => es.staff)
    .map((es) => {
      const s = es.staff!
      const hours = 4
      const rate = s.hourly_rate ?? 0
      return {
        id: uid(),
        name: [s.first_name, s.last_name].filter(Boolean).join(" "),
        role: s.role_title ?? "",
        hours,
        rate,
        total: hours * rate,
        staffId: s.id,
        isAuto: true,
      }
    })
}

// ── Sub-components ────────────────────────────────────────────────────────

function Section({
  title,
  subtotal,
  children,
}: {
  title: string
  subtotal: number
  children: React.ReactNode
}) {
  return (
    <div className={styles.estSection}>
      <div className={styles.estSectionHeader}>
        <span className={styles.estSectionTitle}>{title}</span>
        <span className={styles.estSectionSubtotal}>{fmt(subtotal)}</span>
      </div>
      {children}
    </div>
  )
}

function ShoppingListPanel({
  lines,
  purchaseUrls,
  onUrlChange,
}: {
  lines: MaterialLine[]
  purchaseUrls: Record<string, string>
  onUrlChange: (id: string, url: string) => void
}) {
  const total = lines.reduce((s, l) => s + l.total, 0)
  return (
    <div className={styles.estShoppingList}>
      <div className={styles.estShoppingTitle}>Shopping List</div>
      <table className={styles.estTable}>
        <thead>
          <tr className={styles.estTableHead}>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Cost</th>
            <th>Est. Total</th>
            <th>Purchase URL</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className={styles.estRow}>
              <td className={styles.estRowDesc}>{line.description}</td>
              <td className={styles.estRowNum}>
                {line.qty} {line.unit}
              </td>
              <td className={styles.estRowNum}>{fmt(line.unitCost)}</td>
              <td className={styles.estRowTotal}>{fmt(line.total)}</td>
              <td>
                <input
                  type="url"
                  placeholder="https://…"
                  className={`${styles.addInput} ${styles.estUrlInput}`}
                  value={purchaseUrls[line.id] ?? ""}
                  onChange={(e) => onUrlChange(line.id, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={styles.estTotalRow}>
            <td colSpan={3} className={styles.estTotalLabel}>
              Total estimated spend
            </td>
            <td className={styles.estRowTotal}>{fmt(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <div style={{ marginTop: 12 }}>
        <button className={styles.estimateActionBtn} onClick={() => window.print()}>
          Print Shopping List
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export default function EstimatePanel({
  eventKind,
  eventId,
  estimate,
  eventCrafts,
  eventStaff,
  guestCount,
  isOffsite,
  clientName,
  eventTitle,
  eventDate,
  venueAddress,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  estimate: SavedEstimate | null
  eventCrafts: EventCraftForEstimate[]
  eventStaff: EventStaffForEstimate[]
  guestCount: number | null
  isOffsite: boolean
  clientName: string
  eventTitle: string
  eventDate: string
  venueAddress: string | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const gc = guestCount ?? 0

  // ── View ──────────────────────────────────────────────
  const [view, setView] = useState<"victoria" | "client">("victoria")

  // ── Estimate metadata ─────────────────────────────────
  const [estimateId, setEstimateId] = useState<string | null>(estimate?.id ?? null)
  const [status, setStatus] = useState(estimate?.status ?? "draft")

  // ── Pricing controls ──────────────────────────────────
  const [pricingMode, setPricingMode] = useState<"custom" | "per_guest">(
    (estimate?.pricing_mode as "custom" | "per_guest") ?? "custom"
  )
  const [perGuestPrice, setPerGuestPrice] = useState(
    estimate?.per_guest_price?.toString() ?? ""
  )
  const [markupPct, setMarkupPct] = useState(estimate?.markup_pct?.toString() ?? "30")
  const [taxRate, setTaxRate] = useState(estimate?.tax_rate?.toString() ?? "0")
  const [depositPct, setDepositPct] = useState(estimate?.deposit_pct?.toString() ?? "50")
  const [clientNotes, setClientNotes] = useState(estimate?.client_notes ?? "")

  // ── Buffer ────────────────────────────────────────────
  const [bufferPct, setBufferPct] = useState(15)

  // ── Line items ────────────────────────────────────────
  const [materialLines, setMaterialLines] = useState<MaterialLine[]>(() =>
    estimate?.materials_lines?.length
      ? (estimate.materials_lines as MaterialLine[])
      : autoMaterials(eventCrafts, gc, 15)
  )
  const [staffLines, setStaffLines] = useState<StaffLine[]>(() =>
    estimate?.staff_lines?.length
      ? (estimate.staff_lines as StaffLine[])
      : autoStaff(eventStaff)
  )
  const [travelMiles, setTravelMiles] = useState("0")
  const [travelRate, setTravelRate] = useState("0.70")
  const [travelOtherLines, setTravelOtherLines] = useState<TravelLine[]>(
    () => (estimate?.travel_lines as TravelLine[]) ?? []
  )
  const [addonLines, setAddonLines] = useState<AddonLine[]>(
    () => (estimate?.addon_lines as AddonLine[]) ?? []
  )

  // ── Add-row state ─────────────────────────────────────
  const [addMatDesc, setAddMatDesc] = useState("")
  const [addMatUnit, setAddMatUnit] = useState("")
  const [addMatQty, setAddMatQty] = useState("")
  const [addMatCost, setAddMatCost] = useState("")

  const [addStaffName, setAddStaffName] = useState("")
  const [addStaffRole, setAddStaffRole] = useState("")
  const [addStaffHours, setAddStaffHours] = useState("")
  const [addStaffRate, setAddStaffRate] = useState("")

  const [addTravelDesc, setAddTravelDesc] = useState("")
  const [addTravelAmt, setAddTravelAmt] = useState("")

  const [addAddonDesc, setAddAddonDesc] = useState("")
  const [addAddonQty, setAddAddonQty] = useState("")
  const [addAddonPrice, setAddAddonPrice] = useState("")

  // ── Shopping list ─────────────────────────────────────
  const [purchaseUrls, setPurchaseUrls] = useState<Record<string, string>>({})
  const [showShoppingList, setShowShoppingList] = useState(false)

  // ── Save state ────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Computed ──────────────────────────────────────────
  const materialsTotal = materialLines.reduce((s, l) => s + l.total, 0)
  const staffTotal = staffLines.reduce((s, l) => s + l.total, 0)
  const milesNum = parseFloat(travelMiles) || 0
  const rateNum = parseFloat(travelRate) || 0.7
  const travelMileageCost = milesNum * rateNum
  const travelOtherTotal = travelOtherLines.reduce((s, l) => s + l.amount, 0)
  const travelTotal = travelMileageCost + travelOtherTotal
  const addonsTotal = addonLines.reduce((s, l) => s + l.total, 0)
  const totalCost =
    materialsTotal + staffTotal + (isOffsite ? travelTotal : 0) + addonsTotal

  const markupNum = parseFloat(markupPct) || 0
  const perGuestNum = parseFloat(perGuestPrice) || 0
  const taxNum = parseFloat(taxRate) || 0
  const depositPctNum = parseFloat(depositPct) || 50

  const clientTotal =
    pricingMode === "per_guest" && perGuestNum > 0
      ? perGuestNum * gc
      : totalCost * (1 + markupNum / 100)
  const profit = clientTotal - totalCost
  const backCalcMarkup = totalCost > 0 ? ((clientTotal / totalCost - 1) * 100) : 0
  const taxAmount = clientTotal * (taxNum / 100)
  const grandTotal = clientTotal + taxAmount
  const depositAmount = grandTotal * (depositPctNum / 100)
  const balance = grandTotal - depositAmount

  // Proportional markup distribution for client view — each section shows
  // its share of clientTotal so no overhead line is visible to the client.
  const markupRatio = totalCost > 0 ? clientTotal / totalCost : 1
  const clientMatAmt  = materialsTotal * markupRatio
  const clientStaffAmt = staffTotal * markupRatio
  const clientTravelAmt = (isOffsite ? travelTotal : 0) * markupRatio
  const clientAddonsAmt = addonsTotal * markupRatio

  // ── Date formatting ───────────────────────────────────
  const [yr, mo, dy] = eventDate.split("-").map(Number)
  const formattedDate = new Date(yr, mo - 1, dy).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  // ── Handlers ──────────────────────────────────────────

  const handleBufferChange = (val: number) => {
    setBufferPct(val)
    setMaterialLines((prev) =>
      prev.map((l) => {
        if (!l.isAuto || !l.baseQtyPerGuest) return l
        const qty = Math.ceil(l.baseQtyPerGuest * gc * (1 + val / 100))
        return { ...l, qty, total: qty * l.unitCost }
      })
    )
  }

  // Re-runs autoMaterials from current event craft data, preserving any
  // manually-added lines. Fixes stale materials when crafts are added/removed
  // after an estimate was first saved.
  const handleRefreshMaterials = () => {
    const fresh = autoMaterials(eventCrafts, gc, bufferPct)
    setMaterialLines((prev) => {
      const custom = prev.filter((l) => !l.isAuto)
      return [...fresh, ...custom]
    })
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)

    const travelLinesToSave: TravelLine[] = []
    if (isOffsite && milesNum > 0) {
      travelLinesToSave.push({
        id: "mileage",
        description: `Mileage (${milesNum} mi @ $${rateNum}/mi)`,
        amount: travelMileageCost,
      })
    }
    travelLinesToSave.push(...travelOtherLines)

    const payload: SaveEstimatePayload = {
      estimateId,
      pricingMode,
      perGuestPrice: pricingMode === "per_guest" ? perGuestNum : null,
      materialsLines: materialLines,
      staffLines,
      travelLines: travelLinesToSave,
      addonLines,
      materialsSubtotal: materialsTotal,
      staffSubtotal: staffTotal,
      travelSubtotal: isOffsite ? travelTotal : 0,
      addonSubtotal: addonsTotal,
      totalCost,
      markupPct: markupNum,
      clientTotal,
      taxRate: taxNum,
      taxAmount,
      depositPct: depositPctNum,
      depositAmount,
      balanceDue: balance,
      clientNotes,
    }

    const res = await saveEstimate(eventKind, eventId, payload)
    setSaving(false)
    if ("error" in res) {
      setError(res.error)
    } else {
      setEstimateId(res.id)
      setSaved(true)
      router.refresh()
    }
  }

  const handleStatusUpdate = (newStatus: string) => {
    if (!estimateId) return
    setError(null)
    startTransition(async () => {
      const res = await updateEstimateStatus(eventKind, eventId, estimateId, newStatus)
      if ("error" in res) {
        setError(res.error)
      } else {
        setStatus(newStatus)
        router.refresh()
      }
    })
  }

  // Material handlers
  const addMat = () => {
    if (!addMatDesc.trim()) return
    const qty = parseFloat(addMatQty) || 1
    const unitCost = parseFloat(addMatCost) || 0
    setMaterialLines((p) => [
      ...p,
      { id: uid(), description: addMatDesc.trim(), unit: addMatUnit.trim(), unitCost, qty, total: qty * unitCost, isAuto: false },
    ])
    setAddMatDesc(""); setAddMatUnit(""); setAddMatQty(""); setAddMatCost("")
  }
  const removeMat = (id: string) => setMaterialLines((p) => p.filter((l) => l.id !== id))
  const updateMat = (id: string, field: "qty" | "unitCost", raw: string) => {
    setMaterialLines((p) =>
      p.map((l) => {
        if (l.id !== id) return l
        const updated = { ...l, [field]: parseFloat(raw) || 0 }
        updated.total = updated.qty * updated.unitCost
        return updated
      })
    )
  }

  // Staff handlers
  const addStaff = () => {
    if (!addStaffName.trim()) return
    const hours = parseFloat(addStaffHours) || 0
    const rate = parseFloat(addStaffRate) || 0
    setStaffLines((p) => [
      ...p,
      { id: uid(), name: addStaffName.trim(), role: addStaffRole.trim(), hours, rate, total: hours * rate, isAuto: false },
    ])
    setAddStaffName(""); setAddStaffRole(""); setAddStaffHours(""); setAddStaffRate("")
  }
  const removeStaff = (id: string) => setStaffLines((p) => p.filter((l) => l.id !== id))
  const updateStaff = (id: string, field: "hours" | "rate", raw: string) => {
    setStaffLines((p) =>
      p.map((l) => {
        if (l.id !== id) return l
        const updated = { ...l, [field]: parseFloat(raw) || 0 }
        updated.total = updated.hours * updated.rate
        return updated
      })
    )
  }

  // Travel handlers
  const addTravel = () => {
    if (!addTravelDesc.trim()) return
    setTravelOtherLines((p) => [
      ...p,
      { id: uid(), description: addTravelDesc.trim(), amount: parseFloat(addTravelAmt) || 0 },
    ])
    setAddTravelDesc(""); setAddTravelAmt("")
  }
  const removeTravel = (id: string) => setTravelOtherLines((p) => p.filter((l) => l.id !== id))

  // Addon handlers
  const addAddon = () => {
    if (!addAddonDesc.trim()) return
    const qty = parseFloat(addAddonQty) || 1
    const unitPrice = parseFloat(addAddonPrice) || 0
    setAddonLines((p) => [
      ...p,
      { id: uid(), description: addAddonDesc.trim(), qty, unitPrice, total: qty * unitPrice },
    ])
    setAddAddonDesc(""); setAddAddonQty(""); setAddAddonPrice("")
  }
  const removeAddon = (id: string) => setAddonLines((p) => p.filter((l) => l.id !== id))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── View Toggle + Action Bar ── */}
      <div className={styles.estTopBar}>
        <div className={styles.estViewToggle}>
          <button
            className={`${styles.estViewBtn} ${view === "victoria" ? styles.estViewBtnActive : ""}`}
            onClick={() => setView("victoria")}
          >
            Victoria&apos;s View
          </button>
          <button
            className={`${styles.estViewBtn} ${view === "client" ? styles.estViewBtnActive : ""}`}
            onClick={() => setView("client")}
          >
            Client View
          </button>
        </div>

        <div className={styles.estActions}>
          <span className={`${styles.estStatusPill} ${styles[`estStatus_${status}`]}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          <button className={styles.estimateActionBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Draft"}
          </button>
          {estimateId && status === "draft" && (
            <button className={styles.estimateActionBtn} onClick={() => handleStatusUpdate("sent")}>
              Mark Sent
            </button>
          )}
          {estimateId && status === "sent" && (
            <button
              className={`${styles.estimateActionBtn} ${styles.estimateActionBtnAccept}`}
              onClick={() => handleStatusUpdate("accepted")}
            >
              Mark Accepted
            </button>
          )}
          <button
            className={styles.estimateActionBtn}
            onClick={() => setShowShoppingList((v) => !v)}
          >
            {showShoppingList ? "Hide List" : "Shopping List"}
          </button>
          {view === "client" && (
            <button className={styles.estimateActionBtn} onClick={() => window.print()}>
              Print / PDF
            </button>
          )}
        </div>
      </div>

      {error && <p className={styles.addError} style={{ marginBottom: 12 }}>{error}</p>}

      {/* ── Shopping List ── */}
      {showShoppingList && (
        <ShoppingListPanel
          lines={materialLines}
          purchaseUrls={purchaseUrls}
          onUrlChange={(id, url) => setPurchaseUrls((prev) => ({ ...prev, [id]: url }))}
        />
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── VICTORIA'S VIEW ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === "victoria" && (
        <div className={styles.estBuilder}>

          {/* 1. Materials */}
          <Section title="Materials" subtotal={materialsTotal}>
            <div className={styles.estBufferRow}>
              <span className={styles.estFieldLabel}>Buffer %</span>
              <input
                type="number"
                className={styles.estSmallInput}
                value={bufferPct}
                min={0}
                max={100}
                onChange={(e) => handleBufferChange(parseFloat(e.target.value) || 0)}
              />
              <span className={styles.estFieldLabel} style={{ marginLeft: 4 }}>
                (applied to auto-populated quantities)
              </span>
              <button
                className={styles.estRefreshBtn}
                onClick={handleRefreshMaterials}
                title="Re-pull all supplies from event crafts"
              >
                ↺ Refresh from crafts
              </button>
            </div>

            <table className={styles.estTable}>
              <thead>
                <tr className={styles.estTableHead}>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Unit Cost</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {materialLines.map((l) => (
                  <tr key={l.id} className={styles.estRow}>
                    <td className={styles.estRowDesc}>{l.description}</td>
                    <td className={styles.estRowNum}>{l.unit}</td>
                    <td className={styles.estRowNum}>
                      <input
                        type="number"
                        className={styles.estInlineInput}
                        value={l.qty}
                        min={0}
                        onChange={(e) => updateMat(l.id, "qty", e.target.value)}
                      />
                    </td>
                    <td className={styles.estRowNum}>
                      <input
                        type="number"
                        className={styles.estInlineInput}
                        value={l.unitCost}
                        min={0}
                        step="0.01"
                        onChange={(e) => updateMat(l.id, "unitCost", e.target.value)}
                      />
                    </td>
                    <td className={styles.estRowTotal}>{fmt(l.total)}</td>
                    <td>
                      <button className={styles.removeBtn} onClick={() => removeMat(l.id)}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.estAddRow}>
              <input
                placeholder="Description"
                className={styles.addInput}
                style={{ flex: 2 }}
                value={addMatDesc}
                onChange={(e) => setAddMatDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMat()}
              />
              <input
                placeholder="Unit"
                className={styles.addInput}
                style={{ width: 70 }}
                value={addMatUnit}
                onChange={(e) => setAddMatUnit(e.target.value)}
              />
              <input
                type="number"
                placeholder="Qty"
                className={styles.addInput}
                style={{ width: 70 }}
                value={addMatQty}
                onChange={(e) => setAddMatQty(e.target.value)}
              />
              <input
                type="number"
                placeholder="$/unit"
                className={styles.addInput}
                style={{ width: 90 }}
                value={addMatCost}
                onChange={(e) => setAddMatCost(e.target.value)}
              />
              <button className={styles.addSubmitBtn} onClick={addMat}>
                Add
              </button>
            </div>
          </Section>

          {/* 2. Staff */}
          <Section title="Staff" subtotal={staffTotal}>
            <table className={styles.estTable}>
              <thead>
                <tr className={styles.estTableHead}>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Hours</th>
                  <th>Rate</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staffLines.map((l) => (
                  <tr key={l.id} className={styles.estRow}>
                    <td className={styles.estRowDesc}>{l.name}</td>
                    <td className={styles.estRowNum}>{l.role}</td>
                    <td className={styles.estRowNum}>
                      <input
                        type="number"
                        className={styles.estInlineInput}
                        value={l.hours}
                        min={0}
                        step="0.5"
                        onChange={(e) => updateStaff(l.id, "hours", e.target.value)}
                      />
                    </td>
                    <td className={styles.estRowNum}>
                      <input
                        type="number"
                        className={styles.estInlineInput}
                        value={l.rate}
                        min={0}
                        step="0.01"
                        onChange={(e) => updateStaff(l.id, "rate", e.target.value)}
                      />
                    </td>
                    <td className={styles.estRowTotal}>{fmt(l.total)}</td>
                    <td>
                      <button className={styles.removeBtn} onClick={() => removeStaff(l.id)}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.estAddRow}>
              <input
                placeholder="Name"
                className={styles.addInput}
                style={{ flex: 2 }}
                value={addStaffName}
                onChange={(e) => setAddStaffName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStaff()}
              />
              <input
                placeholder="Role"
                className={styles.addInput}
                style={{ flex: 1 }}
                value={addStaffRole}
                onChange={(e) => setAddStaffRole(e.target.value)}
              />
              <input
                type="number"
                placeholder="Hours"
                className={styles.addInput}
                style={{ width: 80 }}
                value={addStaffHours}
                onChange={(e) => setAddStaffHours(e.target.value)}
              />
              <input
                type="number"
                placeholder="$/hr"
                className={styles.addInput}
                style={{ width: 80 }}
                value={addStaffRate}
                onChange={(e) => setAddStaffRate(e.target.value)}
              />
              <button className={styles.addSubmitBtn} onClick={addStaff}>
                Add
              </button>
            </div>
          </Section>

          {/* 3. Travel (offsite only) */}
          {isOffsite && (
            <Section title="Travel" subtotal={travelTotal}>
              <div className={styles.estTravelMiles}>
                <span className={styles.estFieldLabel}>Miles to venue</span>
                <input
                  type="number"
                  className={styles.estSmallInput}
                  value={travelMiles}
                  min={0}
                  onChange={(e) => setTravelMiles(e.target.value)}
                />
                <span className={styles.estFieldLabel}>× $</span>
                <input
                  type="number"
                  className={styles.estSmallInput}
                  value={travelRate}
                  min={0}
                  step="0.01"
                  onChange={(e) => setTravelRate(e.target.value)}
                />
                <span className={styles.estFieldLabel}>/mi</span>
                <span className={styles.estTravelCost}>{fmt(travelMileageCost)}</span>
              </div>

              {travelOtherLines.length > 0 && (
                <table className={styles.estTable} style={{ marginTop: 8 }}>
                  <tbody>
                    {travelOtherLines.map((l) => (
                      <tr key={l.id} className={styles.estRow}>
                        <td className={styles.estRowDesc}>{l.description}</td>
                        <td /><td /><td />
                        <td className={styles.estRowTotal}>{fmt(l.amount)}</td>
                        <td>
                          <button className={styles.removeBtn} onClick={() => removeTravel(l.id)}>
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className={styles.estAddRow}>
                <input
                  placeholder="Parking, tolls, etc."
                  className={styles.addInput}
                  style={{ flex: 2 }}
                  value={addTravelDesc}
                  onChange={(e) => setAddTravelDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTravel()}
                />
                <input
                  type="number"
                  placeholder="Amount"
                  className={styles.addInput}
                  style={{ width: 100 }}
                  value={addTravelAmt}
                  onChange={(e) => setAddTravelAmt(e.target.value)}
                />
                <button className={styles.addSubmitBtn} onClick={addTravel}>
                  Add
                </button>
              </div>
            </Section>
          )}

          {/* 4. Add-Ons */}
          <Section title="Add-Ons" subtotal={addonsTotal}>
            {addonLines.length > 0 && (
              <table className={styles.estTable}>
                <thead>
                  <tr className={styles.estTableHead}>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {addonLines.map((l) => (
                    <tr key={l.id} className={styles.estRow}>
                      <td className={styles.estRowDesc}>{l.description}</td>
                      <td className={styles.estRowNum}>{l.qty}</td>
                      <td className={styles.estRowNum}>{fmt(l.unitPrice)}</td>
                      <td className={styles.estRowTotal}>{fmt(l.total)}</td>
                      <td>
                        <button className={styles.removeBtn} onClick={() => removeAddon(l.id)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className={styles.estAddRow}>
              <input
                placeholder="Description (setup fee, custom design, gratuity…)"
                className={styles.addInput}
                style={{ flex: 2 }}
                value={addAddonDesc}
                onChange={(e) => setAddAddonDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAddon()}
              />
              <input
                type="number"
                placeholder="Qty"
                className={styles.addInput}
                style={{ width: 70 }}
                value={addAddonQty}
                onChange={(e) => setAddAddonQty(e.target.value)}
              />
              <input
                type="number"
                placeholder="Unit price"
                className={styles.addInput}
                style={{ width: 100 }}
                value={addAddonPrice}
                onChange={(e) => setAddAddonPrice(e.target.value)}
              />
              <button className={styles.addSubmitBtn} onClick={addAddon}>
                Add
              </button>
            </div>
          </Section>

          {/* ── Margin & Pricing ── */}
          <div className={styles.estMargin}>
            <div className={styles.estMarginTitle}>Margin &amp; Pricing</div>
            <div className={styles.estMarginGrid}>

              {/* Cost breakdown */}
              <div className={styles.estCostBreakdown}>
                <div className={styles.estCostRow}>
                  <span>Materials</span>
                  <span>{fmt(materialsTotal)}</span>
                </div>
                <div className={styles.estCostRow}>
                  <span>Staff</span>
                  <span>{fmt(staffTotal)}</span>
                </div>
                {isOffsite && (
                  <div className={styles.estCostRow}>
                    <span>Travel</span>
                    <span>{fmt(travelTotal)}</span>
                  </div>
                )}
                {addonsTotal > 0 && (
                  <div className={styles.estCostRow}>
                    <span>Add-Ons</span>
                    <span>{fmt(addonsTotal)}</span>
                  </div>
                )}
                <div className={`${styles.estCostRow} ${styles.estCostTotalRow}`}>
                  <span>Total Cost</span>
                  <span>{fmt(totalCost)}</span>
                </div>
              </div>

              {/* Pricing panel */}
              <div className={styles.estPricingPanel}>
                <div className={styles.estModeToggle}>
                  <button
                    className={`${styles.estModeBtn} ${pricingMode === "custom" ? styles.estModeBtnActive : ""}`}
                    onClick={() => setPricingMode("custom")}
                  >
                    Markup %
                  </button>
                  <button
                    className={`${styles.estModeBtn} ${pricingMode === "per_guest" ? styles.estModeBtnActive : ""}`}
                    onClick={() => setPricingMode("per_guest")}
                  >
                    Per Guest
                  </button>
                </div>

                {pricingMode === "custom" ? (
                  <div className={styles.estPricingField}>
                    <label className={styles.estFieldLabel}>Markup %</label>
                    <input
                      type="number"
                      className={styles.estSmallInput}
                      value={markupPct}
                      min={0}
                      onChange={(e) => { setMarkupPct(e.target.value); setSaved(false) }}
                    />
                  </div>
                ) : (
                  <div className={styles.estPricingField}>
                    <label className={styles.estFieldLabel}>Price per guest</label>
                    <input
                      type="number"
                      className={styles.estSmallInput}
                      value={perGuestPrice}
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      onChange={(e) => { setPerGuestPrice(e.target.value); setSaved(false) }}
                    />
                    {gc > 0 && <span className={styles.estFieldLabel}>× {gc} guests</span>}
                  </div>
                )}

                <div className={styles.estPricingResult}>
                  <div className={styles.estPricingRow}>
                    <span className={styles.estPricingLabel}>Client Price</span>
                    <span className={styles.estPricingValue}>{fmt(clientTotal)}</span>
                  </div>
                  <div className={styles.estPricingRow}>
                    <span className={styles.estPricingLabel}>Profit</span>
                    <span
                      className={`${styles.estPricingValue} ${profit >= 0 ? styles.estProfitPos : styles.estProfitNeg}`}
                    >
                      {fmt(profit)} ({backCalcMarkup.toFixed(1)}%)
                    </span>
                  </div>

                  <div className={styles.estPricingField} style={{ marginTop: 12 }}>
                    <label className={styles.estFieldLabel}>Tax %</label>
                    <input
                      type="number"
                      className={styles.estSmallInput}
                      value={taxRate}
                      min={0}
                      step="0.01"
                      onChange={(e) => { setTaxRate(e.target.value); setSaved(false) }}
                    />
                  </div>

                  <div className={`${styles.estPricingRow} ${styles.estGrandTotalRow}`}>
                    <span className={styles.estPricingLabel}>Grand Total</span>
                    <span className={styles.estPricingValue}>{fmt(grandTotal)}</span>
                  </div>

                  <div className={styles.estPricingField}>
                    <label className={styles.estFieldLabel}>Deposit %</label>
                    <input
                      type="number"
                      className={styles.estSmallInput}
                      value={depositPct}
                      min={0}
                      max={100}
                      onChange={(e) => { setDepositPct(e.target.value); setSaved(false) }}
                    />
                  </div>

                  <div className={styles.estPricingRow}>
                    <span className={styles.estPricingLabel}>Deposit due</span>
                    <span className={styles.estPricingValue}>{fmt(depositAmount)}</span>
                  </div>
                  <div className={styles.estPricingRow}>
                    <span className={styles.estPricingLabel}>Balance</span>
                    <span className={styles.estPricingValue}>{fmt(balance)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── CLIENT VIEW ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === "client" && (
        <div className={styles.estClientDoc}>
          {/* Header */}
          <div className={styles.estClientHeader}>
            <div>
              <div className={styles.estClientBrand}>Forager Crafts</div>
              <div className={styles.estClientContact}>info@foragercrafts.com</div>
            </div>
            <div className={styles.estClientDocLabel}>ESTIMATE</div>
          </div>

          <div className={styles.estClientRule} />

          {/* Event meta */}
          <div className={styles.estClientMeta}>
            <div className={styles.estClientMetaItem}>
              <span className={styles.estClientMetaLabel}>Client</span>
              <span className={styles.estClientMetaValue}>{clientName || "—"}</span>
            </div>
            <div className={styles.estClientMetaItem}>
              <span className={styles.estClientMetaLabel}>Event</span>
              <span className={styles.estClientMetaValue}>{eventTitle}</span>
            </div>
            <div className={styles.estClientMetaItem}>
              <span className={styles.estClientMetaLabel}>Date</span>
              <span className={styles.estClientMetaValue}>{formattedDate}</span>
            </div>
            {venueAddress && (
              <div className={styles.estClientMetaItem}>
                <span className={styles.estClientMetaLabel}>Location</span>
                <span className={styles.estClientMetaValue}>{venueAddress}</span>
              </div>
            )}
          </div>

          {/* Line items */}
          <table className={styles.estClientTable}>
            <thead>
              <tr className={styles.estClientTableHead}>
                <th>Service</th>
                <th className={styles.estClientAmtHead}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className={styles.estClientRow}>
                <td className={styles.estClientRowDesc}>
                  <span className={styles.estClientRowName}>Materials &amp; Supplies</span>
                </td>
                <td className={styles.estClientRowAmt}>{fmt(clientMatAmt)}</td>
              </tr>
              <tr className={styles.estClientRow}>
                <td className={styles.estClientRowDesc}>
                  <span className={styles.estClientRowName}>Instruction &amp; Staff</span>
                </td>
                <td className={styles.estClientRowAmt}>{fmt(clientStaffAmt)}</td>
              </tr>
              {isOffsite && clientTravelAmt > 0 && (
                <tr className={styles.estClientRow}>
                  <td className={styles.estClientRowDesc}>
                    <span className={styles.estClientRowName}>Travel</span>
                  </td>
                  <td className={styles.estClientRowAmt}>{fmt(clientTravelAmt)}</td>
                </tr>
              )}
              {addonsTotal > 0 && (
                <tr className={styles.estClientRow}>
                  <td className={styles.estClientRowDesc}>
                    <span className={styles.estClientRowName}>Add-Ons &amp; Services</span>
                  </td>
                  <td className={styles.estClientRowAmt}>{fmt(clientAddonsAmt)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className={styles.estClientSubtotalRow}>
                <td className={styles.estClientSubtotalLabel}>Subtotal</td>
                <td className={styles.estClientSubtotalAmt}>{fmt(clientTotal)}</td>
              </tr>
              {taxNum > 0 && (
                <tr className={styles.estClientSubtotalRow}>
                  <td className={styles.estClientSubtotalLabel}>Tax ({taxNum}%)</td>
                  <td className={styles.estClientSubtotalAmt}>{fmt(taxAmount)}</td>
                </tr>
              )}
              <tr className={styles.estClientTotalRow}>
                <td className={styles.estClientTotalLabel}>TOTAL</td>
                <td className={styles.estClientTotalAmt}>{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Payment schedule */}
          <div className={styles.estClientPayment}>
            <div className={styles.estClientPaymentTitle}>Payment Schedule</div>
            <div className={styles.estClientPaymentRow}>
              <span>Deposit required ({depositPctNum}%)</span>
              <span className={styles.estClientPaymentAmt}>{fmt(depositAmount)}</span>
            </div>
            <div className={styles.estClientPaymentRow}>
              <span>Balance due on {formattedDate}</span>
              <span className={styles.estClientPaymentAmt}>{fmt(balance)}</span>
            </div>
          </div>

          {/* Notes (editable) */}
          <div className={styles.estClientNotesEdit}>
            <label className={styles.estFieldLabel}>Notes / Terms</label>
            <textarea
              className={styles.addTextarea}
              value={clientNotes}
              rows={3}
              placeholder="Payment terms, cancellation policy, etc."
              onChange={(e) => setClientNotes(e.target.value)}
            />
          </div>

          {clientNotes && (
            <div className={styles.estClientNotes}>
              <div className={styles.estClientNotesTitle}>Notes &amp; Terms</div>
              <div className={styles.estClientNotesBody}>{clientNotes}</div>
            </div>
          )}

          {/* Signature */}
          <div className={styles.estClientSignature}>
            <div className={styles.estClientSigLine} />
            <div className={styles.estClientSigLabel}>
              Forager Crafts · Authorized Signature
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
