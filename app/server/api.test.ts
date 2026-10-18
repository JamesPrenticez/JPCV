import { after, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Application, Draft } from "../shared.ts";

const cvDir = mkdtempSync(join(tmpdir(), "cv-"));
process.env.DB_PATH = ":memory:";
process.env.CV_DIR = cvDir;
after(() => rmSync(cvDir, { recursive: true }));
const { api } = await import("./api.ts");

const server = express().use("/api", api).listen(0);
await once(server, "listening");
after(() => server.close());

const call = (path: string, method = "GET", body?: Draft) =>
  fetch(`http://localhost:${(server.address() as AddressInfo).port}/api/applications${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });

const valid: Draft = { company: "Acme", priority: "Medium", source: "LinkedIn", status: "Contacted", approach: "Advertised", job_url: "https://seek.co.nz/job/1" };

test("create, list, update, delete", async () => {
  const created = (await (await call("", "POST", valid)).json()) as Application;
  assert.equal(created.company, "Acme");
  assert.deepEqual(created.contacts, []); // omitted fields default to empty

  assert.equal(((await (await call("")).json()) as Application[]).length, 1);

  const updated = (await (await call(`/${created.id}`, "PUT", { ...valid, status: "Interview" })).json()) as Application;
  assert.equal(updated.status, "Interview");

  assert.equal((await call(`/${created.id}`, "DELETE")).status, 204);
  assert.equal((await call(`/${created.id}`, "DELETE")).status, 404);
  assert.equal((await call("/9999", "PUT", valid)).status, 404);
});

test("rejecting sets priority Low and stamps the date, once", async () => {
  const today = new Date().toLocaleDateString("en-CA");
  const created = (await (await call("", "POST", { ...valid, priority: "High" })).json()) as Application;
  assert.equal(created.date_rejected, "");

  const rejected = (await (await call(`/${created.id}`, "PUT", { ...created, status: "Rejected" })).json()) as Application;
  assert.equal(rejected.priority, "Low");
  assert.equal(rejected.date_rejected, today);

  // Already rejected: a later priority/date change sticks.
  const kept = (await (await call(`/${created.id}`, "PUT", { ...rejected, priority: "High", date_rejected: "2026-01-02" })).json()) as Application;
  assert.equal(kept.priority, "High");
  assert.equal(kept.date_rejected, "2026-01-02");

  // A date typed in the same save wins over today.
  const typed = (await (await call("", "POST", { ...valid, priority: "High" })).json()) as Application;
  assert.equal(((await (await call(`/${typed.id}`, "PUT", { ...typed, status: "Rejected", date_rejected: "2026-01-03" })).json()) as Application).date_rejected, "2026-01-03");
  for (const r of (await (await call("")).json()) as Application[]) await call(`/${r.id}`, "DELETE");
});

test("technologies: free text becomes a unique list, and survives a round trip", async () => {
  const created = (await (await call("", "POST", { ...valid, technologies: "TypeScript, pixi.js,\nGDD,, typescript " } as unknown as Draft)).json()) as Application;
  assert.deepEqual(created.technologies, ["TypeScript", "pixi.js", "GDD"]);

  // The status dropdown re-sends the whole row, technologies array included.
  const patched = (await (await call(`/${created.id}`, "PUT", { ...created, status: "Applied" })).json()) as Application;
  assert.deepEqual(patched.technologies, created.technologies);

  assert.deepEqual(((await (await call("", "POST", valid)).json()) as Application).technologies, []);
  for (const r of (await (await call("")).json()) as Application[]) await call(`/${r.id}`, "DELETE");
});

test("contacts: several per application, blanks dropped, survives a round trip", async () => {
  const jo = { name: " Jo ", role: "CTO", email: "jo@acme.test", phone: "", linkedin: "https://linkedin.com/in/jo" };
  const contacts = [jo, { name: "", role: "", email: "", phone: "", linkedin: "" }, { name: "Sam", extra: "ignored" }];
  const created = (await (await call("", "POST", { ...valid, contacts } as unknown as Draft)).json()) as Application;
  assert.deepEqual(created.contacts, [
    { ...jo, name: "Jo" },
    { name: "Sam", role: "", email: "", phone: "", linkedin: "" },
  ]);

  // The status dropdown re-sends the whole row, contacts array included.
  const patched = (await (await call(`/${created.id}`, "PUT", { ...created, status: "Applied" })).json()) as Application;
  assert.deepEqual(patched.contacts, created.contacts);
  await call(`/${created.id}`, "DELETE");
});

test("lists high priority first", async () => {
  for (const [company, priority] of [["Low Co", "Low"], ["High Co", "High"], ["Mid Co", "Medium"]] as const) {
    await call("", "POST", { ...valid, company, priority });
  }
  const rows = (await (await call("")).json()) as Application[];
  assert.deepEqual(rows.map((r) => r.company), ["High Co", "Mid Co", "Low Co"]);
  for (const r of rows) await call(`/${r.id}`, "DELETE");
});

test("rejects bad input", async () => {
  const cases = [
    { ...valid, company: " " },
    { ...valid, status: "Hired" },
    { ...valid, priority: "Urgent" },
    { ...valid, source: "Facebook" },
    { ...valid, approach: "Referral" },
    { ...valid, role_level: "Staff" },
    { ...valid, role_type: "DevOps" },
    { ...valid, location: "Mars" },
    { ...valid, job_url: "javascript:alert(1)" },
    { ...valid, contacts: [{ linkedin: "javascript:alert(1)" }] },
    { ...valid, contacts: "Jo" },
    { ...valid, date_applied: "10/10/2026" },
  ];
  for (const bad of cases) {
    assert.equal((await call("", "POST", bad as Draft)).status, 400, JSON.stringify(bad));
  }
});

test("cv: save per application, keep editing, restore the saved one", async () => {
  const live = join(cvDir, "index.html");
  const stakeCv = "<head></head>stake cv";
  const saved = () => readdirSync(join(cvDir, "versions")).filter((f) => f.startsWith("1-"));
  const stake = (await (await call("", "POST", { ...valid, company: "Stake Ltd" })).json()) as Application;
  assert.equal(stake.has_cv, false);
  assert.equal((await call(`/${stake.id}/cv/restore`, "POST")).status, 404);
  assert.equal((await call("/9999/cv", "POST")).status, 404);

  writeFileSync(live, stakeCv);
  assert.equal((await call(`/${stake.id}/cv`, "POST")).status, 204);
  assert.equal(await (await call(`/${stake.id}/cv`)).text(), `<head><base href="http://localhost:3000/"></head>stake cv`); // viewer page
  assert.equal((await call("/9999/cv")).status, 404);
  writeFileSync(live, "dominator cv"); // keep editing the working copy
  assert.equal(((await (await call("")).json()) as Application[])[0].has_cv, true);

  assert.equal((await call(`/${stake.id}/cv/restore`, "POST")).status, 204);
  assert.equal(readFileSync(live, "utf8"), stakeCv);
  assert.equal(readFileSync(join(cvDir, "versions", "_previous.html"), "utf8"), "dominator cv");

  await call(`/${stake.id}`, "PUT", { ...valid, company: "Stake Pty" }); // rename, then re-save: still one file
  await call(`/${stake.id}/cv`, "POST");
  assert.deepEqual(saved(), [`${stake.id}-stake-pty.html`]);
  await call(`/${stake.id}`, "DELETE");
});

test("cover letter: same flow, as .md in its own folder, independent of the CV", async () => {
  const live = join(cvDir, "cover-letter.md");
  const dir = join(cvDir, "cover-letters");
  const stake = (await (await call("", "POST", { ...valid, company: "Stake Ltd" })).json()) as Application;
  assert.equal(stake.has_cover_letter, false);
  assert.equal((await call(`/${stake.id}/cover-letter`)).status, 404);
  assert.equal((await call(`/${stake.id}/cover-letter/restore`, "POST")).status, 404);

  writeFileSync(live, "Dear Stake,\n\n**Hire me.**");
  assert.equal((await call(`/${stake.id}/cover-letter`, "POST")).status, 204);
  assert.deepEqual(readdirSync(dir), [`${stake.id}-stake-ltd.md`]);
  const viewed = await (await call(`/${stake.id}/cover-letter`)).text();
  assert.match(viewed, /content="light"[^]*color:#000[^]*>Dear Stake,\n\n\*\*Hire me\.\*\*</); // raw markdown on a light page: readable in OS dark mode
  writeFileSync(live, "a <b>&</b>");
  await call(`/${stake.id}/cover-letter`, "POST");
  assert.match(await (await call(`/${stake.id}/cover-letter`)).text(), />a &lt;b>&amp;&lt;\/b></); // text can't inject markup into the page
  writeFileSync(live, "Dear Stake,\n\n**Hire me.**");
  await call(`/${stake.id}/cover-letter`, "POST");
  assert.equal(((await (await call("")).json()) as Application[])[0].has_cover_letter, true);

  writeFileSync(live, "Dear Someone Else");
  assert.equal((await call(`/${stake.id}/cover-letter/restore`, "POST")).status, 204);
  assert.equal(readFileSync(live, "utf8"), "Dear Stake,\n\n**Hire me.**");
  assert.equal(readFileSync(join(dir, "_previous.md"), "utf8"), "Dear Someone Else");
  await call(`/${stake.id}`, "DELETE");
});
