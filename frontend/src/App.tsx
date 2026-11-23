import { useState } from "react";
import Studio from "./components/Studio";
import Dashboard from "./components/Dashboard";
import type { Project } from "./lib/types";

export default function App() {
  const [selected, setSelected] = useState<Project | null>(null);
  return selected
    ? <Studio />
    : <Dashboard onOpen={(project) => { localStorage.setItem("paperorchestra:open-project", project.id); setSelected(project); }} />;
}
