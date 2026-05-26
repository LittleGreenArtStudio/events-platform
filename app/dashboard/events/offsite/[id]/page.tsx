import EventFolder from "../../_components/EventFolder"

export default function OffsiteEventPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  return (
    <EventFolder
      eventKind="offsite"
      id={params.id}
      tab={searchParams.tab ?? "overview"}
    />
  )
}
