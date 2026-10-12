import { Fragment, useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import styled from "styled-components";
import { APPROACHES, LEVELS, LOCATIONS, ROLE_TYPES, SOURCES, STATUSES, type Application, type Contact, type Draft } from "../shared.ts";
import { Button } from "./styles.ts";
import { Pills, Tech } from "./Tech.tsx";

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
const Wide = styled.div`grid-column: 1 / -1;`;
const Rule = styled(Wide)`padding-bottom: 10px; border-bottom: 1px solid var(--line);`;

const BLANK: Contact = { name: "", role: "", email: "", phone: "", linkedin: "" };
type Field = Exclude<keyof Application, "contacts">; // the plain inputs; contacts have their own list below

// Type to autocomplete (native datalist); Enter, comma, picking a suggestion or leaving the field turns the text into a pill.
// The list travels with the form as a hidden comma-joined "technologies" field, which is what the server parses.
function TechInput({ initial, suggestions }: { initial: string[]; suggestions: string[] }) {
  const [techs, setTechs] = useState(initial);
  const [text, setText] = useState("");

  const add = (names: string[]) => {
    const next = [...techs];
    for (const n of names.map((s) => s.trim()).filter(Boolean)) {
      if (!next.some((t) => t.toLowerCase() === n.toLowerCase())) next.push(n);
    }
    setTechs(next);
    setText("");
  };

  return (
    // A div, not a <label>: a label would "click" the first pill's × when its text is clicked.
    <Label as="div" $wide>
      Technologies in the advert
      {techs.length > 0 && (
        <Pills>{techs.map((t) => <Tech key={t} name={t} onRemove={() => setTechs(techs.filter((x) => x !== t))} />)}</Pills>
      )}
      <input type="hidden" name="technologies" value={techs.join(",")} />
      <input
        list="tech-suggestions" value={text} aria-label="Technologies in the advert"
        placeholder="Start typing, Enter to add (TypeScript, Pixi.js, GDD…)"
        onChange={(e) => {
          // Picking a datalist option fires a replacement/untyped input event, unlike normal typing.
          const type = (e.nativeEvent as InputEvent).inputType;
          const parts = e.target.value.split(",");
          if (type === undefined || type === "insertReplacementText" || parts.length > 1) add(parts);
          else setText(e.target.value);
        }}
        onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { e.preventDefault(); add([text]); } }}
        onBlur={() => add([text])}
      />
      <datalist id="tech-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
    </Label>
  );
}

type Props = {
  row: Draft;
  suggestions: string[];
  onSave: (row: Draft) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

// Mounted = open. App passes key={id} so each row gets a fresh uncontrolled form.
export default function Form({ row, suggestions, onSave, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [contacts, setContacts] = useState<Contact[]>(row.contacts?.length ? row.contacts : [BLANK]); // blank ones are dropped on save
  useEffect(() => { if (!ref.current?.open) ref.current?.showModal(); }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await onSave({ ...row, ...(Object.fromEntries(new FormData(e.currentTarget)) as Draft), contacts });
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
    name: Field,
    { wide, ...rest }: InputHTMLAttributes<HTMLInputElement> & { wide?: boolean } = {},
  ) => (
    <Label $wide={wide}>
      {label}
      <input name={name} defaultValue={row[name] ?? ""} {...rest} />
    </Label>
  );
  // Controlled and nameless, so FormData ignores them; the whole list goes up via `contacts` state instead.
  const contactInput = (
    i: number,
    label: string,
    key: keyof Contact,
    { wide, ...rest }: InputHTMLAttributes<HTMLInputElement> & { wide?: boolean } = {},
  ) => (
    <Label $wide={wide}>
      {label}
      <input value={contacts[i][key]} onChange={(e) => setContacts(contacts.map((c, j) => (j === i ? { ...c, [key]: e.target.value } : c)))} {...rest} />
    </Label>
  );
  const select = (label: string, name: Field, options: readonly string[], optional = false) => (
    <Label>
      {label}
      <select name={name} defaultValue={row[name]}>
        {optional && <option value="" />}
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </Label>
  );

  return (
    <Dialog ref={ref} onClose={onClose}>
      <form onSubmit={submit}>
        <h2>{row.id ? "Edit application" : "New application"}</h2>
        <fieldset>
          {input("Company *", "company", { required: true, wide: true })}
          {select("Level", "role_level", LEVELS, true)}
          {select("Role type", "role_type", ROLE_TYPES, true)}
          {select("Location", "location", LOCATIONS, true)}
          {select("Source", "source", SOURCES)}
          {select("Status", "status", STATUSES)}
          {select("Approach", "approach", APPROACHES)}
          {input("Date applied / contacted", "date_applied", { type: "date" })}
          {input("Follow up on", "follow_up_date", { type: "date" })}
          {input("Company page", "company_url", { type: "url", placeholder: "https://", wide: true })}
          {input("Job advert", "job_url", { type: "url", placeholder: "https://", wide: true })}
          <TechInput initial={row.technologies ?? []} suggestions={suggestions} />
        </fieldset>
        <fieldset>
          <legend>Contacts</legend>
          {contacts.map((_, i) => (
            <Fragment key={i}>
              {contactInput(i, "Name", "name")}
              {contactInput(i, "Role", "role")}
              {contactInput(i, "Email", "email", { type: "email" })}
              {contactInput(i, "Phone", "phone", { type: "tel" })}
              {contactInput(i, "LinkedIn profile", "linkedin", { type: "url", placeholder: "https://", wide: true })}
              <Rule><Button type="button" $danger onClick={() => setContacts(contacts.filter((_, j) => j !== i))}>Remove contact</Button></Rule>
            </Fragment>
          ))}
          <Wide><Button type="button" onClick={() => setContacts([...contacts, BLANK])}>+ Add contact</Button></Wide>
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
