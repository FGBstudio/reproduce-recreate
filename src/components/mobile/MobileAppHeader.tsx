/**
 * Header mobile CONDIVISO tra landing pre-login e home post-login
 * (SPEC mobile-landing-login §1.3): sticky sotto la status bar (--sat),
 * blur, bordo inferiore che appare dopo 10px di scroll. A sinistra il logo
 * immagine (bianco sul fondo scuro della landing, green.webp sulla home
 * chiara — scelta owner 08/09), a destra una sola azione primaria a pill
 * piu' al massimo due link secondari. Altezza contenuto 34px.
 */
import React, { useState } from "react";

interface Props {
  variant: "dark" | "light";
  scrolled: boolean;
  links?: { label: string; onClick: () => void }[];
  action: { label: string; onClick: () => void };
}

const MobileAppHeader: React.FC<Props> = ({ variant, scrolled, links = [], action }) => {
  const dark = variant === "dark";
  const [logoBroken, setLogoBroken] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between gap-2"
      style={{
        padding: "calc(var(--sat) + 6px) 16px 10px",
        background: dark ? "rgba(11,36,41,.72)" : "rgba(243,244,242,.72)",
        WebkitBackdropFilter: "blur(14px)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${scrolled ? (dark ? "rgba(255,255,255,.08)" : "rgba(74,75,77,.12)") : "transparent"}`,
        transition: "border-color .2s",
      }}
    >
      <span className="flex items-center" style={{ height: 34 }}>
        {logoBroken ? (
          <span className="font-bold" style={{ fontSize: 24, letterSpacing: "-0.03em", lineHeight: 0.9, color: dark ? "#fff" : "#009193" }}>
            FGB
            <span className="block font-normal" style={{ fontSize: 8, letterSpacing: "0.06em", opacity: 0.7, marginTop: 2 }}>Future Green Building</span>
          </span>
        ) : (
          <img
            src={dark ? "/white-logo.png" : "/green.webp"}
            alt="FGB — Future Green Building"
            style={{ height: 30, width: "auto", display: "block" }}
            onError={() => setLogoBroken(true)}
          />
        )}
      </span>
      <nav className="flex items-center" style={{ gap: 2 }}>
        {links.slice(0, 2).map(l => (
          <button
            key={l.label}
            type="button"
            onClick={l.onClick}
            className="rounded-full"
            style={{ fontSize: 12, letterSpacing: "0.06em", padding: "8px 9px", color: dark ? "rgba(244,243,239,.62)" : "#7c8285", minHeight: 34 }}
          >
            {l.label}
          </button>
        ))}
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-full font-semibold"
          style={{
            fontSize: 12, letterSpacing: "0.06em", padding: "9px 15px", marginLeft: 4, minHeight: 34,
            background: dark ? "#fff" : "#009193", color: dark ? "#0b2429" : "#fff", border: 0,
          }}
        >
          {action.label}
        </button>
      </nav>
    </header>
  );
};

export default MobileAppHeader;
