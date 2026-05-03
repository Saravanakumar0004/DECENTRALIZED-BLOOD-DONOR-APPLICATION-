import { Link } from 'react-router-dom'

const STATS = [
  { label: 'Donors', value: '10,000+' },
  { label: 'Hospitals', value: '500+' },
  { label: 'Match Rate', value: '98%' },
  { label: 'Lives Saved', value: '25,000+' },
]

const STEPS = [
  { n: '01', title: 'Register', desc: 'Create your donor or hospital account in minutes.' },
  { n: '02', title: 'Match',    desc: 'Get matched with nearby blood requests by blood group and location.' },
  { n: '03', title: 'Donate',   desc: 'Visit the hospital and complete your donation securely.' },
  { n: '04', title: 'Earn',     desc: 'Receive 100 BDC tokens + soulbound NFT certificate on the blockchain.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 font-body">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-20 py-5 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blood-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-display text-sm">B</span>
          </div>
          <span className="font-display text-2xl text-blood-400 tracking-widest">BLOODLINK</span>
        </div>
        <div className="flex gap-3">
          <Link to="/login"    className="btn-ghost text-sm">Login</Link>
          <Link to="/register" className="btn-primary text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-20 pt-24 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#e51d1d18_0%,_transparent_60%)]" />
        <div className="relative max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-blood-900/40 border border-blood-800/50 rounded-full px-4 py-1.5 text-xs text-blood-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blood-500 animate-pulse" />
            Blockchain-powered blood donation platform
          </div>
          <h1 className="font-display text-7xl lg:text-9xl text-slate-100 leading-none tracking-tight mb-6">
            GIVE BLOOD.<br />
            <span className="text-blood-500">SAVE LIVES.</span><br />
            EARN REWARDS.
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mb-10 leading-relaxed">
            Connect donors with hospitals in real-time. Every verified donation earns you
            Blood Donor Coins and a permanent NFT certificate on the Ethereum blockchain.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/register" className="btn-primary px-8 py-3 text-base">Register as Donor</Link>
            <Link to="/register" className="btn-secondary px-8 py-3 text-base">Register as Hospital</Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 lg:px-20 py-16 border-y border-slate-800">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="font-display text-5xl text-blood-400 mb-1">{value}</p>
              <p className="text-slate-500 text-sm uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 lg:px-20 py-24">
        <h2 className="font-display text-5xl text-slate-100 mb-16">HOW IT WORKS</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="card relative group hover:border-blood-800 transition-all">
              <span className="font-display text-6xl text-slate-800 group-hover:text-blood-900 transition-colors">{n}</span>
              <h3 className="font-display text-2xl text-slate-100 mt-2 mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 lg:px-20 py-20 text-center">
        <div className="max-w-2xl mx-auto card border-blood-900/50 bg-blood-950/20">
          <h2 className="font-display text-5xl text-slate-100 mb-4">READY TO SAVE A LIFE?</h2>
          <p className="text-slate-400 mb-8">Join thousands of donors making a difference today.</p>
          <Link to="/register" className="btn-primary px-10 py-3 text-base inline-block">Start Donating</Link>
        </div>
      </section>

      <footer className="px-6 lg:px-20 py-8 border-t border-slate-800 text-center text-slate-600 text-sm">
        © 2026 BloodLink — Team Web Breach. Transparent Giving for a Healthier Tomorrow.
      </footer>
    </div>
  )
}
