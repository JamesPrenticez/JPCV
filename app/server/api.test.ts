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

const valid: Draft = { company: "Acme", source: "LinkedIn", status: "Contacted", job_url: "https://seek.co.nz/job/1" };

test("create, list, update, delete", async () => {
  const created = (await (await call("", "POST", valid)).json()) as Application;
  assert.equal(created.company, "Acme");
  assert.equal(created.contact_name, ""); // omitted fields default to empty

  assert.equal(((await (await call("")).json()) as Application[]).length, 1);

  const updated = (await (await call(`/${created.id}`, "PUT", { ...valid, status: "Interview" })).json()) as Application;
  assert.equal(updated.status, "Interview");

  assert.equal((await call(`/${created.id}`, "DELETE")).status, 204);
  assert.equal((await call(`/${created.id}`, "DELETE")).status, 404);
  assert.equal((await call("/9999", "PUT", valid)).status, 404);
});

test("rejects bad input", async () => {
  const cases = [
    { ...valid, company: " " },
    { ...valid, status: "Hired" },
    { ...valid, source: "Facebook" },
    { ...valid, job_url: "javascript:alert(1)" },
    { ...valid, date_applied: "10/10/2026" },
  ];
  for (const bad of cases) {
    assert.equal((await call("", "POST", bad as Draft)).status, 400, JSON.stringify(bad));
  }
});
