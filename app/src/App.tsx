import { useEffect, useRef, useState, type ComponentProps } from "react";
import styled from "styled-components";
import { APPROACHES, PRIORITIES, STATUSES, type Application, type Approach, type Doc, type Draft, type Location, type Priority, type Status } from "../shared.ts";
import * as api from "./api.ts";
import Form from "./Form.tsx";
import { Button, GlobalStyle } from "./styles.ts";
import { COMMON_TECH, Pills, Tech } from "./Tech.tsx";

const COLORS: Record<Status, string> = {
  Saved: "#8892a6", Contacted: "#3b82f6", Applied: "#8b5cf6",
  Interview: "#f59e0b", Offer: "#22c55e", Rejected: "#ef4444",
};
const PRIORITY_COLORS: Record<Priority, string> = { High: "#22c55e", Medium: "#f59e0b", Low: "#ef4444" }; // green = go after it
const APPROACH_ICONS: Record<Approach, string> = { Advertised: "🔥", "Cold approach": "❄️" }; // hot = live advert
const CLOSED: Status[] = ["Offer", "Rejected"];
// ISO codes for flagcdn.com images: Windows has no flag emoji glyphs (they render as "NZ"). Remote isn't a country, so it gets 🌐.
const FLAGS: Record<Location, string> = { "New Zealand": "nz", Australia: "au", "United Kingdom": "gb", "United States": "us", Poland: "pl", Sweden: "se", Gibraltar: "gi", Spain: "es", Romania: "ro", Moldova: "md", Europe: "eu", Remote: "" };

// Derived from id, not stored. Golden-angle hue keeps consecutive ids far apart on the colour wheel.
// ponytail: not user-pickable; add color/emoji columns to applications if you want to choose your own.
const EMOJIS = ["🚀", "🦊", "🌵", "🐙", "🍉", "🎯", "🦄", "🔥", "🌊", "🍀", "🎸", "🦉", "🍕", "🌈", "🐳", "⚡"];
const hue = (id: number) => Math.round(id * 137.508) % 360;

const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const fmt = (d: string) =>
  d ? new Date(`${d}T00:00`).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "";

const Page = styled.main`max-width: 1600px; margin: 0 auto; padding: 24px 16px;`;
const Top = styled.header`display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px;
  h1 { margin: 0; font-size: 22px; }`;
const Search = styled.input`width: 280px; max-width: 100%; margin-bottom: 16px;`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;`;
const Chip = styled(Button)<{ $on?: boolean }>`
  border-radius: 999px; padding: 4px 12px;
  ${(p) => p.$on && "background: var(--text); color: var(--bg); border-color: var(--text);"}
`;
const SortBtn = styled.button`font: inherit; color: inherit; text-transform: inherit; background: none; border: 0; padding: 0; cursor: pointer;`;
const Card = styled.div`background: var(--card); border: 1px solid var(--line); border-radius: 8px; overflow-x: auto;`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; min-width: 1200px;
  th { text-align: left; color: var(--muted); font-weight: 500; font-size: 12px; text-transform: uppercase; }
  th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
`;
const Company = styled.td<{ $hue: number }>`
  border-left: 4px solid hsl(${(p) => p.$hue} 65% 55%);
`;
const Muted = styled.div`color: var(--muted); font-size: 13px;`;
const FlagImg = styled.img`height: 12px; vertical-align: -1px; margin-right: 6px; border-radius: 2px;`;
const Person = styled.div`& + & { margin-top: 8px; }`;
const Links = styled.div`display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px;`;
const Late = styled.span<{ $late?: boolean }>`${(p) => p.$late && "color: var(--danger); font-weight: 600;"}`;
const Dot = styled.span<{ $c: string }>`
  display: inline-block; width: 10px; height: 10px; margin-right: 8px; border-radius: 50%; vertical-align: middle;
  background: ${(p) => p.$c};
`;
const DotBtn = styled.button<{ $c: string }>`
  width: 18px; height: 18px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; background: ${(p) => p.$c};
`;
// Native popover: top layer (escapes the table's overflow clip), closes on outside click / Esc. Positioned by hand since it has no anchor.
const Menu = styled.div`
  margin: 0; padding: 4px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--text);
  button { display: flex; align-items: center; width: 100%; font: inherit; color: inherit; background: none; border: 0; padding: 6px 10px; border-radius: 4px; cursor: pointer; text-align: left; }
  button:hover { background: var(--bg); }
`;
const ErrorText = styled.p`color: var(--danger);`;
// An A4 page is 794px wide at 96dpi; a bit more leaves room for the page margin.
const Viewer = styled.dialog`
  width: min(860px, calc(100vw - 32px)); height: calc(100vh - 32px); max-height: none; padding: 12px; border: 1px solid var(--line); border-radius: 10px;
  background: var(--card); color: var(--text); flex-direction: column; gap: 8px;
  &[open] { display: flex; }
  &::backdrop { background: rgb(0 0 0 / 0.5); }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  iframe { flex: 1; width: 100%; border: 1px solid var(--line); background: #fff; }
`;
const TechCell = styled(Pills)`max-width: 260px;`;

