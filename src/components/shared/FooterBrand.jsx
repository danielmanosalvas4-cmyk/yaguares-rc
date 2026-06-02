// src/components/shared/FooterBrand.jsx
import React from "react";

export default function FooterBrand() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "12px 16px",
      marginTop: 32,
      borderTop: "1px solid #1a1a1a"
    }}>
      <span style={{
        fontFamily: "'Barlow Condensed'",
        fontSize: "0.65rem",
        color: "#2a2a2a",
        letterSpacing: "0.1em",
        textTransform: "uppercase"
      }}>
        Powered by
      </span>
      <img
        src="/manoworks-logo.png"
        alt="Manoworks Tech"
        style={{ height: 18, opacity: 0.25, filter: "grayscale(100%)" }}
      />
    </div>
  );
}
