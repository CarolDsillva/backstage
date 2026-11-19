import Link from 'next/link';

const SLUG = 'raahe-live';

export default function Home() {
  return (
    <main className="stage-light flex min-h-dvh flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-16">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-spot text-lg font-extrabold text-ink">B</span>
        <span className="text-lg font-bold">Backstage</span>
      </div>

      <div className="rise mt-10 max-w-2xl">
        <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl">One room for the whole gig.</h1>
        <p className="mt-4 max-w-[44ch] text-lg text-haze">
          Meet people before the doors, vote the songs during the show, and stay in touch with the artist after. If anything goes wrong, the crew is one tap away.
        </p>
      </div>

      <div className="rise mt-auto grid gap-3 pt-10 md:max-w-3xl md:grid-cols-2" style={{ animationDelay: '120ms' }}>
        <Link href={`/e/${SLUG}`} className="poster flex min-h-44 flex-col justify-between rounded-[1.75rem] p-5">
          <span className="self-start rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur">For the audience</span>
          <span>
            <span className="block text-3xl font-extrabold leading-tight text-white">I’m going to the gig</span>
            <span className="mt-1 block text-sm text-white/80">Join Raahe Live with just your name</span>
          </span>
        </Link>
        <Link href={`/e/${SLUG}/crew`} className="flex min-h-44 flex-col justify-between overflow-hidden rounded-[1.75rem] border border-line bg-[#0b0a10]">
          <span className="h-3 bg-[repeating-linear-gradient(135deg,#c6f36b_0_12px,#0b0a10_12px_24px)]" aria-hidden />
          <span className="p-5 pt-0">
            <span className="block text-3xl font-extrabold leading-tight">I’m crew tonight</span>
            <span className="mt-1 block text-sm text-haze">Check in with your crew code</span>
          </span>
        </Link>
      </div>
      <Link href={`/e/${SLUG}/screen`} className="mt-4 text-sm text-haze underline-offset-4 hover:underline">Open the stage screen</Link>
    </main>
  );
}
