/// <reference types="vite/client" />

// GoatCounter (loaded from index.html). Optional everywhere: an ad blocker keeps
// the script from ever defining it.
interface Window {
  goatcounter?: {
    count?: (vars: { path: string; title?: string; event?: boolean }) => void;
  };
}
