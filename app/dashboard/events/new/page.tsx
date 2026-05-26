import { createSupabaseServerClient } from "@/lib/auth"
import NewEventForm from "./NewEventForm"
import styles from "../events.module.css"

type Client = { id: string; name: string }

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name, company")
    .order("first_name")

  type RawClient = { id: string; first_name: string | null; last_name: string | null; company: string | null }
  const clients: Client[] = ((data ?? []) as unknown as RawClient[]).map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "Unnamed Client",
  }))

  return (
    <>
      <div className={styles.newEventWrap}>
        <h2 className={styles.newEventHeading}>New Event</h2>
        <p className={styles.newEventSub}>
          Fill in the details below to create a new event folder.
        </p>
      </div>
      <NewEventForm clients={clients} error={searchParams.error} />
    </>
  )
}
