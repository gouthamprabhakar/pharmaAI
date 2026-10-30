"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ConfigurationEditor, sectionLabels, type ConfigSection } from "./configuration-editor";

export function ConfigurationDialog({ title, sections, onClose }: { title: string; sections: ConfigSection[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const session = useQuery(api.access.session, {});
  const [section, setSection] = useState(sections[0]);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const node = dialog.current; if (node && !node.open) node.showModal(); return () => { node?.close(); previous?.focus(); }; }, []);
  return <dialog ref={dialog} className="team-dialog configuration-dialog" aria-labelledby="configuration-title" onCancel={onClose}>
    <header className="team-dialog-header"><h2 id="configuration-title">{title}</h2><button type="button" className="demo-button" onClick={onClose}>Close</button></header>
    {session?.status === "authorized" && ["owner", "administrator"].includes(session.role) ? <>
      <label>Configuration area<select value={section} onChange={(e) => setSection(e.target.value as ConfigSection)}>{sections.map((s) => <option key={s} value={s}>{sectionLabels[s]}</option>)}</select></label>
      <ConfigurationEditor key={section} section={section} organizationId={session.organizationId}/>
    </> : <p>Only an authorized owner or administrator can configure this workspace.</p>}
  </dialog>;
}
