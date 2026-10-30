import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { ICONS } from "../data/icons";
import { UI } from "../data/uiTexts";

interface AppLayoutProps {
  connected: boolean;
  children: ReactNode;
}

export default function AppLayout({ connected, children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#fff9ee",
            color: "#173c30",
            border: "1px solid #efcb83",
            borderRadius: "12px",
          },
        }}
      />
      <div className="page-wrap">
        <header className="topbar">
          <div className="brand">
            <span className="brand-icon" aria-hidden="true">
              {ICONS.tree}
            </span>
            <div>
              <strong>{UI.title}</strong>
              <small>{UI.tagline}</small>
            </div>
          </div>
          <div
            className={`connection${connected ? " is-connected" : ""}`}
            role="status"
          >
            <span className="status-dot" />
            {connected ? UI.connected : UI.connecting}
          </div>
        </header>
        {children}
        <footer className="page-footer">{UI.footer}</footer>
      </div>
    </div>
  );
}
