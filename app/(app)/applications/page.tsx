import MyApplications from "@/components/challenge/MyApplications";

export default function ApplicationsPage() {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Миний өргөдөл
        </h1>
        <p className="mt-2 text-sm text-muted">
          Таны илгээсэн анкетууд болон тэдгээрийн төлөв
        </p>
      </header>

      <MyApplications />
    </>
  );
}
