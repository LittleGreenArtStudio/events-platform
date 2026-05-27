import { createSupabaseServerClient } from "@/lib/auth"
import Link from "next/link"
import { notFound } from "next/navigation"
import AddSupplyForm from "./_components/AddSupplyForm"
import RemoveSupplyBtn from "./_components/RemoveSupplyBtn"
import AIDraftPanel from "./_components/AIDraftPanel"
import PhotoUpload from "./_components/PhotoUpload"
import styles from "../crafts.module.css"

type CraftRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  skill_level: string | null
  time_per_guest: number | null
  min_guests: number | null
  max_guests: number | null
  setup_notes: string | null
  teardown_notes: string | null
  is_active: boolean | null
  image_urls: string[] | null
}

type CraftSupplyRow = {
  id: string
  qty_per_guest: number | null
  supplies: {
    id: string
    name: string
    unit: string | null
    unit_cost: number | null
  } | null
}

type SupplyOption = { id: string; name: string; unit: string | null; unit_cost: number | null }
type VendorOption = { id: string; name: string }

function skillLabel(level: string | null): string {
  if (!level) return "—"
  return level.charAt(0).toUpperCase() + level.slice(1)
}

export default async function CraftDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createSupabaseServerClient()

  const [craftResult, suppliesResult, allSuppliesResult, vendorsResult] =
    await Promise.all([
      supabase
        .from("crafts")
        .select("id, name, description, category, skill_level, time_per_guest, min_guests, max_guests, setup_notes, teardown_notes, is_active, image_urls")
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("craft_supplies")
        .select("id, qty_per_guest, supplies(id, name, unit, unit_cost)")
        .eq("craft_id", params.id)
        .order("id"),
      supabase
        .from("supplies")
        .select("id, name, unit, unit_cost")
        .order("name"),
      supabase
        .from("vendors")
        .select("id, name")
        .order("name"),
    ])

  if (!craftResult.data) notFound()

  const craft = craftResult.data as unknown as CraftRow
  const craftSupplies = ((suppliesResult.data ?? []) as unknown as CraftSupplyRow[])
  const allSupplies = ((allSuppliesResult.data ?? []) as unknown as SupplyOption[])
  const vendors = ((vendorsResult.data ?? []) as unknown as VendorOption[])

  const existingSupplyIds = craftSupplies
    .map((cs) => cs.supplies?.id)
    .filter((id): id is string => !!id)

  const totalCostPerGuest = craftSupplies.reduce((sum, cs) => {
    const cost = cs.supplies?.unit_cost ?? 0
    const qty = cs.qty_per_guest ?? 0
    return sum + cost * qty
  }, 0)

  const guestRange =
    craft.min_guests != null || craft.max_guests != null
      ? [craft.min_guests, craft.max_guests].filter((n) => n != null).join("–")
      : null

  return (
    <div>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/crafts" className={styles.breadcrumbLink}>
          Craft Library
        </Link>
        <span className={styles.breadcrumbSep}>›</span>
        <span className={styles.breadcrumbCurrent}>{craft.name}</span>
      </div>

      {/* Header */}
      <div className={styles.craftHeader}>
        <div className={styles.craftTypeRow}>
          <span className={styles.craftTypeLabel}>Craft</span>
          {craft.category && (
            <span className={styles.categoryLabel}>{craft.category}</span>
          )}
          {craft.skill_level && (
            <span
              className={`${styles.skillPill} ${
                craft.skill_level === "beginner"
                  ? styles.skillBeginner
                  : craft.skill_level === "intermediate"
                  ? styles.skillIntermediate
                  : craft.skill_level === "advanced"
                  ? styles.skillAdvanced
                  : styles.skillUnknown
              }`}
            >
              {skillLabel(craft.skill_level)}
            </span>
          )}
          <span className={craft.is_active ? styles.activePill : styles.inactivePill}>
            {craft.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <h1 className={styles.craftHeading}>{craft.name}</h1>
        {craft.description && (
          <p className={styles.craftSub}>{craft.description}</p>
        )}
      </div>

      {/* Double Rule */}
      <div className={styles.craftDoubleRule} />

      {/* Two-column content */}
      <div className={styles.craftContent}>
        {/* Left: Info pairs */}
        <div>
          <div className={styles.infoSectionTitle}>Details</div>

          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Category</span>
            <span className={styles.infoValue}>
              {craft.category ?? <span className={styles.infoValueMuted}>—</span>}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Skill Level</span>
            <span className={styles.infoValue}>{skillLabel(craft.skill_level)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Time / Guest</span>
            <span className={styles.infoValue}>
              {craft.time_per_guest != null ? `${craft.time_per_guest} min` : <span className={styles.infoValueMuted}>—</span>}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Guest Range</span>
            <span className={styles.infoValue}>
              {guestRange ?? <span className={styles.infoValueMuted}>—</span>}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Status</span>
            <span className={styles.infoValue}>{craft.is_active ? "Active" : "Inactive"}</span>
          </div>

          {(craft.setup_notes || craft.teardown_notes) && (
            <div style={{ marginTop: 28 }}>
              <div className={styles.infoSectionTitle}>Notes</div>
              {craft.setup_notes && (
                <>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Setup</span>
                  </div>
                  <div className={styles.infoNotes}>{craft.setup_notes}</div>
                </>
              )}
              {craft.teardown_notes && (
                <>
                  <div className={styles.infoItem} style={{ marginTop: 12 }}>
                    <span className={styles.infoLabel}>Teardown</span>
                  </div>
                  <div className={styles.infoNotes}>{craft.teardown_notes}</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Supplies */}
        <div>
          <div className={styles.suppliesSectionTitle}>Supplies</div>

          {craftSupplies.length === 0 ? (
            <p className={styles.noSupplies}>No supplies attached yet.</p>
          ) : (
            <table className={styles.suppliesTable}>
              <thead className={styles.suppliesTableHead}>
                <tr>
                  <th>Supply</th>
                  <th>Unit</th>
                  <th>Qty / Guest</th>
                  <th>Unit Cost</th>
                  <th>Est. / Guest</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {craftSupplies.map((cs) => {
                  const s = cs.supplies
                  const costPerGuest =
                    s?.unit_cost != null && cs.qty_per_guest != null
                      ? s.unit_cost * cs.qty_per_guest
                      : null
                  return (
                    <tr key={cs.id} className={styles.supplyRow}>
                      <td className={styles.supplyName}>{s?.name ?? "—"}</td>
                      <td className={styles.supplyUnit}>{s?.unit ?? "—"}</td>
                      <td className={styles.supplyQty}>
                        {cs.qty_per_guest ?? "—"}
                      </td>
                      <td className={styles.supplyCost}>
                        {s?.unit_cost != null ? `$${s.unit_cost.toFixed(2)}` : "—"}
                      </td>
                      <td className={styles.supplyTotal}>
                        {costPerGuest != null ? `$${costPerGuest.toFixed(2)}` : "—"}
                      </td>
                      <td className={styles.supplyRemoveCell}>
                        <RemoveSupplyBtn craftSupplyId={cs.id} craftId={craft.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className={styles.suppliesTotalRow}>
                  <td colSpan={4} className={styles.suppliesTotalLabel}>
                    Total estimated cost per guest
                  </td>
                  <td className={styles.suppliesTotalValue}>
                    ${totalCostPerGuest.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}

          <div className={styles.supplyActions}>
            <AddSupplyForm
              craftId={craft.id}
              allSupplies={allSupplies}
              allVendors={vendors}
              existingSupplyIds={existingSupplyIds}
            />
            <AIDraftPanel
              craftId={craft.id}
              craftName={craft.name}
              category={craft.category}
            />
          </div>
        </div>
      </div>

      {/* Photos section */}
      <div className={styles.photoSection}>
        <div className={styles.craftDoubleRule} />
        <div className={styles.photoSectionInner}>
          <div className={styles.suppliesSectionTitle}>Photos</div>
          <PhotoUpload
            craftId={craft.id}
            imageUrls={craft.image_urls ?? []}
          />
        </div>
      </div>
    </div>
  )
}
