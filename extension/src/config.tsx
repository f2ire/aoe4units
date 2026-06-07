import React from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";

// Twitch broadcaster configuration view. No business logic yet — just confirms mount.
function Config() {
  return (
    <div className="p-4 text-foreground bg-background min-h-screen">OK</div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Config />
  </React.StrictMode>,
);
