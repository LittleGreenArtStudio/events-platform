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
    .select("id, name")
    .order("name")

  const clients = (data ?? []) as Client[]

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
