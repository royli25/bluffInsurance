import Link from "next/link";

export default function SeatwiseHeader() {
  return (
    <header className="bg-[#024ddf] text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/seatwise" className="text-xl font-semibold">seatwise</Link>
        <nav className="hidden gap-5 text-sm font-semibold md:flex">
          <span>Concerts</span><span>Sports</span><span>Arts &amp; Theater</span><span>Family</span>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm font-semibold">
          <Link href="/seatwise/account" className="hover:underline">My Account</Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-4">
        <div className="flex overflow-hidden rounded bg-white text-sm text-neutral-500">
          <div className="border-r px-3 py-2.5">📍 All of US</div>
          <div className="border-r px-3 py-2.5">📅 All Dates</div>
          <div className="flex-1 px-3 py-2.5">Search for artists, venues, and events</div>
          <div className="bg-[#024ddf] m-1 rounded px-4 py-1.5 font-semibold text-white">Search</div>
        </div>
      </div>
    </header>
  );
}
