import EventFolder from "../../_components/EventFolder"

export default function InStudioEventPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  return (
    <EventFolder
      eventKind="in-studio"
      id={params.id}
      tab={searchParams.tab ?? "overview"}
    />
  )
}
