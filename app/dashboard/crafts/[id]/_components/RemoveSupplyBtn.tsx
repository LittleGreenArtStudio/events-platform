"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { removeCraftSupply } from "../../actions"
import styles from "../../crafts.module.css"

export default function RemoveSupplyBtn({
  craftSupplyId,
  craftId,
}: {
  craftSupplyId: string
  craftId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      className={styles.removeSupplyBtn}
      disabled={isPending}
      title="Remove supply"
      onClick={() => {
        startTransition(async () => {
          await removeCraftSupply(craftSupplyId, craftId)
          router.refresh()
        })
      }}
    >
      {isPending ? "…" : "×"}
    </button>
  )
}
