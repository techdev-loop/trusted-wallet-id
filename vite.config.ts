import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Polyfill Buffer for browser environments
      buffer: "buffer",
    },
  },
  define: {
    // Polyfill Buffer and global for browser environments
    global: "globalThis",
    "process.env": {},
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
    include: ["buffer"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      plugins: process.env.ANALYZE === "true"
        ? [
            visualizer({
              filename: "dist/bundle-stats.html",
              template: "treemap",
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : [],
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          const modulePath = id.split("node_modules/")[1] ?? "";
          const has = (fragment: string) => modulePath.includes(fragment);

          if (
            modulePath.startsWith("react/") ||
            modulePath.startsWith("react-dom/") ||
            modulePath.startsWith("scheduler/") ||
            modulePath.startsWith("react-router/") ||
            modulePath.startsWith("@remix-run/router/")
          ) {
            return "vendor-react-core";
          }

          if (
            has("@solana/") ||
            has("@wallet-standard/") ||
            has("bs58/") ||
            has("tweetnacl/") ||
            has("eventemitter3/")
          ) {
            return "vendor-solana";
          }

          if (modulePath.includes("locales/") || modulePath.includes("/locale/")) {
            if (modulePath.includes("en_US")) return "vendor-wallet-locale-en";
            return "vendor-wallet-locales";
          }

          if (has("viem/")) {
            return "vendor-viem";
          }

          if (
            has("ethers/") ||
            has("@ethersproject/")
          ) {
            return "vendor-ethers";
          }

          if (
            has("@reown/appkit-scaffold-ui/") ||
            has("@reown/appkit-ui/")
          ) {
            return "vendor-reown-ui";
          }

          if (
            has("@reown/appkit-wallet-button/") ||
            has("@reown/appkit-common/") ||
            has("@reown/appkit-utils/")
          ) {
            return "vendor-reown-widgets";
          }

          if (
            has("@walletconnect/") ||
            has("@reown/")
          ) {
            return "vendor-walletconnect-core";
          }

          if (has("tronweb/")) {
            return "vendor-tronweb";
          }

          if (has("@tronweb3/walletconnect-tron/")) {
            return "vendor-tron-walletconnect";
          }

          if (
            has("@tronweb3/tronwallet-adapter-walletconnect/") ||
            has("@tronweb3/tronwallet-abstract-adapter/") ||
            has("@tronweb3/tronwallet-adapters/")
          ) {
            return "vendor-tron-adapters";
          }

          if (
            modulePath.startsWith("framer-motion/") ||
            modulePath.startsWith("lucide-react/") ||
            modulePath.startsWith("@radix-ui/") ||
            modulePath.startsWith("class-variance-authority/") ||
            modulePath.startsWith("sonner/")
          ) {
            return "vendor-ui";
          }
          return undefined;
        },
      },
    },
  },
}));
