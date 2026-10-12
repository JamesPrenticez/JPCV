import { useState } from "react";
import styled from "styled-components";

export const Pills = styled.div`display: flex; flex-wrap: wrap; gap: 4px;`;
const Pill = styled.span`
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px 2px 4px; border-radius: 999px;
  border: 1px solid var(--line); background: var(--bg); color: var(--text); font-size: 12px; white-space: nowrap;
`;
// White backing so dark logos (git, github...) stay visible in dark mode.
const PillIcon = styled.img`width: 16px; height: 16px; padding: 1px; border-radius: 50%; background: #fff;`;
const Remove = styled.button`font: inherit; line-height: 1; color: var(--muted); background: none; border: 0; padding: 0; cursor: pointer;`;

// Seeds the form's autocomplete; anything already saved on a job is suggested too, and any free text is still allowed.
export const COMMON_TECH = [
  "TypeScript", "JavaScript", "React", "Next.js", "Node.js", "HTML", "CSS", "Sass", "Tailwind CSS", "Pixi.js", "Three.js", "Phaser", "Spine",
  "Unity", "Unreal Engine", "C#", "C++", "Python", "SQL", "PostgreSQL", "MongoDB", "Redis", "GraphQL", "REST", "Docker",
  "Kubernetes", "AWS", "Azure", "Git", "GitHub", "CI/CD", "Jest", "Playwright", "Vite", "Webpack", "Agile", "GDD",
];

// Icons are devicon SVGs; slug = lowercase name minus punctuation ("Pixi.js" -> pixijs). Names with no icon (e.g. "GDD") get 🏷️.
// ponytail: add to ICON_ALIAS when a name doesn't map to its devicon folder.
const ICON_ALIAS: Record<string, string> = {
  html: "html5", css: "css3", "c#": "csharp", "c++": "cplusplus", node: "nodejs", postgres: "postgresql", aws: "amazonwebservices",
};

/** A technology pill; passing `onRemove` adds a × button (used in the form). */
export function Tech({ name, onRemove }: { name: string; onRemove?: () => void }) {
  const [missing, setMissing] = useState(false);
  const lower = name.toLowerCase();
  const slug = ICON_ALIAS[lower] ?? lower.replace(/[^a-z0-9]/g, "");
  return (
    <Pill>
      {slug && !missing
        ? <PillIcon src={`https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${slug}/${slug}-original.svg`} alt="" onError={() => setMissing(true)} />
        : <span aria-hidden>🏷️</span>}
      {name}
      {onRemove && <Remove type="button" aria-label={`Remove ${name}`} onClick={onRemove}>×</Remove>}
    </Pill>
  );
}
