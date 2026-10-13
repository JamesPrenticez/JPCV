import express, { type ErrorRequestHandler } from "express";
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { APPROACHES, LEVELS, LOCATIONS, PRIORITIES, ROLE_TYPES, SOURCES, STATUSES, type Application, type Contact } from "../shared.ts";

type Fields = Omit<Application, "id" | "technologies" | "contacts" | "has_cv"> & { technologies: string; contacts: string }; // JSON arrays in the DB

const file = process.env.DB_PATH ?? resolve(import.meta.dirname, "../data/jobs.db");
if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });

// A CV as sent to one application lives at cv/versions/<id>-<company>.html. Plain files in the repo, so git backs them up and diffs them.
// ponytail: deleting an application leaves its file behind, and a reused id would inherit it; delete the file in DELETE if that bites.
const cvLive = join(process.env.CV_DIR ?? resolve(import.meta.dirname, "../../cv"), "index.html");
const cvVersions = join(dirname(cvLive), "versions");
mkdirSync(cvVersions, { recursive: true });
const savedCv = (id: number) => readdirSync(cvVersions).find((f) => f.startsWith(`${id}-`));
// The viewer needs the CV's stylesheet and images, which only the CV's own dev server serves (pnpm dev in cv/).
const cvUrl = process.env.CV_URL ?? "http://localhost:3000";

const db = new DatabaseSync(file);
// `technologies` and `contacts` are JSON arrays so SQL can unnest them, e.g. most-wanted tech first:
//   SELECT lower(value) AS tech, count(*) AS n FROM applications, json_each(technologies) GROUP BY tech ORDER BY n DESC
// ponytail: contacts live inline per application, so the same person at two applications is stored twice. Split into a contacts table if that hurts.
db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id               INTEGER PRIMARY KEY,
    company          TEXT NOT NULL,
    priority         TEXT NOT NULL DEFAULT 'Medium',
    role_level      TEXT NOT NULL DEFAULT '',
    role_type        TEXT NOT NULL DEFAULT '',
    location         TEXT NOT NULL DEFAULT '',
    source          TEXT NOT NULL DEFAULT 'Other',
    status           TEXT NOT NULL DEFAULT 'Saved',
    approach         TEXT NOT NULL DEFAULT 'Advertised',
    date_applied     TEXT NOT NULL DEFAULT '',
    follow_up_date   TEXT NOT NULL DEFAULT '',
    company_url      TEXT NOT NULL DEFAULT '',
    job_url          TEXT NOT NULL DEFAULT '',
    technologies     TEXT NOT NULL DEFAULT '[]',
    contacts         TEXT NOT NULL DEFAULT '[]',
    notes           TEXT NOT NULL DEFAULT ''
  )
