import Link from "next/link";
import { Shield, ArrowRight, Lock, Globe, CheckCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-20 items-center justify-between border-b border-border px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
            <Shield className="h-6 w-6" strokeWidth={3} />
          </div>
          <span className="text-xl font-bold tracking-tighter">WAVIS</span>
        </div>
        <nav className="hidden gap-8 text-sm font-bold uppercase tracking-widest md:flex">
          <Link href="#" className="hover:opacity-70">Philosophy</Link>
          <Link href="#" className="hover:opacity-70">Security</Link>
          <Link href="#" className="hover:opacity-70">Contact</Link>
        </nav>
        <Link href="/dashboard">
          <button className="hidden border-2 border-primary px-6 py-2 text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-colors md:block">
            Sign In
          </button>
        </Link>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center px-6 py-24 text-center md:py-32 lg:py-40">
          <div className="mb-8 inline-flex items-center gap-2 border border-border bg-secondary/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            System Operational
          </div>
          
          <h1 className="max-w-4xl text-5xl font-bold tracking-tighter sm:text-7xl md:text-8xl lg:text-9xl text-primary">
            FINANCIAL <br className="hidden md:block" />
            <span className="text-muted-foreground">SANCTUARY.</span>
          </h1>
          
          <p className="mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl font-medium leading-relaxed">
            The world's most secure decentralized vault. <br/>
            Sovereignty, privacy, and integrity in one white box.
          </p>

          <div className="mt-12 flex flex-col gap-4 sm:flex-row">
            <Link href="/dashboard">
              <button className="group flex h-14 min-w-[200px] items-center justify-center gap-2 bg-primary px-8 text-sm font-bold uppercase tracking-widest text-primary-foreground transition-all hover:scale-105 active:scale-95">
                Open Vault
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
            <button className="flex h-14 min-w-[200px] items-center justify-center gap-2 border border-input bg-background px-8 text-sm font-bold uppercase tracking-widest text-foreground hover:bg-secondary transition-colors">
              Documentation
            </button>
          </div>
        </section>

        {/* Features Grid */}
        <section className="grid border-t border-border md:grid-cols-3">
          {[
            {
              icon: Lock,
              title: "Absolute Privacy",
              desc: "End-to-end encryption with zero-knowledge architecture. Your data remains yours alone."
            },
            {
              icon: Globe,
              title: "Global Access",
              desc: "Instant liquidity anywhere in the world. Uncensorable and borderless transactions."
            },
            {
              icon: Shield,
              title: "Swiss Standard",
              desc: "Built with the precision and reliability of Swiss banking infrastructure."
            }
          ].map((feature, i) => (
            <div key={i} className="group border-b border-border p-12 transition-colors hover:bg-secondary/20 md:border-b-0 md:border-r last:border-r-0">
              <feature.icon className="mb-6 h-8 w-8 text-primary" strokeWidth={1.5} />
              <h3 className="mb-3 text-lg font-bold uppercase tracking-wider">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-border py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
        © 2026 Wavis Inc. All Systems Secured.
      </footer>
    </div>
  );
}