const Ext = (props: ComponentProps<"a">) => <a target="_blank" rel="noreferrer" {...props} />;

function DotPicker<T extends string>({ value, options, colors, label, onPick }:
  { value: T; options: readonly T[]; colors: Record<T, string>; label: string; onPick: (v: T) => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const open = () => {
    const r = btn.current!.getBoundingClientRect();
    Object.assign(menu.current!.style, { top: `${r.bottom + 4}px`, left: `${r.left}px` });
    menu.current!.togglePopover();
  };
  return (
    <>
      <DotBtn ref={btn} $c={colors[value]} title={value} aria-label={`${label}: ${value}`} onClick={open} />
      <Menu ref={menu} popover="auto">
        {options.map((o) => (
          <button key={o} onClick={() => { menu.current!.hidePopover(); if (o !== value) onPick(o); }}>
            <Dot $c={colors[o]} aria-hidden />{o}
          </button>
        ))}
      </Menu>
    </>
  );
}

// What each saved document is called, which file you edit, and which flag says a copy exists.
const DOCS: Record<Doc, { label: string; live: string; has: (r: Application) => boolean }> = {
  cv: { label: "CV", live: "cv/index.html", has: (r) => r.has_cv },
  "cover-letter": { label: "Cover letter", live: "cv/cover-letter.md", has: (r) => r.has_cover_letter },
};

// Shows the CV or cover letter saved for one application. Mounted = open (same pattern as Form). Sandboxed: it's a document, it never needs to run scripts.
function DocViewer({ row, doc, onClose }: { row: Application; doc: Doc; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!ref.current?.open) ref.current?.showModal(); }, []);
  return (
    <Viewer ref={ref} onClose={onClose}>
      <header>
        <div>
          <strong>{row.company}: {DOCS[doc].label} as saved</strong>
          {doc === "cv" && <Muted>Styling and images come from the CV dev server (pnpm dev in cv/).</Muted>}
        </div>
        <Button onClick={() => ref.current?.close()}>Close</Button>
      </header>
      <iframe sandbox="" src={`/api/applications/${row.id}/${doc}`} title={`${DOCS[doc].label} saved for ${row.company}`} />
    </Viewer>
  );
}

