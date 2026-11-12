import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const src = (p: string) => fileURLToPath(new URL(`../../src/${p}`, import.meta.url));

// The example imports the library from its sources, exactly as an installed package would be imported.
export default defineConfig({
  root,
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "pdf-cite-locate/react": src("react/index.tsx"),
      "pdf-cite-locate/dom": src("dom/index.ts"),
      "pdf-cite-locate": src("index.ts"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0 }, // keep the sample PDF a real file
});
