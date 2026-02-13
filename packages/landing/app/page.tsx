import ButtonSignin from "@/components/ButtonSignin";

export default function Page() {
  return (
    <>
      <header className="p-4 flex justify-end max-w-7xl mx-auto">
        <ButtonSignin text="Login" />
      </header>
      <main>
        <section className="flex flex-col items-center justify-center text-center gap-12 px-8 py-24">
          <h1 className="text-3xl font-extrabold">Oko — Team Planner</h1>

          <p className="text-lg opacity-80">
            Collaborative project management with Gantt charts, kanban boards,
            and backlog — all in one place.
          </p>

          <ButtonSignin
            text="Get Started"
            extraStyle="btn-primary"
          />
        </section>
      </main>
    </>
  );
}
