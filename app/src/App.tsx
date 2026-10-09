import { useEffect, useState, type ComponentProps } from "react";
import styled from "styled-components";
import { STATUSES, type Application, type Draft, type Status } from "../shared.ts";
import * as api from "./api.ts";
import Form from "./Form.tsx";
import { Button, GlobalStyle } from "./styles.ts";

const COLORS: Record<Status, string> = {
  Saved: "#8892a6", Contacted: "#3b82f6", Applied: "#8b5cf6",
  Interview: "#f59e0b", Offer: "#22c55e", Rejected: "#ef4444",
};
const CLOSED: Status[] = ["Offer", "Rejected"];

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
const Card = styled.div`background: var(--card); border: 1px solid var(--line); border-radius: 8px; overflow-x: auto;`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; min-width: 860px;
  th { text-align: left; color: var(--muted); font-weight: 500; font-size: 12px; text-transform: uppercase; }
  th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
`;
const Muted = styled.div`color: var(--muted); font-size: 13px;`;
const Links = styled.div`display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px;`;
const Late = styled.span<{ $late?: boolean }>`${(p) => p.$late && "color: var(--danger); font-weight: 600;"}`;
const StatusSelect = styled.select<{ $s: Status }>`
  border-color: transparent; font-weight: 500; cursor: pointer;
  background: color-mix(in srgb, ${(p) => COLORS[p.$s]} 16%, var(--card));
  color: color-mix(in srgb, ${(p) => COLORS[p.$s]} 70%, var(--text));
`;
const ErrorText = styled.p`color: var(--danger);`;

const Ext = (props: ComponentProps<"a">) => <a target="_blank" rel="noreferrer" {...props} />;

export default function App() {
  const [rows, setRows] = useState<Application[]>([]);
  const [filter, setFilter] = useState<"All" | Status>("All");
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
  const setStatus = (row: Application, status: Status) =>
    api.update(row.id, { ...row, status }).then(reload).then(() => setError(""), (e: Error) => setError(e.message));

  const shown = filter === "All" ? rows : rows.filter((r) => r.status === filter);
  const count = (s: "All" | Status) => (s === "All" ? rows : rows.filter((r) => r.status === s)).length;
  const editingId = editing?.id;

  return (
    <Page>
      <GlobalStyle />
      <Top>
        <h1>Job Tracker</h1>
        <Button $primary onClick={() => setEditing({ source: "LinkedIn", status: "Contacted", date_applied: today })}>
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

      {error && <ErrorText role="alert">{error}</ErrorText>}

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Company</th><th>Source</th><th>Status</th><th>Applied</th><th>Follow up</th><th>Contact</th><th />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.company}</strong>
                  {r.role && <div>{r.role}</div>}
                  <Links>
                    {r.company_url && <Ext href={r.company_url}>Company page</Ext>}
                    {r.job_url && <Ext href={r.job_url}>Job advert</Ext>}
                  </Links>
                </td>
                <td>{r.source}</td>
                <td>
                  <StatusSelect $s={r.status} value={r.status} aria-label={`Status for ${r.company}`}
                    onChange={(e) => setStatus(r, e.target.value as Status)}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </StatusSelect>
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
            {!shown.length && <tr><td colSpan={7}><Muted>Nothing here yet.</Muted></td></tr>}
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
