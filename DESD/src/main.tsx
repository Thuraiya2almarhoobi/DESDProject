/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Frontend source file for main.
 *
 * Frontend context:
 *   Frontend source module for the React/Vite application.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */


  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);
