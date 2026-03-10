// Polyfill Buffer for browser environments (especially mobile)
if (typeof window !== 'undefined' && typeof (window as any).Buffer === 'undefined') {
  // Simple Buffer polyfill using Uint8Array
  (window as any).Buffer = {
    from: (data: string | Uint8Array | ArrayBuffer, encoding?: string): Uint8Array => {
      if (typeof data === 'string') {
        if (encoding === 'hex') {
          // Hex string to Uint8Array
          const bytes = new Uint8Array(data.length / 2);
          for (let i = 0; i < data.length; i += 2) {
            bytes[i / 2] = parseInt(data.substr(i, 2), 16);
          }
          return bytes;
        }
        // String to Uint8Array (UTF-8)
        return new TextEncoder().encode(data);
      }
      if (data instanceof Uint8Array) {
        return data;
      }
      if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
      }
      return new Uint8Array(0);
    },
    isBuffer: (obj: any): boolean => {
      return obj instanceof Uint8Array;
    }
  };
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