export default function App() {
  const [rows, setRows] = useState<Application[]>([]);
  const [filter, setFilter] = useState<"All" | Status>("All");
  const [prio, setPrio] = useState<"All" | Priority>("All");
  const [appr, setAppr] = useState<"All" | Approach>("All");
  const [sort, setSort] = useState<{ key: "priority" | "status"; desc: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null); // null = closed, object = form open (no id = new)
  const [viewing, setViewing] = useState<{ row: Application; doc: Doc } | null>(null);
  const [error, setError] = useState("");

  const reload = async () => setRows(await api.list());
  useEffect(() => { reload().catch((e: Error) => setError(e.message)); }, []);

  // save/del throw on failure so the form can show the message and stay open.
  const save = async (row: Draft) => {
    await (row.id ? api.update(row.id, row) : api.create(row));
    await reload();
    setEditing(null);
  };
  const del = async (id: number) => {
    await api.remove(id);
    await reload();
    setEditing(null);
  };
  const patch = (row: Application, change: Partial<Application>) =>
    api.update(row.id, { ...row, ...change }).then(reload).then(() => setError(""), (e: Error) => setError(e.message));
  // The CV and cover letter are the files cv/index.html and cv/cover-letter.md: "save" pins current contents to this application, "restore" copies them back.
  const saveDoc = (r: Application, doc: Doc) =>
    (!DOCS[doc].has(r) || confirm(`Overwrite ${r.company}'s saved ${DOCS[doc].label} with the current ${DOCS[doc].live}?`)) &&
    api.saveDoc(r.id, doc).then(reload).then(() => setError(""), (e: Error) => setError(e.message));
  const restoreDoc = (r: Application, doc: Doc) =>
    confirm(`Replace ${DOCS[doc].live} with the ${DOCS[doc].label} saved for ${r.company}? The current one is kept as _previous in the same folder.`) &&
    api.restoreDoc(r.id, doc).then(() => setError(""), (e: Error) => setError(e.message));

  // Sorts by position in PRIORITIES / STATUSES; stable, so ties keep the server's order. null = server order.
  const q = query.trim().toLowerCase();
  const base = rows.filter((r) => (prio === "All" || r.priority === prio) && (appr === "All" || r.approach === appr) && r.company.toLowerCase().includes(q));
  const shown = filter === "All" ? [...base] : base.filter((r) => r.status === filter);
  if (sort) {
    const order: readonly string[] = sort.key === "priority" ? PRIORITIES : STATUSES;
    shown.sort((a, b) => (order.indexOf(a[sort.key]) - order.indexOf(b[sort.key])) * (sort.desc ? -1 : 1));
  }
  const count = (s: "All" | Status) => (s === "All" ? base : base.filter((r) => r.status === s)).length;
  const editingId = editing?.id;
  // Seed list plus everything already saved; one entry per name (case-insensitive), saved spelling wins.
  const suggestions = [...new Map([...COMMON_TECH, ...rows.flatMap((r) => r.technologies)].map((t) => [t.toLowerCase(), t])).values()];

  const sortTh = (key: "priority" | "status", label: string) => (
    <th aria-sort={sort?.key === key ? (sort.desc ? "descending" : "ascending") : undefined}>
      <SortBtn onClick={() => setSort({ key, desc: sort?.key === key && !sort.desc })}>
        {label}{sort?.key === key && (sort.desc ? " ▼" : " ▲")}
      </SortBtn>
    </th>
  );

  return (
    <Page>
      <GlobalStyle />
      <Top>
        <h1>Job Tracker</h1>
        <Button $primary onClick={() => setEditing({ priority: "Medium", source: "LinkedIn", status: "Saved", approach: "Advertised", date_applied: today })}>
          + Add
        </Button>
      </Top>

      <Search type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies…" aria-label="Search companies" />
      <Chips>
        {(["All", ...STATUSES] as const).map((s) => (
          <Chip key={s} $on={filter === s} onClick={() => setFilter(s)}>
            {s} {count(s)}
          </Chip>
        ))}
      </Chips>
      <Chips>
        {(["All", ...PRIORITIES] as const).map((p) => (
          <Chip key={p} $on={prio === p} onClick={() => setPrio(p)}>
            {p === "All" ? "Any priority" : p}
          </Chip>
        ))}
      </Chips>
      <Chips>
        {(["All", ...APPROACHES] as const).map((a) => (
          <Chip key={a} $on={appr === a} onClick={() => setAppr(a)}>
            {a === "All" ? "Any approach" : `${APPROACH_ICONS[a]} ${a}`}
          </Chip>
        ))}
      </Chips>

      {error && <ErrorText role="alert">{error}</ErrorText>}

      <Card>
        <Table>
          <thead>
            <tr>
              {sortTh("priority", "Priority")}<th>Company</th><th>Technologies</th><th>Location</th><th>Source</th>{sortTh("status", "Status")}<th>Approach</th><th>Applied</th><th>Follow up</th><th>Contact</th><th>CV</th><th>Cover letter</th><th />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <DotPicker value={r.priority} options={PRIORITIES} colors={PRIORITY_COLORS} label={`Priority for ${r.company}`}
                    onPick={(priority) => patch(r, { priority })} />
                </td>
                <Company $hue={hue(r.id)}>
                  <span aria-hidden>{EMOJIS[r.id % EMOJIS.length]}</span> <strong>{r.company}</strong>
                  <div>{[r.role_level, r.role_type].filter(Boolean).join(" ")}</div>
                  <Links>
                    {r.company_url && <Ext href={r.company_url}>Company page</Ext>}
                    {r.job_url && <Ext href={r.job_url}>Job advert</Ext>}
                  </Links>
                </Company>
                <td><TechCell>{r.technologies.map((t) => <Tech key={t} name={t} />)}</TechCell></td>
                <td>
                  {r.location && (
                    <>
                      {FLAGS[r.location] ? <FlagImg src={`https://flagcdn.com/h24/${FLAGS[r.location]}.png`} alt="" /> : <span aria-hidden>🌐 </span>}
                      {r.location}
                    </>
                  )}
                </td>
                <td>{r.source}</td>
                <td>
                  <DotPicker value={r.status} options={STATUSES} colors={COLORS} label={`Status for ${r.company}`}
                    onPick={(status) => patch(r, { status })} />
                </td>
                <td><span role="img" title={r.approach} aria-label={r.approach}>{APPROACH_ICONS[r.approach]}</span></td>
                <td>{fmt(r.date_applied)}</td>
                <td><Late $late={!!r.follow_up_date && r.follow_up_date <= today && !CLOSED.includes(r.status)}>{fmt(r.follow_up_date)}</Late></td>
                <td>
                  {r.contacts.map((c, i) => (
                    <Person key={i}>
                      {c.name && <div>{c.name}</div>}
                      {c.role && <Muted>{c.role}</Muted>}
                      <Links>
                        {c.linkedin && <Ext href={c.linkedin}>LinkedIn</Ext>}
                        {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                        {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}
                      </Links>
                    </Person>
                  ))}
                </td>
                {(Object.keys(DOCS) as Doc[]).map((doc) => (
                  <td key={doc}>
                    <Links>
                      {DOCS[doc].has(r) && <Button onClick={() => setViewing({ row: r, doc })}>View</Button>}
                      {DOCS[doc].has(r) && <Button onClick={() => restoreDoc(r, doc)}>Restore</Button>}
                      <Button onClick={() => saveDoc(r, doc)}>{DOCS[doc].has(r) ? "Re-save" : "Save"}</Button>
                    </Links>
                  </td>
                ))}
                <td><Button onClick={() => setEditing(r)}>Edit</Button></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={13}><Muted>Nothing here yet.</Muted></td></tr>}
          </tbody>
        </Table>
      </Card>

      {viewing && <DocViewer {...viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <Form key={editingId ?? "new"} row={editing} suggestions={suggestions} onSave={save}
          onDelete={editingId ? () => del(editingId) : undefined} onClose={() => setEditing(null)} />
      )}
    </Page>
  );
}