`);
// ponytail: one-off migration from the old free-text `role` column; delete once every DB has run it.
if (db.prepare("SELECT 1 FROM pragma_table_info('applications') WHERE name = 'role'").get()) {
  db.exec(`
    ALTER TABLE applications DROP COLUMN role;
    ALTER TABLE applications ADD COLUMN role_level TEXT NOT NULL DEFAULT '';
    ALTER TABLE applications ADD COLUMN role_type TEXT NOT NULL DEFAULT '';
  `);
}
// ponytail: one-off migration for DBs created before `priority` existed; delete once every DB has run it.
if (!db.prepare("SELECT 1 FROM pragma_table_info('applications') WHERE name = 'priority'").get()) {
  db.exec("ALTER TABLE applications ADD COLUMN priority TEXT NOT NULL DEFAULT 'Medium'");
}
// ponytail: one-off migration for DBs created before `location` existed; delete once every DB has run it.
if (!db.prepare("SELECT 1 FROM pragma_table_info('applications') WHERE name = 'location'").get()) {
  db.exec("ALTER TABLE applications ADD COLUMN location TEXT NOT NULL DEFAULT ''");
}
// ponytail: one-off migration for DBs created before `technologies` existed; delete once every DB has run it.
if (!db.prepare("SELECT 1 FROM pragma_table_info('applications') WHERE name = 'technologies'").get()) {
  db.exec("ALTER TABLE applications ADD COLUMN technologies TEXT NOT NULL DEFAULT '[]'");
}
// ponytail: one-off migration for DBs created before `approach` existed; delete once every DB has run it.
if (!db.prepare("SELECT 1 FROM pragma_table_info('applications') WHERE name = 'approach'").get()) {
  db.exec("ALTER TABLE applications ADD COLUMN approach TEXT NOT NULL DEFAULT 'Advertised'");
}
// ponytail: one-off migration from the single inline contact; delete once every DB has run it.
if (db.prepare("SELECT 1 FROM pragma_table_info('applications') WHERE name = 'contact_name'").get()) {
  db.exec(`
    ALTER TABLE applications ADD COLUMN contacts TEXT NOT NULL DEFAULT '[]';
    UPDATE applications
      SET contacts = json_array(json_object('name', contact_name, 'role', contact_role, 'email', contact_email, 'phone', contact_phone, 'linkedin', contact_linkedin))
      WHERE contact_name || contact_role || contact_email || contact_phone || contact_linkedin != '';
    ALTER TABLE applications DROP COLUMN contact_name;
    ALTER TABLE applications DROP COLUMN contact_role;
    ALTER TABLE applications DROP COLUMN contact_email;
    ALTER TABLE applications DROP COLUMN contact_phone;
    ALTER TABLE applications DROP COLUMN contact_linkedin;
  `);
}

const HTTP = /^https?:\/\//i;
const URLS = ["company_url", "job_url"] as const;
const DATES = ["date_applied", "follow_up_date"] as const;
const CONTACT_KEYS = ["name", "role", "email", "phone", "linkedin"] as const satisfies readonly (keyof Contact)[];
const FIELDS = [
  "company", "priority", "role_level", "role_type", "location", "source", "status", "approach", ...DATES, ...URLS, "technologies",
  "contacts", "notes",
] as const satisfies readonly (keyof Fields)[];

type HttpError = Error & { status?: number };
const bad = (message: string): HttpError => Object.assign(new Error(message), { status: 400 });
const oneOf = (list: readonly string[], v: string) => list.includes(v);

// Whitelists columns and validates. Links are rendered as <a href>, so only http(s) is allowed (blocks javascript:).
function parse(body: Record<string, unknown> = {}): Fields {
  const raw: Record<string, string> = Object.fromEntries(FIELDS.map((f) => [f, String(body[f] ?? "").trim()]));
  if (!raw.company) throw bad("company is required");
  if (!oneOf(PRIORITIES, raw.priority)) throw bad(`priority must be one of: ${PRIORITIES.join(", ")}`);
  if (!oneOf(SOURCES, raw.source)) throw bad(`source must be one of: ${SOURCES.join(", ")}`);
  if (!oneOf(STATUSES, raw.status)) throw bad(`status must be one of: ${STATUSES.join(", ")}`);
  if (!oneOf(APPROACHES, raw.approach)) throw bad(`approach must be one of: ${APPROACHES.join(", ")}`);
  if (raw.role_level && !oneOf(LEVELS, raw.role_level)) throw bad(`role_level must be one of: ${LEVELS.join(", ")}`);
  if (raw.role_type && !oneOf(ROLE_TYPES, raw.role_type)) throw bad(`role_type must be one of: ${ROLE_TYPES.join(", ")}`);
  if (raw.location && !oneOf(LOCATIONS, raw.location)) throw bad(`location must be one of: ${LOCATIONS.join(", ")}`);
  for (const f of URLS) if (raw[f] && !HTTP.test(raw[f])) throw bad(`${f} must start with http:// or https://`);
  for (const f of DATES) if (raw[f] && !/^\d{4}-\d{2}-\d{2}$/.test(raw[f])) throw bad(`${f} must be YYYY-MM-DD`);
  raw.technologies = JSON.stringify(techs(raw.technologies));
  raw.contacts = JSON.stringify(parseContacts(body.contacts)); // an array, so String() above mangled it
  return raw as Fields; // validated above
}

