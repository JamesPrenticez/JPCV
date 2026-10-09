// Production: serves the built UI (dist/) and the API from one process. In dev, Vite mounts the API itself.
import express from "express";
import { resolve } from "node:path";
import { api } from "./api.ts";

const app = express();
app.use("/api", api);
app.use(express.static(resolve(import.meta.dirname, "../dist")));

const port = process.env.PORT ?? 3001;
app.listen(port, () => console.log(`Job tracker on http://localhost:${port}`));
