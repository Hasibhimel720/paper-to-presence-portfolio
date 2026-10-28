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
  label?: string | undefined;
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
    <div className={cn("project-preview relative isolate overflow-hidden", toneBg[project.tone], className)}>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-transform duration-[1.2s] ease-out",
          zoom && "group-hover:scale-[1.05]",
        )}
      >
        {isPack ? (
          <div className="flex w-full items-center justify-center gap-[5%]">
            <div className="preview-pack"><span className="text-3xl">✳</span><span className="preview-pack-name">{project.title}</span><span className="text-[8px] uppercase">Packaging study</span></div>
            <div className="preview-pack"><span className="text-3xl">✳</span><span className="preview-pack-name">{project.title}</span><span className="text-[8px] uppercase">Packaging study</span></div>
          </div>
        ) : (
          <span className="preview-wordmark font-display">
            <span className="preview-symbol">{project.tone === "steel" ? "↗" : "✳"}</span>
            {project.title}
          </span>
        )}
      </div>
      <div className="absolute left-3 bottom-3 right-3 flex">
        <span className="max-w-full truncate rounded-sm bg-background/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
          Illustrative preview · {label ?? "Original artwork pending"}
        </span>
      </div>
    </div>
  );
}
