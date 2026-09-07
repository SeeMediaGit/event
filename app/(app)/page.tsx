import EventList from "@/components/EventList";

export default function EventsPage() {
  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Уралдаан тэмцээн
        </h1>
        <p className="mt-2 text-sm text-muted">
          SeeMedia-гийн зохион байгуулж буй уралдаан тэмцээнүүд
        </p>
      </header>

      <EventList />
    </>
  );
}
