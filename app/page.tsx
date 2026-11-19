import Link from 'next/link';

export default function Home() {
  return (
    <main className="stage-light flex min-h-dvh flex-col justify-between px-6 py-14 md:px-16">
      <div className="max-w-2xl">
        <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">Backstage</h1>
        <p className="mt-5 max-w-[46ch] text-lg text-haze">
          One chat room for every gig. It opens before the doors, runs the night, and stays open afterwards as the artist’s fan club.
          When something goes wrong, the crew sorts it out in a private room and the whole audience sees the confirmed update.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/e/raahe-live" className="flex h-14 items-center justify-center rounded-2xl bg-spot px-6 text-lg font-semibold text-ink">
          Join Raahe Live
        </Link>
        <Link href="/e/raahe-live/screen" className="flex h-14 items-center justify-center rounded-2xl border border-line px-6 text-lg">
          Open the stage screen
        </Link>
      </div>
    </main>
  );
}
