import { useState, type FormEvent } from "react";
import { ArrowUpRight, Info, Mail } from "lucide-react";
import { site } from "@/data/portfolio";

type Errors = Partial<Record<"name" | "email", string>>;

const projectTypes = ["a brand identity", "packaging design", "product advertising", "corporate branding", "motion design", "something else"];
const timelines = ["as soon as possible", "within a month", "in 1–3 months", "flexible"];

/** Fill-in-the-blanks brief: builds a ready-to-send message from the visitor's answers. */
export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "unconfigured">("idle");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const next: Errors = {};
    const name = String(d.get("name") || "").trim();
    const email = String(d.get("email") || "").trim();
    if (!name) next.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Please enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const brief = [
      `Hi Hasib, I'm ${name} from ${String(d.get("company") || "").trim() || "—"}.`,
      `We need ${d.get("type")} and we'd like it ${d.get("timeline")}.`,
      `Reach me at ${email}.`,
      String(d.get("extra") || "").trim() ? `\nMore details:\n${String(d.get("extra")).trim()}` : "",
    ].join("\n");

    if (site.email) {
      window.location.href = `mailto:${site.email}?subject=${encodeURIComponent("Project brief from " + name)}&body=${encodeURIComponent(brief)}`;
    } else {
      // No delivery address is configured yet — be honest instead of faking success.
      setStatus("unconfigured");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="eyebrow !text-[10px]">Your brief</p>
      <p className="mt-4 text-lg leading-[2.4] md:text-xl md:leading-[2.4]">
        Hi Hasib, I'm{" "}
        <input name="name" autoComplete="name" className="brief-line w-36" placeholder="your name" aria-invalid={!!errors.name} aria-label="Your name" />{" "}
        from{" "}
        <input name="company" className="brief-line w-32" placeholder="company" aria-label="Company" />. We need{" "}
        <select name="type" className="brief-line cursor-pointer" defaultValue={projectTypes[0]} aria-label="Project type">
          {projectTypes.map((o) => <option key={o} className="bg-surface text-foreground">{o}</option>)}
        </select>{" "}
        and we'd like it{" "}
        <select name="timeline" className="brief-line cursor-pointer" defaultValue={timelines[1]} aria-label="Timeline">
          {timelines.map((o) => <option key={o} className="bg-surface text-foreground">{o}</option>)}
        </select>. Reach me at{" "}
        <input name="email" type="email" autoComplete="email" className="brief-line w-48" placeholder="you@company.com" aria-invalid={!!errors.email} aria-label="Your email" />.
      </p>
      {(errors.name || errors.email) && (
        <p className="mt-3 text-xs text-destructive">{errors.name ?? errors.email}</p>
      )}

      <label className="mt-8 block">
        <span className="eyebrow !text-[10px]">Anything else? (optional)</span>
        <textarea
          name="extra"
          rows={3}
          className="mt-3 w-full resize-none rounded-xl border border-input bg-background/50 p-4 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          placeholder="Links, budget, the problem you're solving…"
        />
      </label>

      <div className="mt-8 flex flex-col gap-3">
        <button type="submit" className="btn-glow w-full justify-center">
          <Mail className="h-4 w-4" /> Send by email
        </button>
        {status === "unconfigured" && (
          <div role="status" className="flex gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              <span className="text-foreground">Your brief looks good, but it was not sent.</span> Email delivery isn't set up yet —
              please reach out on{" "}
              <a className="underline hover:text-foreground" href={site.linkedin} target="_blank" rel="noreferrer">LinkedIn</a> for now.
            </p>
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Your email app opens with the brief already written. Just press send. <ArrowUpRight className="inline h-3 w-3" />
        </p>
      </div>
    </form>
  );
}
