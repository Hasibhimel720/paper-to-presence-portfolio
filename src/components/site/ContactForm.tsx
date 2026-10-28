import { useState, type FormEvent } from "react";
import { ArrowUpRight, Info } from "lucide-react";
import { site } from "@/data/portfolio";

type Errors = Partial<Record<"name" | "email" | "details", string>>;

const field =
  "w-full border-0 border-b border-input bg-transparent px-0 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-0 transition-colors";

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "unconfigured">("idle");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const next: Errors = {};
    const name = String(d.get("name") || "").trim();
    const email = String(d.get("email") || "").trim();
    const details = String(d.get("details") || "").trim();
    if (!name) next.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Please enter a valid email address.";
    if (details.length < 10) next.details = "Please share a few details about your project.";
    setErrors(next);
    if (Object.keys(next).length) return;
    // No delivery service is configured yet — be honest instead of faking success.
    setStatus("unconfigured");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
      <Field label="Name" error={errors.name}>
        <input name="name" autoComplete="name" className={field} placeholder="Your name" aria-invalid={!!errors.name} />
      </Field>
      <Field label="Email" error={errors.email}>
        <input name="email" type="email" autoComplete="email" className={field} placeholder="you@company.com" aria-invalid={!!errors.email} />
      </Field>
      <Field label="Company or Brand">
        <input name="company" className={field} placeholder="Optional" />
      </Field>
      <Field label="Project Type">
        <select name="type" className={field} defaultValue="">
          <option value="" disabled className="bg-surface">Select a type</option>
          {["Brand Identity", "Packaging Design", "Product Advertising", "Corporate Branding", "Motion & Visual Design", "Other"].map((o) => (
            <option key={o} className="bg-surface">{o}</option>
          ))}
        </select>
      </Field>
      <Field label="Estimated Timeline" className="sm:col-span-2">
        <select name="timeline" className={field} defaultValue="">
          <option value="" disabled className="bg-surface">Select a timeline</option>
          {["As soon as possible", "Within 1 month", "1–3 months", "Flexible"].map((o) => (
            <option key={o} className="bg-surface">{o}</option>
          ))}
        </select>
      </Field>
      <Field label="Project Details" error={errors.details} className="sm:col-span-2">
        <textarea name="details" rows={4} className={field + " resize-none"} placeholder="Tell me about your brand, product and goals" aria-invalid={!!errors.details} />
      </Field>
      <div className="sm:col-span-2 flex flex-col gap-5">
        <button
          type="submit"
          className="group inline-flex w-full sm:w-auto items-center justify-between gap-6 self-start bg-foreground px-7 py-4 text-sm font-medium text-background transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Send Project Inquiry
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </button>
        {status === "unconfigured" && (
          <div role="status" className="flex gap-3 border border-border bg-surface p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              <span className="text-foreground">Your message looks good, but it was not sent.</span> Online delivery isn't set up yet.
              Please reach out on{" "}
              <a className="underline hover:text-foreground" href={site.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
              {site.email && <> or email <a className="underline" href={`mailto:${site.email}`}>{site.email}</a></>} for now.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string | undefined; className?: string | undefined; children: React.ReactNode }) {
  return (
    <label className={"block " + (className ?? "")}>
      <span className="eyebrow">{label}</span>
      {children}
      {error && <span className="mt-2 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

