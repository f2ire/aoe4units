import React from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";

// Twitch panel view. No business logic yet — just confirms the build/mount path works.
function Panel() {
  return (
    <div className="p-4 text-foreground bg-background min-h-screen">OK</div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Panel />
  </React.StrictMode>,
);
