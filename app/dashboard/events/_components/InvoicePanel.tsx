"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createInvoice,
  addInvoiceLineItem,
  removeInvoiceLineItem,
  updateInvoiceStatus,
} from "../actions"
import styles from "../folder.module.css"

type LineItem = {
  id: string
  description: string
  quantity: number | null
  unit_price: number | null
}

type Invoice = {
  id: string
  status: string
  tax_rate: number | null
  due_date: string | null
  notes: string | null
  subtotal: number | null
  total: number | null
  amount_paid: number | null
  created_at: string
  invoice_line_items: LineItem[]
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
}

function formatDate(str: string) {
  const [y, m, d] = str.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function InvoicePanel({
  eventKind,
  eventId,
  invoices,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  invoices: Invoice[]
}) {
  const router = useRouter()
  const [activeInvoiceId, setActiveInvoiceId] = useState(invoices[0]?.id ?? "")
  const [lineDesc, setLineDesc] = useState("")
  const [lineQty, setLineQty] = useState("1")
  const [linePrice, setLinePrice] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [creating, startCreateTransition] = useTransition()
  const [, startLineTransition] = useTransition()
  const [, startStatusTransition] = useTransition()

  const activeInvoice = invoices.find((inv) => inv.id === activeInvoiceId) ?? null

  const handleCreate = () => {
    setError(null)
    startCreateTransition(async () => {
      const res = await createInvoice(eventKind, eventId)
      if ("error" in res) {
        setError(res.error)
      } else {
        setActiveInvoiceId(res.id)
        router.refresh()
      }
    })
  }

  const handleAddLine = () => {
    if (!activeInvoiceId || !lineDesc.trim()) return
    setError(null)
    startLineTransition(async () => {
      const res = await addInvoiceLineItem(
        eventKind, eventId, activeInvoiceId, lineDesc, lineQty, linePrice
      )
      if ("error" in res) {
        setError(res.error)
      } else {
        setLineDesc("")
        setLineQty("1")
        setLinePrice("")
        router.refresh()
      }
    })
  }

  const handleRemoveLine = (lineItemId: string) => {
    if (!activeInvoiceId) return
    startLineTransition(async () => {
      await removeInvoiceLineItem(eventKind, eventId, activeInvoiceId, lineItemId)
      router.refresh()
    })
  }

  const handleStatus = (status: string) => {
    if (!activeInvoiceId) return
    startStatusTransition(async () => {
      const amountPaid =
        status === "paid" && activeInvoice
          ? (activeInvoice.total ?? 0)
          : undefined
      await updateInvoiceStatus(eventKind, eventId, activeInvoiceId, status, amountPaid)
      router.refresh()
    })
  }

  if (invoices.length === 0 && !creating) {
    return (
      <div>
        {error && <p className={styles.addError}>{error}</p>}
        <p className={styles.emptyState}>No invoice yet.</p>
        <button className={styles.addBtn} onClick={handleCreate}>
          + Create Invoice
        </button>
      </div>
    )
  }

  if (creating && invoices.length === 0) {
    return <p className={styles.emptyState}>Creating invoice…</p>
  }

  return (
    <div>
      {invoices.length > 1 && (
        <div className={styles.invoiceTabBar}>
          {invoices.map((inv) => (
            <button
              key={inv.id}
              className={`${styles.invoiceTabBtn} ${activeInvoiceId === inv.id ? styles.invoiceTabBtnActive : ""}`}
              onClick={() => setActiveInvoiceId(inv.id)}
            >
              Invoice · {STATUS_LABELS[inv.status] ?? inv.status}
            </button>
          ))}
          <button className={styles.addBtn} onClick={handleCreate} style={{ marginLeft: "auto" }}>
            + New Invoice
          </button>
        </div>
      )}

      {activeInvoice && (
        <div className={styles.invoiceCard}>
          {/* Invoice Header */}
          <div className={styles.invoiceHeader}>
            <div className={styles.invoiceMeta}>
              <span className={`${styles.invoiceStatusPill} ${styles[`invoiceStatus_${activeInvoice.status}`]}`}>
                {STATUS_LABELS[activeInvoice.status] ?? activeInvoice.status}
              </span>
              {activeInvoice.due_date && (
                <span className={styles.invoiceDue}>
                  Due {formatDate(activeInvoice.due_date)}
                </span>
              )}
            </div>
            <div className={styles.invoiceStatusBtns}>
              {activeInvoice.status === "draft" && (
                <button className={styles.invoiceActionBtn} onClick={() => handleStatus("sent")}>
                  Mark Sent
                </button>
              )}
              {activeInvoice.status === "sent" && (
                <button className={styles.invoiceActionBtn} onClick={() => handleStatus("paid")}>
                  Mark Paid
                </button>
              )}
              {activeInvoice.status !== "void" && activeInvoice.status !== "paid" && (
                <button className={styles.invoiceVoidBtn} onClick={() => handleStatus("void")}>
                  Void
                </button>
              )}
            </div>
          </div>

          {/* Line Items */}
          {activeInvoice.invoice_line_items.length > 0 && (
            <table className={styles.lineItemsTable}>
              <thead className={styles.lineItemsHead}>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeInvoice.invoice_line_items.map((li) => {
                  const amount =
                    li.quantity != null && li.unit_price != null
                      ? li.quantity * li.unit_price
                      : null
                  return (
                    <tr key={li.id} className={styles.lineItemRow}>
                      <td className={styles.lineItemDesc}>{li.description}</td>
                      <td className={styles.lineItemNum}>{li.quantity ?? "—"}</td>
                      <td className={styles.lineItemNum}>
                        {li.unit_price != null ? `$${li.unit_price.toFixed(2)}` : "—"}
                      </td>
                      <td className={styles.lineItemNum}>
                        {amount != null ? `$${amount.toFixed(2)}` : "—"}
                      </td>
                      <td>
                        <button
                          className={styles.removeBtn}
                          onClick={() => handleRemoveLine(li.id)}
                          title="Remove line item"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className={styles.invoiceTotalsRow}>
                  <td colSpan={3} className={styles.invoiceTotalsLabel}>Subtotal</td>
                  <td className={styles.invoiceTotalsValue}>
                    ${(activeInvoice.subtotal ?? 0).toFixed(2)}
                  </td>
                  <td />
                </tr>
                {activeInvoice.tax_rate != null && activeInvoice.tax_rate > 0 && (
                  <tr className={styles.invoiceTotalsRow}>
                    <td colSpan={3} className={styles.invoiceTotalsLabel}>
                      Tax ({activeInvoice.tax_rate}%)
                    </td>
                    <td className={styles.invoiceTotalsValue}>
                      ${((activeInvoice.subtotal ?? 0) * activeInvoice.tax_rate / 100).toFixed(2)}
                    </td>
                    <td />
                  </tr>
                )}
                <tr className={`${styles.invoiceTotalsRow} ${styles.invoiceGrandTotal}`}>
                  <td colSpan={3} className={styles.invoiceTotalsLabel}>Total</td>
                  <td className={styles.invoiceTotalsValue}>
                    ${(activeInvoice.total ?? 0).toFixed(2)}
                  </td>
                  <td />
                </tr>
                {(activeInvoice.amount_paid ?? 0) > 0 && (
                  <tr className={styles.invoiceTotalsRow}>
                    <td colSpan={3} className={styles.invoiceTotalsLabel}>Amount Paid</td>
                    <td className={`${styles.invoiceTotalsValue} ${styles.invoicePaidValue}`}>
                      ${(activeInvoice.amount_paid ?? 0).toFixed(2)}
                    </td>
                    <td />
                  </tr>
                )}
              </tfoot>
            </table>
          )}

          {/* Add Line Item */}
          {activeInvoice.status === "draft" && (
            <div className={styles.addLineForm}>
              <div className={styles.addFormTitle}>Add Line Item</div>
              <div className={styles.addLineFields}>
                <input
                  type="text"
                  placeholder="Description"
                  className={`${styles.addInput} ${styles.addLineDesc}`}
                  value={lineDesc}
                  onChange={(e) => setLineDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddLine()}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Qty"
                  className={`${styles.addInput} ${styles.addLineNum}`}
                  value={lineQty}
                  onChange={(e) => setLineQty(e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit price"
                  className={`${styles.addInput} ${styles.addLineNum}`}
                  value={linePrice}
                  onChange={(e) => setLinePrice(e.target.value)}
                />
                <button
                  className={styles.addSubmitBtn}
                  onClick={handleAddLine}
                  disabled={!lineDesc.trim()}
                >
                  Add
                </button>
              </div>
              {error && <p className={styles.addError}>{error}</p>}
            </div>
          )}

          {activeInvoice.notes && (
            <div className={styles.invoiceNotes}>{activeInvoice.notes}</div>
          )}
        </div>
      )}

      {invoices.length > 0 && (
        <button className={styles.addBtn} onClick={handleCreate} style={{ marginTop: 16 }}>
          + New Invoice
        </button>
      )}
    </div>
  )
}
