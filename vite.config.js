import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  css: {
    preprocessorOptions: {
      less: {
        math: "always",
        relativeUrls: true,
        javascriptEnabled: true,
      },
    },
  },
});
