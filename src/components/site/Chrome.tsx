import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, ArrowUpRight, ArrowUp } from "lucide-react";
import { site } from "@/data/portfolio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links = [
  { href: "work", label: "Work" },
  { href: "services", label: "Services" },
  { href: "about", label: "About" },
  { href: "experience", label: "Experience" },
  { href: "contact", label: "Contact" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 rounded-full border pl-2 pr-2 transition-all duration-500",
          scrolled || open
            ? "border-border bg-background/85 backdrop-blur-xl shadow-[0_12px_40px_-16px_var(--glow)]"
            : "border-border/60 bg-background/60 backdrop-blur-md",
        )}
      >
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground shadow-[0_0_18px_var(--glow)]">H.</span>
          <span className="font-display text-sm font-semibold tracking-wide">Hasib</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              to="/"
              hash={l.href}
              className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <Link to="/" hash="contact" className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">
            Let's Talk <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav aria-label="Mobile" className="mx-auto mt-2 flex max-w-3xl flex-col rounded-3xl border border-border bg-background/95 p-6 backdrop-blur-xl md:hidden">
          {links.map((l, i) => (
            <Link
              key={l.href}
              to="/"
              hash={l.href}
              onClick={() => setOpen(false)}
              className="flex items-baseline gap-4 border-b border-border py-4 font-display text-3xl tracking-tight last:border-0"
            >
              <span className="text-xs text-primary">0{i + 1}</span>
              {l.label}
            </Link>
          ))}
          <div className="mt-6 flex gap-6 text-sm text-muted-foreground">
            <a href={site.behance} target="_blank" rel="noreferrer">Behance ↗</a>
            <a href={site.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container-x py-16">
        {/* big CTA */}
        <div className="glow-card relative overflow-hidden px-8 py-14 text-center">
          <span aria-hidden className="sparkle absolute left-8 top-8 text-2xl">✦</span>
          <span aria-hidden className="sparkle absolute bottom-8 right-8 text-2xl">✦</span>
          <p className="eyebrow">Got a brand or a product story?</p>
          <p className="mt-4 font-display text-2xl font-semibold md:text-4xl">
            {site.email || "Let's talk about your next project"}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Reach me on{" "}
            <a className="text-hot hover:underline" href={site.behance} target="_blank" rel="noreferrer">Behance</a>
            {" · "}
            <a className="text-hot hover:underline" href={site.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          </p>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">H.</span>
              <div>
                <p className="font-display font-semibold">{site.name}</p>
                <p className="text-xs text-muted-foreground">{site.role}, made in {site.location} for teams worldwide.</p>
              </div>
            </div>
          </div>
          <nav aria-label="Footer" className="md:col-span-3">
            <p className="eyebrow !text-[10px]">Navigate</p>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {links.map((l) => (
                <li key={l.href}><Link to="/" hash={l.href} className="hover:text-foreground">{l.label}</Link></li>
              ))}
            </ul>
          </nav>
          <div className="md:col-span-2">
            <p className="eyebrow !text-[10px]">Elsewhere</p>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li><a href={site.behance} target="_blank" rel="noreferrer" className="hover:text-foreground">Behance ↗</a></li>
              <li><a href={site.linkedin} target="_blank" rel="noreferrer" className="hover:text-foreground">LinkedIn ↗</a></li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <p className="eyebrow !text-[10px]">Local time</p>
            <p className="mt-4 text-sm">Dhaka, Bangladesh</p>
            <p className="text-sm text-muted-foreground">GMT+6</p>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {site.name} · Designed & built in Dhaka</p>
          <a href="#" className="btn-ghost-pill !px-4 !py-2 text-xs">
            Back to top <ArrowUp className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
