import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import { Input, Field, cx } from '../components/ui';

// Feature ticker (no real or fake business data is shown before sign-in).
const FEATURES = [
  { title: 'Lease expiry alerts', text: '90 / 60 / 30 days before every contract ends' },
  { title: 'One login, every entity', text: 'Jameel Square · SOLO · Gravita and more' },
  { title: 'Role-based access', text: 'Each team sees only its own entity' },
  { title: 'Live pipeline', text: 'From first enquiry to signed contract' },
  { title: 'Audit trail', text: 'Every change recorded, nothing lost' },
];

const ENTITIES = [
  { code: 'JS', name: 'Jameel Square', dot: 'bg-amber-400', ring: 'ring-amber-400/30' },
  { code: 'SLO', name: 'SOLO', dot: 'bg-lime-400', ring: 'ring-lime-400/30' },
  { code: 'GRV', name: 'Gravita', dot: 'bg-violet-400', ring: 'ring-violet-400/30' },
];

function useTicker(len, ms = 3200) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % len), ms); return () => clearInterval(t); }, [len, ms]);
  return i;
}

/** Decorative ring that keeps filling and emptying (SVG attributes + Tailwind transition). */
function PulseRing() {
  const r = 30;
  const c = 2 * Math.PI * r;
  const [p, setP] = useState(0.15);
  useEffect(() => {
    const vals = [0.62, 0.78, 0.55, 0.86, 0.7];
    let k = 0;
    const t = setInterval(() => { setP(vals[k % vals.length]); k++; }, 2200);
    setP(vals[0]);
    return () => clearInterval(t);
  }, []);
  return (
    <svg viewBox="0 0 72 72" className="size-16 -rotate-90" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-white/10" />
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
        className="stroke-amber-300 transition-[stroke-dashoffset] duration-[1600ms] ease-in-out" />
    </svg>
  );
}

/** Decorative bars that rise and fall. */
function Bars() {
  const sets = [[40, 65, 50, 80, 60, 90], [55, 45, 75, 60, 85, 70], [35, 70, 60, 50, 95, 75]];
  const i = useTicker(sets.length, 2000);
  return (
    <svg viewBox="0 0 120 60" className="h-14 w-full" aria-hidden="true">
      {sets[i].map((h, k) => (
        <rect key={k} x={k * 20 + 2} width="14" rx="3" y={60 - (h * 60) / 100} height={(h * 60) / 100}
          className="fill-violet-300/80 transition-all duration-700 ease-out" />
      ))}
    </svg>
  );
}

