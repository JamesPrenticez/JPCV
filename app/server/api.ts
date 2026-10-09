import express, { type ErrorRequestHandler } from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SOURCES, STATUSES, type Application } from "../shared.ts";

type Fields = Omit<Application, "id">;

const file = process.env.DB_PATH ?? resolve(import.meta.dirname, "../data/jobs.db");
if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });

const db = new DatabaseSync(file);
// ponytail: one contact per application, stored inline. Split into a contacts table if you need several per company.
db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id               INTEGER PRIMARY KEY,
    company          TEXT NOT NULL,
    role             TEXT NOT NULL DEFAULT '',
    source           TEXT NOT NULL DEFAULT 'Other',
    status           TEXT NOT NULL DEFAULT 'Saved',
    date_applied     TEXT NOT NULL DEFAULT '',
    follow_up_date   TEXT NOT NULL DEFAULT '',
    company_url      TEXT NOT NULL DEFAULT '',
    job_url          TEXT NOT NULL DEFAULT '',
    contact_name     TEXT NOT NULL DEFAULT '',
    contact_role     TEXT NOT NULL DEFAULT '',
    contact_email    TEXT NOT NULL DEFAULT '',
    contact_phone    TEXT NOT NULL DEFAULT '',
    contact_linkedin TEXT NOT NULL DEFAULT '',
    notes            TEXT NOT NULL DEFAULT ''
  )
`);

const URLS = ["company_url", "job_url", "contact_linkedin"] as const;
const DATES = ["date_applied", "follow_up_date"] as const;
const FIELDS = [
  "company", "role", "source", "status", ...DATES, ...URLS,
  "contact_name", "contact_role", "contact_email", "contact_phone", "notes",
] as const satisfies readonly (keyof Fields)[];

type HttpError = Error & { status?: number };
const bad = (message: string): HttpError => Object.assign(new Error(message), { status: 400 });
const oneOf = (list: readonly string[], v: string) => list.includes(v);

// Whitelists columns and validates. Links are rendered as <a href>, so only http(s) is allowed (blocks javascript:).
function parse(body: Record<string, unknown> = {}): Fields {
  const raw: Record<string, string> = Object.fromEntries(FIELDS.map((f) => [f, String(body[f] ?? "").trim()]));
  if (!raw.company) throw bad("company is required");
  if (!oneOf(SOURCES, raw.source)) throw bad(`source must be one of: ${SOURCES.join(", ")}`);
  if (!oneOf(STATUSES, raw.status)) throw bad(`status must be one of: ${STATUSES.join(", ")}`);
  for (const f of URLS) if (raw[f] && !/^https?:\/\//i.test(raw[f])) throw bad(`${f} must start with http:// or https://`);
  for (const f of DATES) if (raw[f] && !/^\d{4}-\d{2}-\d{2}$/.test(raw[f])) throw bad(`${f} must be YYYY-MM-DD`);
  return raw as Fields; // validated above
}

const list = db.prepare("SELECT * FROM applications ORDER BY date_applied DESC, id DESC");
const insert = db.prepare(
  `INSERT INTO applications (${FIELDS.join(", ")}) VALUES (${FIELDS.map((f) => ":" + f).join(", ")}) RETURNING *`,
);
const update = db.prepare(
  `UPDATE applications SET ${FIELDS.map((f) => `${f} = :${f}`).join(", ")} WHERE id = :id RETURNING *`,
);
const remove = db.prepare("DELETE FROM applications WHERE id = ?");

// A sub-app (not a bare Router) so it also works when mounted inside Vite's dev server.
export const api = express();
api.use(express.json());

api.get("/applications", (req, res) => res.json(list.all()));
api.post("/applications", (req, res) => res.status(201).json(insert.get(parse(req.body))));
api.put("/applications/:id", (req, res) => {
  const row = update.get({ ...parse(req.body), id: Number(req.params.id) });
  row ? res.json(row) : res.status(404).json({ error: "not found" });
});
api.delete("/applications/:id", (req, res) => {
  remove.run(Number(req.params.id)).changes ? res.sendStatus(204) : res.status(404).json({ error: "not found" });
});

const onError: ErrorRequestHandler = (err: HttpError, req, res, _next) => {
  res.status(err.status ?? 500).json({ error: err.message });
};
api.use(onError);
