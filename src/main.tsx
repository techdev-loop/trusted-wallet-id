// Polyfill Buffer and process for browser environments
import { Buffer } from 'buffer';

// Make Buffer available globally (both window and globalThis)
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
}
if (typeof global !== 'undefined') {
  (global as any).Buffer = Buffer;
}

// Make process available globally (some libraries need it)
if (typeof window !== 'undefined' && typeof (window as any).process === 'undefined') {
  (window as any).process = {
    env: {},
    version: '',
    versions: {},
    browser: true,
  };
}
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = {
    env: {},
    version: '',
    versions: {},
    browser: true,
  };
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import '@rainbow-me/rainbowkit/styles.css';

createRoot(document.getElementById("root")!).render(<App />);