export default function Login() {
  const { loginMicrosoft, loginDev, devLogin, error } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const fi = useTicker(FEATURES.length);
  const year = new Date().getFullYear();

  const run = (fn) => async () => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-950 text-white">
      {/* Animated background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 size-[36rem] rounded-full bg-amber-500/25 blur-3xl motion-safe:animate-blob" />
        <div className="absolute top-1/4 -right-48 size-[40rem] rounded-full bg-violet-600/30 blur-3xl motion-safe:animate-blob motion-safe:[animation-delay:-6s]" />
        <div className="absolute -bottom-48 left-1/4 size-[34rem] rounded-full bg-lime-500/15 blur-3xl motion-safe:animate-blob motion-safe:[animation-delay:-12s]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-7xl grid-cols-1 items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:gap-16 lg:px-10">
        {/* Showcase (desktop/tablet) */}
        <section className="hidden lg:block" aria-label="About Hadya CRM">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10 motion-safe:animate-fade-up">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>
            Hadya Group · {year}
          </p>
          <h1 className="mt-5 text-5xl leading-[1.05] font-black tracking-tight xl:text-6xl motion-safe:animate-fade-up motion-safe:[animation-delay:100ms]">
            Every property.<br />
            Every lead.<br />
            <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-violet-300 bg-[length:200%_auto] bg-clip-text text-transparent motion-safe:animate-shimmer">One CRM.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-slate-400 motion-safe:animate-fade-up motion-safe:[animation-delay:200ms]">
            Hadya CRM brings leasing, members, maintenance and deals for all Hadya entities into one secure place.
          </p>

          {/* Floating glass cards */}
          <div className="relative mt-10 h-64">
            <div className="absolute top-0 left-0 w-60 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/15 backdrop-blur-xl motion-safe:animate-float">
              <div className="flex items-center gap-3">
                <PulseRing />
                <div>
                  <p className="text-xs tracking-wide text-slate-400 uppercase">Occupancy</p>
                  <p className="text-sm font-semibold">Tracked live, per entity</p>
                </div>
              </div>
            </div>
            <div className="absolute top-10 right-0 w-64 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/15 backdrop-blur-xl motion-safe:animate-float motion-safe:[animation-delay:-2s]">
              <p className="text-xs tracking-wide text-slate-400 uppercase">Pipeline</p>
              <Bars />
            </div>
            <div className="absolute bottom-0 left-16 w-72 overflow-hidden rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/15 backdrop-blur-xl motion-safe:animate-float motion-safe:[animation-delay:-4s]">
              <div key={fi} className="motion-safe:animate-fade-up">
                <p className="text-sm font-bold">{FEATURES[fi].title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{FEATURES[fi].text}</p>
              </div>
              <div className="mt-3 flex gap-1">
                {FEATURES.map((_, k) => <span key={k} className={cx('h-1 flex-1 rounded-full transition-colors duration-500', k === fi ? 'bg-amber-300' : 'bg-white/15')} />)}
              </div>
            </div>
          </div>
        </section>

        {/* Sign-in card */}
        <section className="mx-auto w-full max-w-md motion-safe:animate-fade-up motion-safe:[animation-delay:150ms]" aria-label="Sign in">
          <div className="relative rounded-3xl bg-gradient-to-b from-white/20 via-white/5 to-white/10 p-px shadow-2xl shadow-black/40">
            <div className="rounded-3xl bg-slate-900/80 px-6 py-8 backdrop-blur-2xl sm:px-10 sm:py-12">
              <div className="flex flex-col items-center text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 font-serif text-xl font-black text-slate-900 shadow-lg shadow-amber-500/30 motion-safe:animate-float">HC</span>
                <p className="mt-4 text-xs font-bold tracking-[0.25em] text-amber-300 uppercase">Hadya Group</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">Hadya CRM</h2>
                <p className="mt-2 text-sm text-slate-400">Sign in with your company Microsoft account</p>
              </div>

              <button
                type="button"
                onClick={run(loginMicrosoft)}
                disabled={busy}
                className="group relative mt-8 flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-4 py-3.5 text-sm font-bold text-slate-900 shadow-lg shadow-white/10 transition hover:-translate-y-0.5 hover:shadow-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-70"
              >
                <span className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-slate-900/10 to-transparent transition-all duration-700 group-hover:left-[120%]" aria-hidden="true" />
                <span className="grid grid-cols-2 gap-0.5" aria-hidden="true">
                  <span className="size-2.5 bg-[#f25022]" /><span className="size-2.5 bg-[#7fba00]" />
                  <span className="size-2.5 bg-[#00a4ef]" /><span className="size-2.5 bg-[#ffb900]" />
                </span>
                {busy ? 'Redirecting to Microsoft…' : 'Sign in with Microsoft'}
              </button>

              {error && <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{error}</p>}

              {devLogin && (
                <div className="mt-6 space-y-2 rounded-2xl border border-dashed border-amber-400/50 bg-amber-400/5 p-4">
                  <p className="text-xs font-semibold text-amber-300">Development login · disabled in production</p>
                  <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hadya.com" /></Field>
                  <button type="button" disabled={busy || !email} onClick={run(() => loginDev(email))}
                    className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-50">Dev sign in</button>
                </div>
              )}

              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {ENTITIES.map((e) => (
                  <span key={e.code} className={cx('inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1', e.ring)}>
                    <span className={cx('size-1.5 rounded-full', e.dot)} />{e.name}
                  </span>
                ))}
              </div>

              <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <svg viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current" strokeWidth="2" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></svg>
                Secured by Microsoft Entra ID · Access by invitation only
              </p>
            </div>
          </div>

          {/* Mobile feature ticker */}
          <div className="mt-6 text-center lg:hidden">
            <div key={fi} className="motion-safe:animate-fade-up">
              <p className="text-sm font-semibold">{FEATURES[fi].title}</p>
              <p className="text-xs text-slate-400">{FEATURES[fi].text}</p>
            </div>
          </div>
          <p className="mt-6 text-center text-[11px] text-slate-600">© {year} Hadya Group · Hadya CRM</p>
        </section>
      </div>
    </div>
  );
}