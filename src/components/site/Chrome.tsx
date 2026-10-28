import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { site } from "@/data/portfolio";
import { cn } from "@/lib/utils";

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
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled || open ? "bg-background/85 backdrop-blur-md border-b border-border" : "border-b border-transparent",
      )}
    >
      <div className={cn("container-x flex items-center justify-between transition-all", scrolled ? "h-16" : "h-20")}>
        <Link to="/" className="group flex flex-col leading-none" onClick={() => setOpen(false)}>
          <span className="font-display text-base font-semibold tracking-[0.12em]">HASIB HIMEL</span>
          <span className="mt-1 hidden text-[9px] tracking-[0.24em] text-muted-foreground sm:block">BRAND IDENTITY & PRODUCT DESIGN</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link key={l.href} to="/" hash={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <Link
            to="/"
            hash="contact"
            className="inline-flex items-center gap-1.5 border border-foreground/30 px-4 py-2 text-sm transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            Let's Talk <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
        <button
          className="md:hidden -mr-2 p-2"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile" className="md:hidden h-[calc(100dvh-5rem)] container-x flex flex-col pt-8 pb-10">
          {links.map((l, i) => (
            <Link
              key={l.href}
              to="/"
              hash={l.href}
              onClick={() => setOpen(false)}
              className="flex items-baseline gap-4 border-b border-border py-5 font-display text-4xl tracking-tight"
            >
              <span className="text-xs text-muted-foreground">0{i + 1}</span>
              {l.label}
            </Link>
          ))}
          <div className="mt-auto flex gap-6 text-sm text-muted-foreground">
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
      <div className="container-x py-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-display text-3xl font-semibold tracking-[0.08em]">HASIB HIMEL</p>
            <p className="mt-2 text-sm text-muted-foreground">{site.role}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {["work", "services", "about", "contact"].map((h) => (
              <Link key={h} to="/" hash={h} className="capitalize hover:text-foreground">{h}</Link>
            ))}
            <a href={site.behance} target="_blank" rel="noreferrer" className="hover:text-foreground">Behance ↗</a>
            <a href={site.linkedin} target="_blank" rel="noreferrer" className="hover:text-foreground">LinkedIn ↗</a>
          </nav>
        </div>
        <p className="mt-12 text-xs text-muted-foreground">© {new Date().getFullYear()} Hasib Himel. All rights reserved.</p>
      </div>
    </footer>
  );
}
