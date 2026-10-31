'use client';

import { useMemo, useState } from 'react';

const tiles = [
  { id: 'jade', name: 'Jade Garden', detail: 'Ngọc bích · 144 tiles', color: '#0E5A4A', swatch: '#BFE7D2' },
  { id: 'saffron', name: 'Saffron Dusk', detail: 'Hổ phách · 144 tiles', color: '#B96A21', swatch: '#F8D08A' },
  { id: 'ink', name: 'Ink & Ivory', detail: 'Mực đen · 144 tiles', color: '#252C47', swatch: '#E5E7EF' },
  { id: 'coral', name: 'Coral Tide', detail: 'San hô · 144 tiles', color: '#C84B5B', swatch: '#F7C4C7' },
];

const tileFaces = ['萬', '筒', '索', '東', '南', '西', '北', '中'];

export default function MahjongHome() {
  const [selected, setSelected] = useState<string[]>(['jade', 'ink']);
  const [active, setActive] = useState('jade');
  const [message, setMessage] = useState('');
  const activeTile = tiles.find((tile) => tile.id === active)!;
  const total = useMemo(() => selected.length * 36, [selected]);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setActive(id);
  }

  return (
    <main className="min-h-screen bg-[#FBF8F1] text-[#211F1A]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-12">
        <a href="/mahjong" className="flex items-center gap-3 font-semibold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#211F1A] text-lg text-[#F6D36B]">麻</span><span>MAHŌ</span></a>
        <nav className="hidden items-center gap-8 text-sm text-[#6E675B] md:flex"><a href="#sets">Shop sets</a><a href="#story">Our craft</a><a href="#builder">Build your set</a></nav>
        <button className="rounded-full border border-[#D8D0C3] px-4 py-2 text-sm">Bag (0)</button>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-12 lg:pt-16">
        <div><p className="mb-5 text-xs font-semibold uppercase tracking-[.22em] text-[#C84B5B]">Modern Mahjong objects</p><h1 className="max-w-xl font-display text-5xl font-bold leading-[1.03] tracking-[-.04em] sm:text-7xl">A set worth gathering around.</h1><p className="mt-6 max-w-md text-base leading-7 text-[#6E675B]">Hand-finished tiles, considered colors, and a table ritual designed for slow Sundays and late nights.</p><div className="mt-8 flex flex-wrap gap-3"><a href="#builder" className="rounded-full bg-[#211F1A] px-6 py-3 text-sm font-semibold text-white">Build your set <span aria-hidden>→</span></a><a href="#sets" className="rounded-full border border-[#CFC5B5] px-6 py-3 text-sm font-semibold">Explore sets</a></div><div className="mt-12 grid max-w-md grid-cols-3 gap-5 border-t border-[#DED5C7] pt-5 text-xs text-[#6E675B]"><span><b className="block text-xl text-[#211F1A]">01</b>Pick your palette</span><span><b className="block text-xl text-[#211F1A]">02</b>Make it yours</span><span><b className="block text-xl text-[#211F1A]">03</b>Gather & play</span></div></div>
        <div className="relative min-h-[430px] overflow-hidden rounded-[2rem] bg-[#DDEBE0] p-8"><div className="absolute -right-12 -top-14 h-64 w-64 rounded-full bg-[#F6D36B]" /><div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-[#C84B5B] opacity-80" /><div className="relative grid h-full place-items-center"><div className="grid rotate-[-8deg] grid-cols-4 gap-3">{tileFaces.map((face, i) => <div key={face} className="grid h-24 w-16 place-items-center rounded-lg border-2 border-[#EDE5D8] bg-[#FFFDF8] text-3xl shadow-[6px_8px_0_#B6CDBB] sm:h-28 sm:w-20" style={{ color: i % 2 ? '#C84B5B' : '#0E5A4A' }}>{face}</div>)}</div></div><p className="absolute bottom-6 left-7 text-xs font-semibold uppercase tracking-[.18em] text-[#315C4D]">The Sunday table / 2026</p></div>
      </section>

      <section id="sets" className="border-y border-[#DED5C7] bg-[#FFFDF8] px-6 py-16 lg:px-12"><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#C84B5B]">The collection</p><h2 className="mt-2 font-display text-3xl font-bold">Color changes the mood.</h2></div><a href="#builder" className="hidden text-sm font-semibold underline underline-offset-4 sm:block">Make a custom one →</a></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles.map((tile) => <button key={tile.id} onClick={() => { setActive(tile.id); document.querySelector('#builder')?.scrollIntoView({ behavior: 'smooth' }); }} className="group rounded-2xl border border-[#E2D9CA] p-3 text-left hover:border-[#211F1A]"><div className="grid h-44 place-items-center rounded-xl" style={{ background: tile.swatch }}><span className="font-display text-7xl" style={{ color: tile.color }}>麻</span></div><div className="flex items-center justify-between px-1 pt-4"><span><b className="block text-sm">{tile.name}</b><small className="text-[#7C7468]">{tile.detail}</small></span><span className="text-lg">↗</span></div></button>)}</div></div></section>

      <section id="builder" className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-12"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#C84B5B]">Build your set</p><h2 className="mt-2 font-display text-4xl font-bold leading-tight">Your table,<br />your palette.</h2><p className="mt-5 max-w-sm text-sm leading-6 text-[#6E675B]">Choose the colors that make people want to pull up a chair. Mix up to four editions into one personal set.</p><div className="mt-8 rounded-2xl bg-[#F1ECE3] p-5"><div className="flex items-center justify-between text-sm"><span>Selected editions</span><b>{selected.length}/4</b></div><div className="mt-4 flex gap-2">{selected.map((id) => <span key={id} className="h-8 w-8 rounded-full border-2 border-white" style={{ background: tiles.find((t) => t.id === id)?.color }} />)}</div><p className="mt-4 text-xs text-[#7C7468]">{total} tiles · free monogram included</p></div></div><div className="rounded-[1.5rem] border border-[#DED5C7] bg-[#FFFDF8] p-5 sm:p-8"><div className="flex items-center justify-between border-b border-[#E5DDD1] pb-5"><div><p className="text-xs uppercase tracking-[.18em] text-[#7C7468]">Step 1 of 2</p><h3 className="mt-1 text-xl font-semibold">Choose your editions</h3></div><span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: activeTile.swatch, color: activeTile.color }}>{activeTile.name}</span></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{tiles.map((tile) => <button key={tile.id} onClick={() => toggle(tile.id)} aria-pressed={selected.includes(tile.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selected.includes(tile.id) ? 'border-[#211F1A] bg-[#F7F2E9]' : 'border-[#E5DDD1]'}`}><span className="grid h-12 w-12 place-items-center rounded-lg text-2xl" style={{ background: tile.swatch, color: tile.color }}>麻</span><span className="min-w-0"><b className="block text-sm">{tile.name}</b><small className="text-[#7C7468]">{tile.detail}</small></span><span className="ml-auto text-lg">{selected.includes(tile.id) ? '✓' : '+'}</span></button>)}</div><div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[#E5DDD1] pt-6"><span className="text-sm text-[#6E675B]">Next: monogram & case</span><button onClick={() => setMessage('Palette saved — monogram step is ready.')} className="rounded-full bg-[#211F1A] px-5 py-3 text-sm font-semibold text-white">Continue <span aria-hidden>→</span></button></div>{message && <p role="status" className="mt-4 text-sm text-[#0E5A4A]">{message}</p>}</div></section>

      <footer id="story" className="border-t border-[#DED5C7] px-6 py-8 text-sm text-[#7C7468] lg:px-12"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row"><span>MAHŌ — objects for a slower game.</span><span>© 2026 Mahō Studio</span></div></footer>
    </main>
  );
}
