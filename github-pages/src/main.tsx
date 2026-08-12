import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import Explorer from "../../app/Explorer";
import "../../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Explorer root element is missing");

createRoot(root).render(
  <StrictMode>
    <Explorer />
  </StrictMode>,
);
