import EventDetail from "@/components/EventDetail";

// Next 15: params is a Promise in server components.
export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventDetail eventId={id} />;
}
