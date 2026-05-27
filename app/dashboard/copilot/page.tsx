import { createSupabaseServerClient } from "@/lib/auth"
import SupplyEstimator from "./_components/SupplyEstimator"
import BriefGenerator from "./_components/BriefGenerator"
import type { EventOption } from "./types"
import styles from "./copilot.module.css"

export default async function CopilotPage() {
  const supabase = await createSupabaseServerClient()

  const [{ data: offsite }, { data: studio }] = await Promise.all([
    supabase
      .from("offsite_events")
      .select("id, title, event_date, guest_count")
      .order("event_date", { ascending: false }),
    supabase
      .from("in_studio_events")
      .select("id, title, event_date, guest_count")
      .order("event_date", { ascending: false }),
  ])

  type RawEvent = { id: string; title: string; event_date: string; guest_count: number | null }

  const events: EventOption[] = [
    ...((offsite ?? []) as unknown as RawEvent[]).map((e) => ({
      id: e.id,
      type: "offsite" as const,
      title: e.title,
      date: e.event_date,
      guestCount: e.guest_count,
    })),
    ...((studio ?? []) as unknown as RawEvent[]).map((e) => ({
      id: e.id,
      type: "in-studio" as const,
      title: e.title,
      date: e.event_date,
      guestCount: e.guest_count,
    })),
  ]

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>AI Copilot</h1>
      <p className={styles.sub}>POWERED BY CLAUDE · FORAGER CRAFTS</p>
      <SupplyEstimator events={events} />
      <BriefGenerator events={events} />
    </div>
  )
}
