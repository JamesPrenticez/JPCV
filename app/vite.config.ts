import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      // Run the Express API inside the dev server: one command, one port, no proxy.
      // Dynamic import so `vite build` doesn't open the database.
      name: "express-api",
      async configureServer(server) {
        const { api } = await import("./server/api.ts");
        server.middlewares.use("/api", api);
      },
    },
  ],
});
