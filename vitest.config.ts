import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    alias: {
      // Next.js aliases this to a no-op when bundling for the server; do the
      // same here so lib files can be imported directly in tests. Otherwise
      // it unconditionally throws (see node_modules/server-only/index.js).
      "server-only": path.resolve(import.meta.dirname, "test/server-only-stub.ts"),
    },
  },
});
