export type EventOption = {
  id: string
  type: "offsite" | "in-studio"
  title: string
  date: string
  guestCount: number | null
}

export type CraftInfo = {
  id: string
  name: string
  quantity: number | null
  supplies: Array<{
    name: string
    unit: string | null
    qty_per_guest: number | null
    unit_cost: number | null
  }>
}
