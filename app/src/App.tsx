import { useEffect, useState, type ComponentProps } from "react";
import styled from "styled-components";
import { PRIORITIES, STATUSES, type Application, type Draft, type Priority, type Status } from "../shared.ts";
import * as api from "./api.ts";
import Form from "./Form.tsx";
import { Button, GlobalStyle } from "./styles.ts";

const COLORS: Record<Status, string> = {
  Saved: "#8892a6", Contacted: "#3b82f6", Applied: "#8b5cf6",
  Interview: "#f59e0b", Offer: "#22c55e", Rejected: "#ef4444",
};
const PRIORITY_COLORS: Record<Priority, string> = { High: "#22c55e", Medium: "#f59e0b", Low: "#ef4444" }; // green = go after it
const CLOSED: Status[] = ["Offer", "Rejected"];

// Derived from id, not stored. Golden-angle hue keeps consecutive ids far apart on the colour wheel.
// ponytail: not user-pickable; add color/emoji columns to applications if you want to choose your own.
const EMOJIS = ["🚀", "🦊", "🌵", "🐙", "🍉", "🎯", "🦄", "🔥", "🌊", "🍀", "🎸", "🦉", "🍕", "🌈", "🐳", "⚡"];
const hue = (id: number) => Math.round(id * 137.508) % 360;

const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const fmt = (d: string) =>
  d ? new Date(`${d}T00:00`).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "";

const Page = styled.main`max-width: 1200px; margin: 0 auto; padding: 24px 16px;`;
const Top = styled.header`display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px;
  h1 { margin: 0; font-size: 22px; }`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;`;
const Chip = styled(Button)<{ $on?: boolean }>`
  border-radius: 999px; padding: 4px 12px;
  ${(p) => p.$on && "background: var(--text); color: var(--bg); border-color: var(--text);"}
`;
const SortBtn = styled.button`font: inherit; color: inherit; text-transform: inherit; background: none; border: 0; padding: 0; cursor: pointer;`;
const Card = styled.div`background: var(--card); border: 1px solid var(--line); border-radius: 8px; overflow-x: auto;`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; min-width: 860px;
  th { text-align: left; color: var(--muted); font-weight: 500; font-size: 12px; text-transform: uppercase; }
  th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
`;
const Company = styled.td<{ $hue: number }>`
  border-left: 4px solid hsl(${(p) => p.$hue} 65% 55%);
  background: hsl(${(p) => p.$hue} 65% 55% / 0.1);
`;
const Muted = styled.div`color: var(--muted); font-size: 13px;`;
const Links = styled.div`display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px;`;
const Late = styled.span<{ $late?: boolean }>`${(p) => p.$late && "color: var(--danger); font-weight: 600;"}`;
const ColorSelect = styled.select<{ $c: string }>`
  border-color: transparent; font-weight: 500; cursor: pointer;
  background: color-mix(in srgb, ${(p) => p.$c} 16%, var(--card));
  color: color-mix(in srgb, ${(p) => p.$c} 70%, var(--text));
`;
const Dot = styled.span<{ $c: string }>`
  display: inline-block; width: 10px; height: 10px; margin-right: 8px; border-radius: 50%; vertical-align: middle;
  background: ${(p) => p.$c};
`;
const ErrorText = styled.p`color: var(--danger);`;

const Ext = (props: ComponentProps<"a">) => <a target="_blank" rel="noreferrer" {...props} />;

export default function App() {
  const [rows, setRows] = useState<Application[]>([]);
  const [filter, setFilter] = useState<"All" | Status>("All");
  const [prio, setPrio] = useState<"All" | Priority>("All");
  const [sort, setSort] = useState<{ key: "priority" | "status"; desc: boolean } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null); // null = closed, object = form open (no id = new)
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

  // Sorts by position in PRIORITIES / STATUSES; stable, so ties keep the server's order. null = server order.
  const byPrio = prio === "All" ? rows : rows.filter((r) => r.priority === prio);
  const shown = filter === "All" ? [...byPrio] : byPrio.filter((r) => r.status === filter);
  if (sort) {
    const order: readonly string[] = sort.key === "priority" ? PRIORITIES : STATUSES;
    shown.sort((a, b) => (order.indexOf(a[sort.key]) - order.indexOf(b[sort.key])) * (sort.desc ? -1 : 1));
  }
  const count = (s: "All" | Status) => (s === "All" ? byPrio : byPrio.filter((r) => r.status === s)).length;
  const editingId = editing?.id;

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
        <Button $primary onClick={() => setEditing({ priority: "Medium", source: "LinkedIn", status: "Contacted", date_applied: today })}>
          + Add
        </Button>
      </Top>

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

      {error && <ErrorText role="alert">{error}</ErrorText>}

      <Card>
        <Table>
          <thead>
            <tr>
              {sortTh("priority", "Priority")}<th>Company</th><th>Source</th>{sortTh("status", "Status")}<th>Applied</th><th>Follow up</th><th>Contact</th><th />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <Dot $c={PRIORITY_COLORS[r.priority]} aria-hidden />
                  <ColorSelect $c={PRIORITY_COLORS[r.priority]} value={r.priority} aria-label={`Priority for ${r.company}`}
                    onChange={(e) => patch(r, { priority: e.target.value as Priority })}>
                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </ColorSelect>
                </td>
                <Company $hue={hue(r.id)}>
                  <span aria-hidden>{EMOJIS[r.id % EMOJIS.length]}</span> <strong>{r.company}</strong>
                  <div>{[r.role_level, r.role_type].filter(Boolean).join(" ")}</div>
                  <Links>
                    {r.company_url && <Ext href={r.company_url}>Company page</Ext>}
                    {r.job_url && <Ext href={r.job_url}>Job advert</Ext>}
                  </Links>
                </Company>
                <td>{r.source}</td>
                <td>
                  <Dot $c={COLORS[r.status]} aria-hidden />
                  <ColorSelect $c={COLORS[r.status]} value={r.status} aria-label={`Status for ${r.company}`}
                    onChange={(e) => patch(r, { status: e.target.value as Status })}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </ColorSelect>
                </td>
                <td>{fmt(r.date_applied)}</td>
                <td><Late $late={!!r.follow_up_date && r.follow_up_date <= today && !CLOSED.includes(r.status)}>{fmt(r.follow_up_date)}</Late></td>
                <td>
                  {r.contact_name && <div>{r.contact_name}</div>}
                  {r.contact_role && <Muted>{r.contact_role}</Muted>}
                  <Links>
                    {r.contact_linkedin && <Ext href={r.contact_linkedin}>LinkedIn</Ext>}
                    {r.contact_email && <a href={`mailto:${r.contact_email}`}>{r.contact_email}</a>}
                    {r.contact_phone && <a href={`tel:${r.contact_phone}`}>{r.contact_phone}</a>}
                  </Links>
                </td>
                <td><Button onClick={() => setEditing(r)}>Edit</Button></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={8}><Muted>Nothing here yet.</Muted></td></tr>}
          </tbody>
        </Table>
      </Card>

      {editing && (
        <Form key={editingId ?? "new"} row={editing} onSave={save}
          onDelete={editingId ? () => del(editingId) : undefined} onClose={() => setEditing(null)} />
      )}
    </Page>
  );
}
