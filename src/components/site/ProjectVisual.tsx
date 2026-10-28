import type { Project, Tone } from "@/data/portfolio";
import { cn } from "@/lib/utils";

const toneBg: Record<Tone, string> = {
  tea: "bg-tone-tea",
  ghee: "bg-tone-ghee",
  black: "bg-tone-black",
  lentil: "bg-tone-lentil",
  steel: "bg-tone-steel",
  gold: "bg-tone-gold",
  ink: "bg-tone-ink",
  motion: "bg-tone-motion",
};

type Props = {
  project: Pick<Project, "title" | "tone" | "cover" | "placeholder" | "category">;
  label?: string;
  className?: string;
  zoom?: boolean;
};

/** Shows the real project image when `cover` is set; otherwise a clearly-labelled placeholder. */
export function ProjectVisual({ project, label, className, zoom }: Props) {
  if (project.cover) {
    return (
      <div className={cn("relative overflow-hidden bg-surface", className)}>
        <img
          src={project.cover}
          alt={`${project.title} — ${project.category}`}
          loading="lazy"
          className={cn("h-full w-full object-cover transition-transform duration-[1.2s] ease-out", zoom && "group-hover:scale-[1.04]")}
        />
      </div>
    );
  }
  const isPack = project.category === "Packaging Design";
  return (
    <div className={cn("relative isolate overflow-hidden", toneBg[project.tone], className)}>
      <div className="absolute inset-0 grid-lines opacity-60" />
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-transform duration-[1.2s] ease-out",
          zoom && "group-hover:scale-[1.05]",
        )}
      >
        {isPack ? (
          <div className="flex items-end gap-[3%] h-[48%]">
            <div className="h-[78%] aspect-[3/5] rounded-sm bg-background/25 border border-foreground/20 shadow-2xl" />
            <div className="h-full aspect-[3/5] rounded-sm bg-background/40 border border-foreground/25 shadow-2xl flex flex-col justify-center px-[8%]">
              <span className="h-[3px] w-1/2 bg-foreground/70" />
              <span className="mt-2 h-[2px] w-3/4 bg-foreground/40" />
            </div>
            <div className="h-[60%] aspect-square rounded-full bg-background/25 border border-foreground/20 shadow-2xl" />
          </div>
        ) : (
          <span className="font-display font-semibold text-foreground/85 text-[clamp(2.5rem,9vw,7rem)] leading-none tracking-tighter">
            {project.title.split(" ").map((w) => w[0]).join("").slice(0, 2)}
          </span>
        )}
      </div>
      <div className="absolute left-3 bottom-3 right-3 flex">
        <span className="max-w-full truncate rounded-sm bg-background/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
          Placeholder · {label ?? project.placeholder}
        </span>
      </div>
    </div>
  );
}
