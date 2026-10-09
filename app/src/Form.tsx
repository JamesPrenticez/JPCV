import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import styled from "styled-components";
import { SOURCES, STATUSES, type Application, type Draft } from "../shared.ts";
import { Button } from "./styles.ts";

const Dialog = styled.dialog`
  width: min(640px, calc(100vw - 32px)); padding: 20px; border: 1px solid var(--line); border-radius: 10px;
  background: var(--card); color: var(--text);
  &::backdrop { background: rgb(0 0 0 / 0.5); }
  h2 { margin: 0 0 12px; font-size: 18px; }
  fieldset { border: 0; padding: 0; margin: 0 0 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  legend { padding: 0; margin-bottom: 8px; color: var(--muted); font-size: 12px; text-transform: uppercase; }
`;
const Label = styled.label<{ $wide?: boolean }>`
  display: grid; gap: 3px; font-size: 13px; color: var(--muted);
  ${(p) => p.$wide && "grid-column: 1 / -1;"}
  input, select, textarea { width: 100%; }
`;
const Actions = styled.div`display: flex; gap: 8px; justify-content: flex-end; button:first-child { margin-right: auto; }`;
const ErrorText = styled.p`color: var(--danger); margin: 0 0 12px;`;

type Props = {
  row: Draft;
  onSave: (row: Draft) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

// Mounted = open. App passes key={id} so each row gets a fresh uncontrolled form.
export default function Form({ row, onSave, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!ref.current?.open) ref.current?.showModal(); }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await onSave({ ...row, ...(Object.fromEntries(new FormData(e.currentTarget)) as Draft) });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async () => {
    if (!onDelete || !confirm(`Delete ${row.company}?`)) return;
    try { await onDelete(); } catch (err) { setError((err as Error).message); }
  };

  // Plain functions returning elements (not components), so a re-render doesn't remount the inputs and lose edits.
  const input = (
    label: string,
    name: keyof Application,
    { wide, ...rest }: InputHTMLAttributes<HTMLInputElement> & { wide?: boolean } = {},
  ) => (
    <Label $wide={wide}>
      {label}
      <input name={name} defaultValue={row[name] ?? ""} {...rest} />
    </Label>
  );
  const select = (label: string, name: keyof Application, options: readonly string[]) => (
    <Label>
      {label}
      <select name={name} defaultValue={row[name]}>{options.map((o) => <option key={o}>{o}</option>)}</select>
    </Label>
  );

  return (
    <Dialog ref={ref} onClose={onClose}>
      <form onSubmit={submit}>
        <h2>{row.id ? "Edit application" : "New application"}</h2>
        <fieldset>
          {input("Company *", "company", { required: true, wide: true })}
          {input("Role", "role", { wide: true })}
          {select("Source", "source", SOURCES)}
          {select("Status", "status", STATUSES)}
          {input("Date applied / contacted", "date_applied", { type: "date" })}
          {input("Follow up on", "follow_up_date", { type: "date" })}
          {input("Company page", "company_url", { type: "url", placeholder: "https://" })}
          {input("Job advert", "job_url", { type: "url", placeholder: "https://" })}
        </fieldset>
        <fieldset>
          <legend>Point of contact</legend>
          {input("Name", "contact_name")}
          {input("Role", "contact_role")}
          {input("Email", "contact_email", { type: "email" })}
          {input("Phone", "contact_phone", { type: "tel" })}
          {input("LinkedIn profile", "contact_linkedin", { type: "url", placeholder: "https://", wide: true })}
        </fieldset>
        <fieldset>
          <Label $wide>
            Notes
            <textarea name="notes" rows={3} defaultValue={row.notes ?? ""} />
          </Label>
        </fieldset>
        {error && <ErrorText role="alert">{error}</ErrorText>}
        <Actions>
          {onDelete ? <Button type="button" $danger onClick={remove}>Delete</Button> : <span />}
          <Button type="button" onClick={() => ref.current?.close()}>Cancel</Button>
          <Button type="submit" $primary>Save</Button>
        </Actions>
      </form>
    </Dialog>
  );
}
