import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SpikeGallery } from "./SpikeGallery";

const root = document.getElementById("spike-root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SpikeGallery />
    </StrictMode>,
  );
}
