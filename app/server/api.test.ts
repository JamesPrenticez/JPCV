import { after, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import type { Application, Draft } from "../shared.ts";

process.env.DB_PATH = ":memory:";
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
