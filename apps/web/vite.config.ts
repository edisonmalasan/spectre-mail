import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SpectreMail website client. M1 establishes that this builds, lints, type
// checks, and serves; it does not yet contain product behaviour. See
// openspec/changes/archive/2026-10-02-monorepo-foundation/design.md.
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind loopback only. The client is a static site with no backend, by
    // design: SpectreMail operates no server and never proxies a provider API.
    host: "127.0.0.1",
    port: 5173,
  },
});