// Whitelists keys, trims, drops blank contacts. LinkedIn is rendered as a link, so it gets the same http(s)-only rule.
function parseContacts(list: unknown = []): Contact[] {
  if (!Array.isArray(list)) throw bad("contacts must be a list");
  const clean = list
    .map((c) => Object.fromEntries(CONTACT_KEYS.map((k) => [k, String(c?.[k] ?? "").trim()])) as Contact)
    .filter((c) => Object.values(c).some(Boolean));
  for (const c of clean) if (c.linkedin && !HTTP.test(c.linkedin)) throw bad("contact linkedin must start with http:// or https://");
  return clean;
}

// Free text -> unique list. Takes "a, b\nc" from the form, or an array round-tripped from a row (String() joins it with commas).
const techs = (text: string) =>
  text.split(/[,\n]/).map((s) => s.trim()).filter((s, i, all) => s && all.findIndex((t) => t.toLowerCase() === s.toLowerCase()) === i);

const out = (row?: Record<string, unknown>) =>
  row && { ...row, technologies: JSON.parse(String(row.technologies)), contacts: JSON.parse(String(row.contacts)), has_cv: !!savedCv(Number(row.id)) };

const byPriority = `CASE priority ${PRIORITIES.map((p, i) => `WHEN '${p}' THEN ${i}`).join(" ")} END`;
const list = db.prepare(`SELECT * FROM applications ORDER BY ${byPriority}, date_applied DESC, id DESC`);
const insert = db.prepare(
  `INSERT INTO applications (${FIELDS.join(", ")}) VALUES (${FIELDS.map((f) => ":" + f).join(", ")}) RETURNING *`,
);
const update = db.prepare(
  `UPDATE applications SET ${FIELDS.map((f) => `${f} = :${f}`).join(", ")} WHERE id = :id RETURNING *`,
);
const remove = db.prepare("DELETE FROM applications WHERE id = ?");
const one = db.prepare("SELECT id, company FROM applications WHERE id = ?");

// A sub-app (not a bare Router) so it also works when mounted inside Vite's dev server.
export const api = express();
api.use(express.json());

api.get("/applications", (req, res) => res.json(list.all().map(out)));
api.post("/applications", (req, res) => res.status(201).json(out(insert.get(parse(req.body)))));
api.put("/applications/:id", (req, res) => {
  const row = out(update.get({ ...parse(req.body), id: Number(req.params.id) }));
  row ? res.json(row) : res.status(404).json({ error: "not found" });
});
api.delete("/applications/:id", (req, res) => {
  remove.run(Number(req.params.id)).changes ? res.sendStatus(204) : res.status(404).json({ error: "not found" });
});

// Save the CV as it is now against this application (overwrites its earlier copy).
api.post("/applications/:id/cv", (req, res) => {
  const row = one.get(Number(req.params.id));
  if (!row) return void res.status(404).json({ error: "not found" });
  const old = savedCv(Number(row.id));
  if (old) rmSync(join(cvVersions, old)); // the company may have been renamed since
  const slug = String(row.company).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  copyFileSync(cvLive, join(cvVersions, `${row.id}-${slug}.html`));
  res.sendStatus(204);
});
// The saved CV as a page, for the viewer iframe. <base> sends its ./imgs and /styles links to the CV dev server.
api.get("/applications/:id/cv", (req, res) => {
  const saved = savedCv(Number(req.params.id));
  if (!saved) return void res.status(404).json({ error: "no saved CV" });
  const html = readFileSync(join(cvVersions, saved), "utf8");
  res.type("html").send(html.replace(/<head[^>]*>/i, (head) => `${head}<base href="${cvUrl}/">`));
});
// Make this application's saved CV the working one. The working one is kept as _previous.html (one-step undo).
api.post("/applications/:id/cv/restore", (req, res) => {
  const saved = savedCv(Number(req.params.id));
  if (!saved) return void res.status(404).json({ error: "no saved CV" });
  copyFileSync(cvLive, join(cvVersions, "_previous.html"));
  copyFileSync(join(cvVersions, saved), cvLive);
  res.sendStatus(204);
});

const onError: ErrorRequestHandler = (err: HttpError, req, res, _next) => {
  res.status(err.status ?? 500).json({ error: err.message });
};
api.use(onError);
