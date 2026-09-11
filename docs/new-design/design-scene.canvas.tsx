import {
  Callout,
  Card,
  CardBody,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Row,
  Stack,
  Table,
  Text,
  useHostTheme,
} from "cursor/canvas";

// ---------------------------------------------------------------------------
// Direction retenue : SCÈNE — noir absolu, monochrome au repos,
// le rose #ff3a63 réservé au vivant (lecture, REC, onglet actif).
// Source : src/app/styles.css, src/features/home/HomePage.tsx,
// src/features/songs/SongsPage.tsx, src/features/songs/SongDetailPage.tsx,
// src/features/setlists/SetlistsPage.tsx, src/components/AppShell.tsx
// ---------------------------------------------------------------------------

const ACCENT = "#ff3a63";
const MONO = "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace";
const GROTESK = "'Space Grotesk', 'Inter', system-ui, sans-serif";
const INTER = "'Inter', system-ui, sans-serif";

const SCENE_TOKENS = {
  bg: "#000000",
  surface: "#111111",
  tile: "rgba(255, 255, 255, 0.03)",
  border: "rgba(255, 255, 255, 0.10)",
  text: "#ffffff",
  muted: "#9c9c9c",
  accent: ACCENT,
};

// ---------------------------------------------------------------------------
// Contraste WCAG
// ---------------------------------------------------------------------------

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ---------------------------------------------------------------------------
// Briques communes
// ---------------------------------------------------------------------------

function SwatchBox({
  label,
  value,
  chipBg,
}: {
  label: string;
  value: string;
  chipBg?: string;
}) {
  const theme = useHostTheme();
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          height: 34,
          borderRadius: 8,
          background: chipBg ?? theme.bg.elevated,
          border: `1px solid ${theme.stroke.tertiary}`,
          display: "flex",
          alignItems: "stretch",
          padding: 3,
        }}
      >
        <div style={{ flex: 1, borderRadius: 5, background: value }} />
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 10,
          fontWeight: 600,
          color: theme.text.secondary,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 9, color: theme.text.tertiary }}>{value}</div>
    </div>
  );
}

function PhoneFrame({
  children,
  glow,
}: {
  children: any;
  glow?: boolean;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        width: 236,
        flexShrink: 0,
        borderRadius: 26,
        border: `1px solid ${theme.stroke.tertiary}`,
        background: SCENE_TOKENS.bg,
        padding: "14px 12px 12px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {glow ? (
        <div
          style={{
            position: "absolute",
            top: -50,
            left: "15%",
            width: "70%",
            height: 110,
            background:
              "radial-gradient(ellipse at center, rgba(255,58,99,0.16), transparent 70%)",
            pointerEvents: "none",
          }}
        />
      ) : null}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

function PlayGlyph({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: `8px solid ${color}`,
        borderTop: "5px solid transparent",
        borderBottom: "5px solid transparent",
        marginLeft: 2,
      }}
    />
  );
}

function MockCaption({ label }: { label: string }) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: theme.text.tertiary,
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {label}
    </div>
  );
}

function SceneNav() {
  return (
    <div
      style={{
        marginTop: 16,
        marginLeft: "auto",
        marginRight: "auto",
        width: 150,
        background: SCENE_TOKENS.surface,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 999,
        display: "flex",
        justifyContent: "space-around",
        padding: "7px 0",
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: i === 0 ? ACCENT : "rgba(255,255,255,0.25)",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Écrans en variante Scène
// ---------------------------------------------------------------------------

function HomeSceneMock() {
  const muted = SCENE_TOKENS.muted;
  const text = SCENE_TOKENS.text;
  const hairline = "1px solid rgba(255,255,255,0.08)";
  const tools: Array<{ glyph: string; label: string; rose?: boolean; badge?: string }> = [
    { glyph: "●", label: "Enregistrer", rose: true },
    { glyph: "♩", label: "Métronome" },
    { glyph: "▤", label: "Prompteur" },
    { glyph: "+", label: "Nouveau" },
    { glyph: "♪", label: "Morceaux" },
    { glyph: "≡", label: "Setlists" },
    { glyph: "□", label: "Calendrier" },
    { glyph: "▣", label: "Booking", badge: "2" },
  ];
  return (
    <PhoneFrame glow>
      {/* En-tête */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: GROTESK,
            fontSize: 17,
            fontWeight: 700,
            color: text,
            letterSpacing: "-0.01em",
          }}
        >
          Accueil
        </span>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            background: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          FZ
        </span>
      </div>

      {/* Carte hero : dernière modification */}
      <div
        style={{
          marginTop: 12,
          border: hairline,
          borderRadius: 12,
          padding: "10px 12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: INTER,
            fontSize: 9,
            color: muted,
          }}
        >
          <span>FaderZero</span>
          <span>Il y a 2 h</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              background: ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <PlayGlyph color="#fff" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: GROTESK,
                fontSize: 15,
                fontWeight: 700,
                color: text,
                letterSpacing: "-0.01em",
              }}
            >
              Minuit à Paris
            </div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: muted, marginTop: 2 }}>
              128 BPM · Dm · 3:24
            </div>
          </div>
          <span style={{ fontFamily: INTER, fontSize: 9, color: muted }}>Prêt</span>
        </div>
      </div>

      {/* Fonctions & outils : grille 4×2 de tuiles noires */}
      <div
        style={{
          marginTop: 12,
          fontFamily: INTER,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: muted,
        }}
      >
        FONCTIONS & OUTILS
      </div>
      <div
        style={{
          marginTop: 6,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 4,
        }}
      >
        {tools.map((t) => (
          <div
            key={t.label}
            style={{
              position: "relative",
              border: hairline,
              borderRadius: 10,
              padding: "8px 0 6px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: INTER,
                fontSize: 12,
                color: t.rose ? ACCENT : "rgba(255,255,255,0.85)",
              }}
            >
              {t.glyph}
            </span>
            <span style={{ fontFamily: INTER, fontSize: 7, color: muted }}>{t.label}</span>
            {t.badge ? (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  minWidth: 13,
                  height: 13,
                  borderRadius: 7,
                  background: ACCENT,
                  fontFamily: INTER,
                  fontSize: 8,
                  fontWeight: 700,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {t.badge}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Prochaines dates */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: INTER,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: muted,
          }}
        >
          PROCHAINES DATES (2)
        </span>
        <span style={{ fontFamily: INTER, fontSize: 9, color: ACCENT }}>Calendrier →</span>
      </div>
      <SceneRow title="Festival de la Roche" meta="12 sept. · 20:30" right="CONCERT" />
      <SceneRow title="Répétition studio" meta="18 sept. · 19:00" right="RÉPÈTE" />

      {/* Activité répertoire */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: INTER,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: muted,
          }}
        >
          ACTIVITÉ RÉPERTOIRE
        </span>
        <span style={{ fontFamily: INTER, fontSize: 9, color: ACCENT }}>Tout voir →</span>
      </div>
      <SceneRow title="Neon Rivers" meta="FaderZero · Hier" right="1:02" />
      <SceneRow title="Sous les néons" meta="FaderZero · Il y a 3 j" right="2:47" />
      <SceneNav />
    </PhoneFrame>
  );
}

function SongsSceneMock() {
  const muted = SCENE_TOKENS.muted;
  const text = SCENE_TOKENS.text;
  const rows: Array<{
    title: string;
    meta: string;
    status?: string;
    playing?: boolean;
  }> = [
    { title: "Minuit à Paris", meta: "128 BPM · Dm · 3:24", status: "Prêt" },
    { title: "Neon Rivers", meta: "1:02" },
    { title: "Sous les néons", meta: "96 BPM · Am · 2:47", status: "En cours", playing: true },
  ];
  return (
    <PhoneFrame glow>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: GROTESK,
            fontSize: 17,
            fontWeight: 700,
            color: text,
            letterSpacing: "-0.01em",
          }}
        >
          Morceaux
        </span>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            background: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          +
        </span>
      </div>
      <div
        style={{
          marginTop: 10,
          background: SCENE_TOKENS.surface,
          borderRadius: 999,
          padding: "6px 12px",
          fontFamily: INTER,
          fontSize: 10,
          color: muted,
        }}
      >
        Rechercher…
      </div>
      <div style={{ marginTop: 8 }}>
        {rows.map((r) => (
          <div
            key={r.title}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              padding: "10px 0",
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                border: r.playing ? "none" : "1px solid rgba(255,255,255,0.18)",
                background: r.playing ? ACCENT : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PlayGlyph color={r.playing ? "#fff" : "#d4d4d4"} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: INTER,
                  fontSize: 13,
                  fontWeight: 600,
                  color: text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.title}
              </div>
              <div style={{ fontFamily: INTER, fontSize: 9, color: muted, marginTop: 2 }}>
                {r.meta}
              </div>
            </div>
            {r.status ? (
              <span
                style={{
                  fontFamily: INTER,
                  fontSize: 9,
                  color: r.playing ? ACCENT : muted,
                  flexShrink: 0,
                }}
              >
                {r.status}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <SceneNav />
    </PhoneFrame>
  );
}

function SetlistsSceneMock() {
  const muted = SCENE_TOKENS.muted;
  const text = SCENE_TOKENS.text;
  const rows: Array<{
    name: string;
    meta: string;
    date: string;
    next?: boolean;
  }> = [
    { name: "Festival de la Roche", meta: "14 morceaux · 45 min", date: "12 sept.", next: true },
    { name: "Le Chabada", meta: "10 morceaux · 39 min", date: "26 sept." },
    { name: "Répétition complète", meta: "16 morceaux · 52 min", date: "" },
  ];
  return (
    <PhoneFrame glow>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: GROTESK,
            fontSize: 17,
            fontWeight: 700,
            color: text,
            letterSpacing: "-0.01em",
          }}
        >
          Setlists
        </span>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            background: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          +
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        {rows.map((r) => (
          <div
            key={r.name}
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              padding: "10px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: INTER,
                  fontSize: 13,
                  fontWeight: 600,
                  color: text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.name}
              </span>
              <span style={{ fontFamily: INTER, fontSize: 9, color: muted, flexShrink: 0 }}>
                {r.date}
              </span>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}
            >
              <span style={{ fontFamily: INTER, fontSize: 9, color: muted }}>{r.meta}</span>
              {r.next ? (
                <span style={{ fontFamily: INTER, fontSize: 9, color: ACCENT }}>
                  · prochaine
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <SceneNav />
    </PhoneFrame>
  );
}

function SongSceneContent() {
  const muted = SCENE_TOKENS.muted;
  const text = SCENE_TOKENS.text;
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: INTER, fontSize: 12, color: muted }}>←</span>
        <span style={{ display: "flex", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                background: "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </span>
      </div>
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontFamily: GROTESK,
            fontSize: 21,
            fontWeight: 700,
            color: text,
            letterSpacing: "-0.01em",
          }}
        >
          Minuit à Paris
        </div>
        <div style={{ fontFamily: INTER, fontSize: 10, color: muted, marginTop: 3 }}>
          Dm · 128 BPM · 3:24 · <span style={{ color: ACCENT }}>Prêt</span>
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <PlayGlyph color="#fff" />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ height: 2, background: "rgba(255,255,255,0.14)", borderRadius: 1 }}>
            <div style={{ width: "35%", height: 2, background: ACCENT, borderRadius: 1 }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: INTER,
              fontSize: 8,
              color: muted,
              marginTop: 4,
            }}
          >
            <span>1:12</span>
            <span>3:24</span>
          </div>
        </div>
      </div>
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          marginTop: 16,
          paddingTop: 12,
        }}
      >
        <div
          style={{
            fontFamily: INTER,
            fontSize: 12,
            lineHeight: 1.8,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          Sous les néons de la ville
          <br />
          On court après le silence
          <br />
          Minuit sonne à Paris…
        </div>
      </div>
    </>
  );
}

function SongSceneMock() {
  return (
    <PhoneFrame glow>
      <SongSceneContent />
    </PhoneFrame>
  );
}

// Bottom sheet par-dessus la fiche : le rendu réel d'une popup en Scène.
// Choix validé : sheet noir pur #000 + hairline white/18 ; page en dessous
// floutée blur(6px) et éclaircie par un voile white/7.
function SongSceneWithSheetMock({ sheet }: { sheet: "status" | "key" }) {
  return (
    <PhoneFrame glow>
      <SongSceneContent />
      {/* backdrop : floute et éclaircit la page */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(6px)",
        }}
      />
      {/* bottom sheet noir pur */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "#000000",
          borderTop: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "18px 18px 0 0",
          padding: "10px 14px 16px",
        }}
      >
        <div
          style={{
            width: 32,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.2)",
            margin: "0 auto 10px",
          }}
        />
        <div
          style={{
            fontFamily: GROTESK,
            fontSize: 13,
            fontWeight: 700,
            color: SCENE_TOKENS.text,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {sheet === "status" ? "Statut de création" : "Sélectionner la tonalité"}
        </div>
        {sheet === "status" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {["Idée", "En cours", "Prêt"].map((opt) => {
              const selected = opt === "Prêt";
              return (
                <div
                  key={opt}
                  style={{
                    borderRadius: 12,
                    padding: "12px 0",
                    textAlign: "center",
                    fontFamily: INTER,
                    fontSize: 11,
                    fontWeight: 600,
                    background: selected ? ACCENT : "rgba(255,255,255,0.06)",
                    color: selected ? "#ffffff" : "rgba(255,255,255,0.78)",
                  }}
                >
                  {opt}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map((k) => {
              const selected = k === "D";
              return (
                <div
                  key={k}
                  style={{
                    borderRadius: 12,
                    padding: "10px 0",
                    textAlign: "center",
                    fontFamily: INTER,
                    fontSize: 12,
                    fontWeight: 600,
                    background: selected ? ACCENT : "rgba(255,255,255,0.06)",
                    color: selected ? "#ffffff" : "rgba(255,255,255,0.78)",
                  }}
                >
                  {k}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}

// ---------------------------------------------------------------------------
// Les autres pages en Scène — helpers + maquettes compactes
// ---------------------------------------------------------------------------

function ScenePageHeader({
  title,
  back,
  add,
}: {
  title: string;
  back?: boolean;
  add?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          fontFamily: GROTESK,
          fontSize: 17,
          fontWeight: 700,
          color: SCENE_TOKENS.text,
          letterSpacing: "-0.01em",
        }}
      >
        {back ? (
          <span style={{ fontFamily: INTER, fontSize: 12, color: SCENE_TOKENS.muted }}>
            ←
          </span>
        ) : null}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
      </span>
      {add ? (
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            background: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          +
        </span>
      ) : null}
    </div>
  );
}

function SceneRow({
  title,
  meta,
  right,
  rightAccent,
}: {
  title: string;
  meta?: string;
  right?: string;
  rightAccent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "9px 0",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: INTER,
            fontSize: 12,
            fontWeight: 600,
            color: SCENE_TOKENS.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        {meta ? (
          <div style={{ fontFamily: INTER, fontSize: 9, color: SCENE_TOKENS.muted, marginTop: 2 }}>
            {meta}
          </div>
        ) : null}
      </div>
      {right ? (
        <span
          style={{
            fontFamily: INTER,
            fontSize: 9,
            color: rightAccent ? ACCENT : SCENE_TOKENS.muted,
            flexShrink: 0,
          }}
        >
          {right}
        </span>
      ) : null}
    </div>
  );
}

function SetlistDetailSceneMock() {
  return (
    <PhoneFrame glow>
      <ScenePageHeader title="Festival de la Roche" back />
      <div style={{ fontFamily: INTER, fontSize: 10, color: SCENE_TOKENS.muted, marginTop: 3 }}>
        14 morceaux · 45 min · <span style={{ color: ACCENT }}>12 sept.</span>
      </div>
      <div style={{ marginTop: 12 }}>
        {[
          ["01", "Minuit à Paris", "128 · Dm · 3:24"],
          ["02", "Neon Rivers", "96 · Am · 2:47"],
        ].map(([num, title, meta], i) => (
          <div key={num}>
            {i > 0 ? (
              <div
                style={{
                  fontFamily: INTER,
                  fontSize: 8,
                  color: SCENE_TOKENS.muted,
                  padding: "4px 0 4px 18px",
                }}
              >
                ↓ enchaîné · Dm → Am
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                padding: "9px 10px",
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 10, color: SCENE_TOKENS.muted }}>
                {num}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: INTER,
                    fontSize: 12,
                    fontWeight: 600,
                    color: SCENE_TOKENS.text,
                  }}
                >
                  {title}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: SCENE_TOKENS.muted, marginTop: 2 }}>
                  {meta}
                </div>
              </div>
              <span style={{ fontFamily: INTER, fontSize: 9, color: SCENE_TOKENS.muted }}>↕</span>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 12,
          background: ACCENT,
          borderRadius: 12,
          fontFamily: INTER,
          fontSize: 11,
          fontWeight: 600,
          color: "#fff",
          textAlign: "center",
          padding: "9px 0",
        }}
      >
        Lire la setlist
      </div>
    </PhoneFrame>
  );
}

function CalendarSceneMock() {
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  const eventDays = new Set([3, 12, 19, 26]);
  const today = 6;
  return (
    <PhoneFrame glow>
      <ScenePageHeader title="Calendrier" add />
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
        }}
      >
        {days.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              padding: "5px 0",
              fontFamily: INTER,
              fontSize: 9,
              borderRadius: 6,
              background: d === today ? ACCENT : "transparent",
              color: d === today ? "#fff" : SCENE_TOKENS.text,
              position: "relative",
            }}
          >
            {d}
            {eventDays.has(d) && d !== today ? (
              <div
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 2,
                  background: ACCENT,
                  margin: "1px auto 0",
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            fontFamily: INTER,
            fontSize: 9,
            fontWeight: 700,
            color: SCENE_TOKENS.muted,
            letterSpacing: "0.06em",
          }}
        >
          SAM. 12 SEPT.
        </div>
        <div
          style={{
            marginTop: 6,
            borderLeft: `2px solid ${ACCENT}`,
            paddingLeft: 8,
          }}
        >
          <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: SCENE_TOKENS.text }}>
            Festival de la Roche
          </div>
          <div style={{ fontFamily: INTER, fontSize: 9, color: SCENE_TOKENS.muted, marginTop: 2 }}>
            20:30 · Angers
          </div>
        </div>
      </div>
      <SceneNav />
    </PhoneFrame>
  );
}

function BookingSceneMock() {
  return (
    <PhoneFrame glow>
      <ScenePageHeader title="Booking" add />
      <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
        {["Booking", "Contacts"].map((tab, i) => (
          <span
            key={tab}
            style={{
              fontFamily: INTER,
              fontSize: 11,
              fontWeight: i === 0 ? 700 : 400,
              color: i === 0 ? SCENE_TOKENS.text : SCENE_TOKENS.muted,
              borderBottom: i === 0 ? `2px solid ${ACCENT}` : "2px solid transparent",
              paddingBottom: 3,
            }}
          >
            {tab}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 6 }}>
        <SceneRow
          title="Le Chabada"
          meta="Marie (prog.) · Angers"
          right="relance 12 sept."
          rightAccent
        />
        <SceneRow title="La Maroquinerie" meta="Tom · Paris" right="attente réponse" />
        <SceneRow title="Festival de la Roche" meta="confirmé · 12 sept." right="OK" />
      </div>
      <SceneNav />
    </PhoneFrame>
  );
}

function MetronomeSceneMock() {
  return (
    <PhoneFrame glow>
      <ScenePageHeader title="Métronome" />
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <div
          style={{
            fontFamily: GROTESK,
            fontSize: 44,
            fontWeight: 700,
            color: SCENE_TOKENS.text,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          128
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: SCENE_TOKENS.muted, marginTop: 4 }}>
          BPM · 4/4
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: i === 0 ? ACCENT : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
        <span
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 10,
            fontFamily: MONO,
            fontSize: 10,
            color: SCENE_TOKENS.text,
            padding: "8px 16px",
          }}
        >
          TAP
        </span>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PlayGlyph color="#fff" />
        </span>
      </div>
      <SceneNav />
    </PhoneFrame>
  );
}

function PrompterSceneMock() {
  return (
    <PhoneFrame>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: INTER, fontSize: 11, color: SCENE_TOKENS.muted }}>×</span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: SCENE_TOKENS.muted, letterSpacing: "0.1em" }}>
          PROMPTEUR · FESTIVAL DE LA ROCHE
        </span>
        <span style={{ fontFamily: INTER, fontSize: 11, color: SCENE_TOKENS.muted }}>⚙</span>
      </div>
      <div style={{ height: 2, background: "rgba(255,255,255,0.10)", marginTop: 10 }}>
        <div style={{ width: "40%", height: 2, background: ACCENT }} />
      </div>
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <div style={{ fontFamily: INTER, fontSize: 11, lineHeight: 2, color: "rgba(255,255,255,0.35)" }}>
          On court après le silence
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.8,
            color: SCENE_TOKENS.text,
          }}
        >
          Minuit sonne à Paris
        </div>
        <div style={{ fontFamily: INTER, fontSize: 11, lineHeight: 2, color: "rgba(255,255,255,0.35)" }}>
          Les reverberes s'eteignent
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, lineHeight: 2, color: SCENE_TOKENS.muted }}>
          [Refrain]
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 18,
          fontFamily: INTER,
          fontSize: 9,
          color: SCENE_TOKENS.muted,
        }}
      >
        <span>← Neon Rivers</span>
        <span style={{ color: SCENE_TOKENS.text }}>Minuit à Paris · 3/14</span>
        <span>Sous les néons →</span>
      </div>
    </PhoneFrame>
  );
}

function WriterSceneMock() {
  return (
    <PhoneFrame>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: INTER, fontSize: 12, color: SCENE_TOKENS.muted }}>←</span>
        <span
          style={{
            fontFamily: GROTESK,
            fontSize: 13,
            fontWeight: 700,
            color: SCENE_TOKENS.text,
          }}
        >
          Minuit à Paris
        </span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: ACCENT,
          }}
          title="Synchronisé"
        />
      </div>
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 8,
            letterSpacing: "0.12em",
            color: ACCENT,
            marginBottom: 6,
          }}
        >
          COUPLET 1
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontSize: 12,
            lineHeight: 1.9,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          Sous les néons de la ville
          <br />
          On court après le silence
          <br />
          Minuit sonne à Paris|
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 8,
            letterSpacing: "0.12em",
            color: SCENE_TOKENS.muted,
            margin: "12px 0 6px",
          }}
        >
          REFRAIN
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontSize: 12,
            lineHeight: 1.9,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          Écris le refrain…
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          marginTop: 14,
          paddingTop: 8,
        }}
      >
        {["↩", "↪", "+ Section", "Aa"].map((a) => (
          <span key={a} style={{ fontFamily: INTER, fontSize: 10, color: SCENE_TOKENS.muted }}>
            {a}
          </span>
        ))}
      </div>
    </PhoneFrame>
  );
}

function SyncSceneMock() {
  return (
    <PhoneFrame glow>
      <ScenePageHeader title="Synchronisation" back />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          padding: "10px 12px",
          marginTop: 12,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: ACCENT }} />
          <span style={{ fontFamily: INTER, fontSize: 11, fontWeight: 600, color: SCENE_TOKENS.text }}>
            Cloud à jour
          </span>
        </span>
        <span style={{ fontFamily: INTER, fontSize: 9, color: SCENE_TOKENS.muted }}>
          Forcer
        </span>
      </div>
      <div
        style={{
          marginTop: 12,
          background: "#ffffff",
          borderRadius: 12,
          height: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 8, color: "#000" }}>QR · 2/5</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <SceneRow title="Festival de la Roche" meta="setlist · 14 morceaux" right="hors ligne" />
        <SceneRow title="Minuit à Paris" meta="via setlist" right="hors ligne" />
      </div>
      <SceneNav />
    </PhoneFrame>
  );
}

function AccountSceneMock() {
  return (
    <PhoneFrame glow>
      <ScenePageHeader title="Paramètres" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          padding: "10px 12px",
          marginTop: 12,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            background: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: INTER,
            fontSize: 9,
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          FZ
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: SCENE_TOKENS.text }}>
            FaderZero
          </div>
          <div style={{ fontFamily: INTER, fontSize: 9, color: SCENE_TOKENS.muted }}>
            Groupe · 4 membres
          </div>
        </div>
        <span style={{ fontFamily: INTER, fontSize: 9, color: ACCENT }}>Actif</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <SceneRow title="Profil" right="→" />
        <SceneRow title="Connexion et sécurité" right="→" />
        <SceneRow title="Mon espace" meta="quota audio · pastilles · membres" right="→" />
        <SceneRow title="Synchronisation" right="→" />
      </div>
      <div
        style={{
          marginTop: 12,
          border: `1px solid rgba(255,58,99,0.35)`,
          borderRadius: 12,
          fontFamily: INTER,
          fontSize: 11,
          fontWeight: 600,
          color: ACCENT,
          textAlign: "center",
          padding: "9px 0",
        }}
      >
        Se déconnecter
      </div>
      <SceneNav />
    </PhoneFrame>
  );
}

function LoginSceneMock() {
  return (
    <PhoneFrame glow>
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <div
          style={{
            fontFamily: GROTESK,
            fontSize: 20,
            fontWeight: 700,
            color: SCENE_TOKENS.text,
            letterSpacing: "-0.01em",
          }}
        >
          FaderZero
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 14 }}>
        {["Connexion", "Inscription"].map((tab, i) => (
          <span
            key={tab}
            style={{
              fontFamily: INTER,
              fontSize: 10,
              fontWeight: i === 0 ? 700 : 400,
              color: i === 0 ? SCENE_TOKENS.text : SCENE_TOKENS.muted,
              borderBottom: i === 0 ? `2px solid ${ACCENT}` : "2px solid transparent",
              paddingBottom: 3,
            }}
          >
            {tab}
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: 14,
          background: "#ffffff",
          borderRadius: 12,
          fontFamily: INTER,
          fontSize: 11,
          fontWeight: 600,
          color: "#000",
          textAlign: "center",
          padding: "10px 0",
        }}
      >
        Continuer avec Google
      </div>
      <div
        style={{
          textAlign: "center",
          fontFamily: INTER,
          fontSize: 8,
          color: SCENE_TOKENS.muted,
          margin: "10px 0",
        }}
      >
        ou par e-mail
      </div>
      {["E-mail", "Mot de passe"].map((ph) => (
        <div
          key={ph}
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            padding: "10px 12px",
            fontFamily: INTER,
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            marginBottom: 8,
          }}
        >
          {ph}
        </div>
      ))}
      <div
        style={{
          background: ACCENT,
          borderRadius: 12,
          fontFamily: INTER,
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
          textAlign: "center",
          padding: "11px 0",
        }}
      >
        Se connecter
      </div>
    </PhoneFrame>
  );
}

// ---------------------------------------------------------------------------
// UX d'édition — cibles tactiles ≥ 44 px (règle design-system)
// ---------------------------------------------------------------------------

function SongSceneEditMock() {
  const muted = SCENE_TOKENS.muted;
  const text = SCENE_TOKENS.text;
  const hairline = "1px solid rgba(255,255,255,0.10)";
  return (
    <PhoneFrame glow>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: INTER, fontSize: 12, color: muted }}>←</span>
        <span
          style={{
            fontFamily: INTER,
            fontSize: 9,
            color: muted,
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 999,
            padding: "5px 12px",
            minHeight: 28,
            display: "flex",
            alignItems: "center",
          }}
        >
          Modifier
        </span>
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontFamily: GROTESK,
            fontSize: 21,
            fontWeight: 700,
            color: text,
            letterSpacing: "-0.01em",
          }}
        >
          Minuit à Paris
        </div>
      </div>

      {/* cellules stats : toute la cellule est cliquable, hauteur 56 px */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          borderTop: hairline,
          borderBottom: hairline,
        }}
      >
        {[
          ["TON", "Dm", false],
          ["TEMPO", "128", true],
          ["DURÉE", "3:24", false],
          ["STATUT", "Prêt", false],
        ].map(([label, value, highlighted]) => (
          <div
            key={label as string}
            style={{
              flex: 1,
              minHeight: 52,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              borderLeft: label === "TON" ? "none" : hairline,
              position: "relative",
            }}
          >
            <span
              style={{
                fontFamily: INTER,
                fontSize: 7,
                letterSpacing: "0.1em",
                color: muted,
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: INTER,
                fontSize: 13,
                fontWeight: 600,
                color: highlighted ? ACCENT : text,
                borderBottom: "1px dashed rgba(255,255,255,0.35)",
                paddingBottom: 1,
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          fontFamily: INTER,
          fontSize: 8,
          color: muted,
          textAlign: "center",
          marginTop: 4,
        }}
      >
        cellule entière cliquable · 52 px de haut · pointillé = éditable
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <PlayGlyph color="#fff" />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ height: 2, background: "rgba(255,255,255,0.14)", borderRadius: 1 }}>
            <div style={{ width: "35%", height: 2, background: ACCENT, borderRadius: 1 }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: INTER,
              fontSize: 8,
              color: muted,
              marginTop: 4,
            }}
          >
            <span>1:12</span>
            <span>3:24</span>
          </div>
        </div>
      </div>

      {/* paroles : bloc entier cliquable + bouton Éditer 44 px */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          marginTop: 14,
          paddingTop: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: INTER,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: muted,
            }}
          >
            PAROLES
          </span>
          <span
            style={{
              fontFamily: INTER,
              fontSize: 10,
              fontWeight: 600,
              color: ACCENT,
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              padding: "0 8px",
            }}
          >
            Éditer →
          </span>
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontSize: 12,
            lineHeight: 1.8,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          Sous les néons de la ville
          <br />
          On court après le silence
          <br />
          Minuit sonne à Paris…
        </div>
      </div>
    </PhoneFrame>
  );
}

// ---------------------------------------------------------------------------
// Specimens des chantiers structurels
// ---------------------------------------------------------------------------

function TypeSpecimen() {
  const theme = useHostTheme();
  return (
    <Grid columns={2} gap={10}>
      <div
        style={{
          border: `1px solid ${theme.stroke.tertiary}`,
          borderRadius: 10,
          padding: 12,
          background: "#0a0a0a",
        }}
      >
        <div style={{ fontSize: 9, color: theme.text.tertiary, marginBottom: 6 }}>
          AUJOURD'HUI — TREBUCHET MS
        </div>
        <div
          style={{
            fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
            color: "#f5f5f5",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>Minuit à Paris</div>
          <div style={{ fontSize: 11, color: "#9c9c9c", marginTop: 2 }}>
            128 BPM · Dm · 3:24
          </div>
        </div>
      </div>
      <div
        style={{
          border: "1px solid rgba(255, 58, 99, 0.3)",
          borderRadius: 10,
          padding: 12,
          background: "#000000",
        }}
      >
        <div style={{ fontSize: 9, color: theme.text.tertiary, marginBottom: 6 }}>
          SCÈNE — SPACE GROTESK + INTER
        </div>
        <div style={{ color: "#ffffff" }}>
          <div
            style={{
              fontFamily: GROTESK,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Minuit à Paris
          </div>
          <div
            style={{ fontFamily: INTER, fontSize: 11, color: "#9c9c9c", marginTop: 2 }}
          >
            128 BPM · Dm · 3:24
          </div>
        </div>
      </div>
    </Grid>
  );
}

function SurfaceSpecimen() {
  const theme = useHostTheme();
  return (
    <Grid columns={2} gap={10}>
      <div
        style={{
          border: `1px solid ${theme.stroke.tertiary}`,
          borderRadius: 10,
          padding: 12,
          background: "#0a0a0a",
        }}
      >
        <div style={{ fontSize: 9, color: theme.text.tertiary, marginBottom: 6 }}>
          AUJOURD'HUI — GRADIENT + BLUR + OMBRE
        </div>
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02), transparent)",
            padding: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5" }}>
            Tuile hero
          </div>
          <div style={{ fontSize: 10, color: "#9c9c9c" }}>
            backdrop-blur · shadow-xl · gradient
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            borderRadius: 10,
            background: "linear-gradient(180deg, #ff547b, #ff2f5c)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            textAlign: "center",
            padding: "6px 0",
          }}
        >
          Bouton gradient
        </div>
      </div>
      <div
        style={{
          border: "1px solid rgba(255, 58, 99, 0.3)",
          borderRadius: 10,
          padding: 12,
          background: "#000000",
        }}
      >
        <div style={{ fontSize: 9, color: theme.text.tertiary, marginBottom: 6 }}>
          SCÈNE — PLAT + HAIRLINES
        </div>
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
            padding: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
            Tuile hero
          </div>
          <div style={{ fontSize: 10, color: "#9c9c9c" }}>
            fond plat · hairline · zéro ombre
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            borderRadius: 10,
            background: ACCENT,
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            textAlign: "center",
            padding: "6px 0",
          }}
        >
          Bouton plat #ff3a63
        </div>
      </div>
    </Grid>
  );
}

const THEMATIC_COLORS = [
  { name: "Accueil / Rec", hex: "#ff3a63" },
  { name: "Métronome", hex: "#fbbf24" },
  { name: "Prompteur", hex: "#38bdf8" },
  { name: "Nouveau", hex: "#34d399" },
  { name: "Morceaux", hex: "#818cf8" },
  { name: "Setlists", hex: "#e879f9" },
  { name: "Calendrier", hex: "#2dd4bf" },
  { name: "Booking", hex: "#fb923c" },
];

function ThematicColorsSpecimen() {
  const theme = useHostTheme();
  return (
    <Stack gap={8}>
      <Row gap={6} wrap>
        {THEMATIC_COLORS.map((c) => (
          <div
            key={c.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${theme.stroke.tertiary}`,
              borderRadius: 999,
              padding: "3px 10px 3px 4px",
            }}
          >
            <div
              style={{ width: 14, height: 14, borderRadius: 7, background: c.hex }}
            />
            <span style={{ fontSize: 10, color: theme.text.secondary }}>{c.name}</span>
          </div>
        ))}
      </Row>
      <Text size="small" tone="tertiary">
        En mode Scène, ces 8 teintes quittent les tuiles et les en-têtes : tout
        est monochrome au repos. Elles peuvent survivre à un seul endroit —
        l'icône de l'onglet actif de la barre de navigation — ou disparaître
        complètement au profit du seul rose. À trancher.
      </Text>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Popups & pickers en Scène
// ---------------------------------------------------------------------------

function DialogSceneMock({
  title,
  children,
}: {
  title: string;
  children: any;
}) {
  return (
    <div
      style={{
        width: 236,
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "#000000",
        padding: "10px 14px 16px",
      }}
    >
      {/* poignée bottom sheet */}
      <div
        style={{
          width: 32,
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.2)",
          margin: "0 auto 10px",
        }}
      />
      <div
        style={{
          fontFamily: GROTESK,
          fontSize: 13,
          fontWeight: 700,
          color: SCENE_TOKENS.text,
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function StatusPickerSceneMock() {
  const options = ["Idée", "En cours", "Prêt"];
  return (
    <DialogSceneMock title="Statut de création">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {options.map((opt) => {
          const selected = opt === "En cours";
          return (
            <div
              key={opt}
              style={{
                borderRadius: 12,
                padding: "12px 0",
                textAlign: "center",
                fontFamily: INTER,
                fontSize: 11,
                fontWeight: 600,
                background: selected ? ACCENT : "rgba(255,255,255,0.06)",
                color: selected ? "#ffffff" : "rgba(255,255,255,0.78)",
              }}
            >
              {opt}
            </div>
          );
        })}
      </div>
    </DialogSceneMock>
  );
}

function KeyPickerSceneMock() {
  const keys = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  return (
    <DialogSceneMock title="Sélectionner la tonalité">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        {keys.map((k) => {
          const selected = k === "D";
          return (
            <div
              key={k}
              style={{
                borderRadius: 12,
                padding: "10px 0",
                textAlign: "center",
                fontFamily: INTER,
                fontSize: 12,
                fontWeight: 600,
                background: selected ? ACCENT : "rgba(255,255,255,0.06)",
                color: selected ? "#ffffff" : "rgba(255,255,255,0.78)",
              }}
            >
              {k}
            </div>
          );
        })}
      </div>
    </DialogSceneMock>
  );
}

function BpmWheelSceneMock() {
  const values = ["126", "127", "128", "129", "130"];
  return (
    <DialogSceneMock title="Sélectionner le tempo">
      <div style={{ textAlign: "center" }}>
        {values.map((v, i) => {
          const selected = v === "128";
          return (
            <div
              key={v}
              style={{
                fontFamily: INTER,
                fontSize: selected ? 20 : 13,
                fontWeight: selected ? 700 : 400,
                color: selected
                  ? SCENE_TOKENS.text
                  : `rgba(255,255,255,${0.55 - Math.abs(i - 2) * 0.18})`,
                padding: "5px 0",
                borderTop: selected ? "1px solid rgba(255,255,255,0.25)" : "none",
                borderBottom: selected ? "1px solid rgba(255,255,255,0.25)" : "none",
              }}
            >
              {v}
              {selected ? (
                <span style={{ fontSize: 10, color: SCENE_TOKENS.muted }}> BPM</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </DialogSceneMock>
  );
}

function FormSceneMock() {
  return (
    <DialogSceneMock title="Nouveau morceau">
      <div
        style={{
          fontFamily: INTER,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: SCENE_TOKENS.muted,
          marginBottom: 5,
        }}
      >
        TITRE
      </div>
      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
          padding: "10px 12px",
          fontFamily: INTER,
          fontSize: 12,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        Ex. Last Train Home
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div
          style={{
            flex: 1,
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            fontFamily: INTER,
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            textAlign: "center",
            padding: "11px 0",
          }}
        >
          Annuler
        </div>
        <div
          style={{
            flex: 1,
            borderRadius: 12,
            background: ACCENT,
            fontFamily: INTER,
            fontSize: 12,
            fontWeight: 600,
            color: "#ffffff",
            textAlign: "center",
            padding: "11px 0",
          }}
        >
          Créer
        </div>
      </div>
    </DialogSceneMock>
  );
}

// ---------------------------------------------------------------------------
// Section écran (Scène uniquement)
// ---------------------------------------------------------------------------

function ScreenSection({
  title,
  source,
  diagnostics,
  changes,
  mock,
}: {
  title: string;
  source: string;
  diagnostics: string[];
  changes: string[];
  mock: any;
}) {
  const theme = useHostTheme();
  return (
    <Card>
      <CardBody>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <div>
            <MockCaption label={title} />
            {mock}
          </div>
          <div style={{ flex: "1 1 280px", minWidth: 260 }}>
            <Stack gap={10}>
              <Text size="small" tone="tertiary">
                {source}
              </Text>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: theme.text.tertiary,
                    marginBottom: 4,
                  }}
                >
                  CE QUI CLOCHE AUJOURD'HUI
                </div>
                <Stack gap={3}>
                  {diagnostics.map((d) => (
                    <div
                      key={d}
                      style={{
                        display: "flex",
                        gap: 6,
                        fontSize: 11,
                        color: theme.text.secondary,
                        lineHeight: 1.45,
                      }}
                    >
                      <span style={{ color: theme.text.tertiary, flexShrink: 0 }}>—</span>
                      <span>{d}</span>
                    </div>
                  ))}
                </Stack>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: theme.text.tertiary,
                    marginBottom: 4,
                  }}
                >
                  CE QUE SCÈNE CHANGE
                </div>
                <Stack gap={3}>
                  {changes.map((c) => (
                    <div
                      key={c}
                      style={{
                        display: "flex",
                        gap: 6,
                        fontSize: 11,
                        color: theme.text.secondary,
                        lineHeight: 1.45,
                      }}
                    >
                      <span style={{ color: ACCENT, flexShrink: 0 }}>—</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </Stack>
              </div>
            </Stack>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export default function SceneDirection() {
  const mutedRatio = contrastRatio(SCENE_TOKENS.muted, SCENE_TOKENS.bg);

  return (
    <Stack gap={24} style={{ padding: 4 }}>
      <Stack gap={6}>
        <H1>FaderZero — direction Scène</H1>
        <Text tone="secondary" size="small">
          Noir absolu, monochrome au repos, et le rose `#ff3a63` réservé au
          vivant : lecture, enregistrement, onglet actif, prochaine setlist. Un
          seul halo rose très doux en haut de l'écran, comme un follow. Les
          fontes citées (Space Grotesk, Inter) sont libres ; le rendu utilise
          des fallbacks si elles ne sont pas installées.
        </Text>
      </Stack>

      {/* ================================================================ */}
      <Stack gap={10}>
        <H2>Tokens Scène</H2>
        <Grid columns={7} gap={8}>
          <SwatchBox label="Fond" value={SCENE_TOKENS.bg} />
          <SwatchBox label="Surface" value={SCENE_TOKENS.surface} />
          <SwatchBox label="Tuile" value={SCENE_TOKENS.tile} chipBg={SCENE_TOKENS.bg} />
          <SwatchBox label="Texte" value={SCENE_TOKENS.text} />
          <SwatchBox label="Atténué" value={SCENE_TOKENS.muted} />
          <SwatchBox label="Accent" value={SCENE_TOKENS.accent} />
          <SwatchBox label="Hairline" value={SCENE_TOKENS.border} chipBg={SCENE_TOKENS.bg} />
        </Grid>
        <Text size="small" tone="tertiary">
          Contraste du texte atténué sur noir : {mutedRatio.toFixed(1)}:1 —
          largement au-dessus du seuil WCAG AA (4.5:1). Remplacement direct des
          tokens `--fz-*` dans `src/app/styles.css`.
        </Text>
      </Stack>

      <Divider />

      {/* ================================================================ */}
      <Stack gap={12}>
        <H2>Les écrans en Scène</H2>
        <Grid columns={2} gap={12}>
          <div>
            <MockCaption label="Accueil" />
            <HomeSceneMock />
          </div>
          <div>
            <MockCaption label="Morceaux" />
            <SongsSceneMock />
          </div>
          <div>
            <MockCaption label="Setlists" />
            <SetlistsSceneMock />
          </div>
          <div>
            <MockCaption label="Fiche morceau" />
            <SongSceneMock />
          </div>
        </Grid>
      </Stack>

      <ScreenSection
        title="Morceaux — diagnostic"
        source="src/features/songs/SongsPage.tsx · ContentRow"
        diagnostics={[
          "Placeholders « BPM -- · Ton -- · --:-- » sur chaque ligne quand la donnée n'existe pas (SongsPage.tsx:1024-1029).",
          "Double ligne de méta : pill + « ✓ Paroles · 0 audios · 0 setlists » (SongsPage.tsx:1030-1043) — lignes très hautes.",
          "Compteurs affichés même à zéro.",
          "Titres font-black + méta caps trackées : tout crie.",
          "Trois couleurs de pill (gris / rose / vert) en concurrence.",
        ]}
        changes={[
          "N'afficher que les données réelles ; une seule ligne de méta.",
          "Statut en texte discret, rose uniquement pour « En cours ».",
          "Bouton lecture monochrome au repos, rose pendant la lecture.",
          "Recherche en pilule plate, titre de page en Space Grotesk.",
        ]}
        mock={<SongsSceneMock />}
      />

      <ScreenSection
        title="Setlists — diagnostic"
        source="src/features/setlists/SetlistsPage.tsx · ContentRow"
        diagnostics={[
          "La date du concert existe en base mais n'apparaît pas (SetlistsPage.tsx:146-149).",
          "Aucune distinction de la prochaine setlist — l'info la plus utile de l'écran.",
          "Lignes interchangeables, sans identité ni hiérarchie.",
        ]}
        changes={[
          "Date du concert affichée dans chaque ligne (champ existant).",
          "Prochaine setlist signalée par « · prochaine » en rose.",
          "Nom en 600 à 13 px, méta discrète, séparateurs white/8.",
        ]}
        mock={<SetlistsSceneMock />}
      />

      <ScreenSection
        title="Fiche morceau — diagnostic"
        source="src/features/songs/SongDetailPage.tsx · DetailHeader"
        diagnostics={[
          "Quatre boîtes grises empilées (audio, stats, notes, paroles) : un mur de cartes sans hiérarchie.",
          "Actions d'en-tête en trois couleurs (sky / amber / rose — SongDetailPage.tsx:686-714), contraire à la règle DetailHeader.",
          "Stats en micro-labels 0.58rem avec « -- » quand la donnée manque.",
          "Player sans progression ni timecode, alors que c'est l'action principale.",
          "Paroles enfermées dans une boîte grise au lieu d'être le contenu.",
        ]}
        changes={[
          "Actions d'en-tête neutres ; le danger reste porté par l'icône, pas une couleur.",
          "Player hero : grand bouton rose + barre de progression + timecodes.",
          "Meta en une ligne « Dm · 128 BPM · 3:24 · Prêt » — plus de grille en boîte.",
          "Paroles directement sur le noir, interligne généreux.",
        ]}
        mock={<SongSceneMock />}
      />

      <Divider />

      {/* ================================================================ */}
      <Stack gap={12}>
        <H2>Toutes les pages — inventaire & maquettes</H2>
        <Text tone="secondary" size="small">
          Recensement complet des routes de l'app. Les quatre écrans principaux
          sont déjà maquettés ci-dessus ; voici les neuf autres pages, déclinées
          en Scène.
        </Text>
        <Table
          headers={["Route", "Page", "Statut"]}
          rows={[
            ["/home", "Accueil", "Maquetté ci-dessus et repris ci-dessous"],
            ["/songs", "Morceaux", "Maquetté ci-dessus"],
            ["/setlists", "Setlists", "Maquetté ci-dessus"],
            ["/songs/:id", "Fiche morceau", "Maquetté ci-dessus"],
            ["/setlists/:id", "Détail setlist", "Nouveau mock"],
            ["/calendar", "Calendrier", "Nouveau mock"],
            ["/booking · /booking/:id", "Booking (liste + détail)", "Nouveau mock"],
            ["/metronome", "Métronome", "Nouveau mock"],
            ["/prompter · /prompter/play", "Prompteur (biblio + lecture)", "Nouveau mock"],
            ["/songs/:id/write", "Éditeur de paroles", "Nouveau mock"],
            ["/sync", "Synchronisation", "Nouveau mock"],
            ["/account", "Paramètres", "Nouveau mock"],
            ["connexion / choix d'espace", "Auth", "Nouveau mock"],
            ["/landing · /account/epk", "Landing & EPK public", "Hors périmètre (vitrine)"],
          ]}
        />
        <Grid columns={3} gap={12}>
          <div>
            <HomeSceneMock />
            <MockCaption label="Accueil — hero « dernière modif » en tuile plate, grille 4×2 d'outils monochrome (seul REC est rose, badge relances Booking rose), dates et activité en lignes à filets." />
          </div>
          <div>
            <SetlistDetailSceneMock />
            <MockCaption label="Détail setlist — tuiles numérotées (mono), enchaînements en texte discret, date dans le sous-titre, CTA « Lire » rose unique." />
          </div>
          <div>
            <CalendarSceneMock />
            <MockCaption label="Calendrier — grille plate, aujourd'hui en rose plein, point rose sous les jours d'événement, liste du jour avec filet rose à gauche." />
          </div>
          <div>
            <BookingSceneMock />
            <MockCaption label="Booking — onglets soulignés rose (plus de pastille blanche), relances dues en rose, statuts en texte monochrome." />
          </div>
        </Grid>
        <Grid columns={3} gap={12}>
          <div>
            <MetronomeSceneMock />
            <MockCaption label="Métronome — BPM géant grotesk, temps actifs en points roses, TAP en outline, play rose plein." />
          </div>
          <div>
            <PrompterSceneMock />
            <MockCaption label="Prompteur (lecture) — noir plein, ligne courante blanche agrandie, filet de progression rose, navigation sobre en bas." />
          </div>
          <div>
            <WriterSceneMock />
            <MockCaption label="Éditeur de paroles — labels de section en mono rose, texte confortable, toolbar minimale en bas." />
          </div>
        </Grid>
        <Grid columns={3} gap={12}>
          <div>
            <SyncSceneMock />
            <MockCaption label="Synchronisation — statut cloud en tuile plate, QR code sur bloc blanc, éléments hors ligne en lignes à filets." />
          </div>
          <div>
            <AccountSceneMock />
            <MockCaption label="Paramètres — groupe actif en tuile avec pastille rose, sections en lignes à filets, déconnexion en outline rose." />
          </div>
          <div>
            <LoginSceneMock />
            <MockCaption label="Connexion — logo grotesk, Google en blanc plein, champs plats, CTA rose, onglets soulignés." />
          </div>
        </Grid>
      </Stack>

      <Divider />

      {/* ================================================================ */}
      <Stack gap={12}>
        <H2>UX d'édition — tuer l'appui long, avec de vraies cibles</H2>
        <Callout tone="danger" title="Le problème actuel">
          L'appui long est le seul déclencheur d'édition : invisible et
          indécouvrable. Le mode édition global (formulaire + autosave 280 ms,
          SongDetailPage.tsx:139) est du code mort — `setIsEditMode(true)`
          n'est appelé nulle part. Les pickers de quick-edit (roue BPM, roue
          durée, tonalités, statut) existent déjà et sont bons : il ne manque
          que des déclencheurs à la bonne taille.
        </Callout>
        <Text size="small" tone="secondary">
          Première idée abandonnée : taper directement « 128 BPM » en ligne —
          cible de ~10 px, hors normes. La règle design-system impose ≥ 44 × 44
          px. La solution : la méta en ligne devient une rangée de cellules
          plates de 52 px de haut, entièrement cliquables, séparées par des
          hairlines. Le pointillé sous la valeur signale l'éditabilité.
        </Text>
        <Grid columns={2} gap={12}>
          <div>
            <MockCaption label="Fiche Scène — zones d'édition ≥ 44 px" />
            <SongSceneEditMock />
          </div>
          <div>
            <MockCaption label="Flux au tap — tout existe déjà" />
            <Card>
              <CardBody>
                <Stack gap={8}>
                  {[
                    ["Tap cellule TEMPO (52 px)", "Roue BPM — PickerDialog + WheelColumn existants"],
                    ["Tap cellule DURÉE", "Double roue min/sec existante"],
                    ["Tap cellule TON", "Grille de tonalités existante"],
                    ["Tap cellule STATUT", "Choix de statut existant"],
                    ["Tap bloc paroles ou « Éditer → » (32-44 px)", "Éditeur /write plein écran"],
                    ["Tap « Modifier » (en-tête)", "Mode édition global + autosave — code à reconnecter"],
                  ].map(([trigger, result]) => (
                    <div key={trigger} style={{ fontSize: 11, lineHeight: 1.5 }}>
                      <Text size="small" weight="semibold">
                        {trigger}
                      </Text>
                      <Text size="small" tone="tertiary">
                        → {result}
                      </Text>
                    </div>
                  ))}
                </Stack>
              </CardBody>
            </Card>
          </div>
        </Grid>
        <Table
          headers={["Pattern", "Cible tactile", "Verdict"]}
          rows={[
            ["Appui long (actuel)", "Grande mais invisible", "À détrôner — reste comme raccourci"],
            ["Tap sur valeur inline 10 px", "~10 px — hors normes", "Abandonné"],
            ["Cellules 52 px + pointillé", "≥ 44 px garanti", "Retenu pour les stats"],
            ["Bloc paroles + « Éditer → »", "≥ 44 px garanti", "Retenu pour les paroles et notes"],
            ["Bouton « Modifier » en-tête", "≥ 44 px garanti", "Retenu pour la retouche multiple"],
          ]}
          rowTone={["danger", "danger", "success", "success", "success"]}
          striped
        />
      </Stack>

      <Divider />

      {/* ================================================================ */}
      <Stack gap={12}>
        <H2>Popups &amp; pickers en Scène</H2>
        <Text size="small" tone="secondary">
          Tes deux captures le montrent bien : la sélection est indigo sur le
          statut (SongDetailPage.tsx:1265) et émeraude sur la tonalité
          (SongDetailPage.tsx:1300), sur des panneaux `.fz-card` en
          glassmorphism. En Scène, une seule couleur de sélection existe : le
          rose — c'est un état actif, donc il entre dans la réserve « rose =
          vivant ».
        </Text>
        <Grid columns={2} gap={12}>
          <div>
            <MockCaption label="Picker statut" />
            <StatusPickerSceneMock />
          </div>
          <div>
            <MockCaption label="Picker tonalité" />
            <KeyPickerSceneMock />
          </div>
          <div>
            <MockCaption label="Roue BPM" />
            <BpmWheelSceneMock />
          </div>
          <div>
            <MockCaption label="Formulaire (Nouveau morceau)" />
            <FormSceneMock />
          </div>
        </Grid>
        <div>
          <MockCaption label="En contexte — la bottom sheet sur la fiche morceau" />
          <Grid columns={2} gap={12}>
            <SongSceneWithSheetMock sheet="status" />
            <SongSceneWithSheetMock sheet="key" />
          </Grid>
          <Text size="small" tone="tertiary" style={{ marginTop: 6 }}>
            Sheet noire comme la page ; le dessous est flouté `blur(6px)` et
            éclairci par un voile `white/7` — la page devient laiteuse, la
            popup tranche net. La sélection rose est le seul élément saturé de
            l'écran composé.
          </Text>
        </div>
        <div>
          <Text size="small" weight="semibold">
            Règles communes à tous les dialogues
          </Text>
          <Stack gap={3}>
            {[
              "Panneau : noir pur #000 + hairline white/18 ; la page en dessous est floutée blur(6px) et éclaircie (voile white/7) pour détacher la popup — jamais de gris neutre, zéro ombre (fin de .fz-card).",
              "Sélection = rose plat #ff3a63 partout (statut, tonalité, pickers, options) — fini l'indigo et l'émeraude.",
              "Options au repos : white/6, texte 600 à 12-13 px — fin du font-black.",
              "Roues (BPM, durée) : la ligne sélectionnée est marquée par deux hairlines, pas par un rectangle gris.",
              "Formulaires : champ plat white/4, focus = hairline rose ; primaire « Créer » en rose plat, secondaire en white/6, casse phrase et graisse 600 — fin de l'uppercase font-black.",
              "Danger (suppressions) : contour rose/rouge plat, jamais de fond saturé — la seule exception chromatique avec la sélection.",
              "ConfirmDialog, FormDialog, PickerDialog partagent ces règles — aucune variante locale.",
            ].map((rule) => (
              <div
                key={rule}
                style={{
                  display: "flex",
                  gap: 6,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: ACCENT, flexShrink: 0 }}>—</span>
                <Text size="small" tone="secondary">
                  {rule}
                </Text>
              </div>
            ))}
          </Stack>
        </div>
      </Stack>

      <Divider />

      {/* ================================================================ */}
      <Stack gap={12}>
        <H2>Chantiers structurels</H2>

        <Stack gap={10}>
          <H3>1 · Typographie</H3>
          <Text size="small" tone="secondary">
            `Trebuchet MS` (styles.css:5) → `Space Grotesk` pour les titres,
            `Inter` pour le corps. Graisses 400 / 600 / 700 uniquement — fin du
            `font-black` omniprésent. Labels caps : tracking 0.16em → 0.08em.
          </Text>
          <TypeSpecimen />
        </Stack>

        <Stack gap={10}>
          <H3>2 · Fond</H3>
          <Text size="small" tone="secondary">
            Supprimer les 3 radial-gradients + linear-gradient + grille
            `body::before` (styles.css:7-13 et 80-117). Noir pur, un seul halo
            rose ≤ 6 % en haut de l'accueil et des fiches.
          </Text>
        </Stack>

        <Stack gap={10}>
          <H3>3 · Surfaces</H3>
          <Text size="small" tone="secondary">
            Fin du glassmorphism : `.fz-card` (gradient + blur 22 px + ombre),
            hero `shadow-xl`, ombre de la nav `0 -16px 40px`. Tout devient plat
            : `white/3%`, hairlines `white/10`, bouton primaire plat `#ff3a63`.
          </Text>
          <SurfaceSpecimen />
        </Stack>

        <Stack gap={10}>
          <H3>4 · Couleurs thématiques</H3>
          <ThematicColorsSpecimen />
        </Stack>

        <Stack gap={10}>
          <H3>5 · Micro-effets</H3>
          <Text size="small" tone="secondary">
            Retirer `animate-pulse` (badge booking, indicateurs) et les glows
            (`shadow-[0_0_16px_…]`). Un seul retour tactile partagé :
            `active:scale-[0.98]`, 120 ms.
          </Text>
        </Stack>
      </Stack>

      <Divider />

      {/* ================================================================ */}
      <Stack gap={10}>
        <H2>Priorisation</H2>
        <Table
          headers={["Chantier", "Impact", "Effort", "Fichiers principaux"]}
          rows={[
            ["UX d'édition (cellules + reconnexion mode édition)", "Fort (usage quotidien)", "Faible", "SongDetailPage.tsx"],
            ["Typographie", "Fort", "Faible", "styles.css + index.html"],
            ["Fond noir pur", "Fort", "Faible", "styles.css (body, body::before)"],
            ["Surfaces plates + nav allégée", "Fort", "Moyen", "styles.css, HomePage.tsx, AppShell.tsx"],
            ["Listes Morceaux / Setlists (données réelles, dates)", "Moyen", "Faible", "SongsPage.tsx, SetlistsPage.tsx"],
            ["Pickers & dialogues (sélection rose, panneaux plats)", "Moyen", "Faible", "SongDetailPage.tsx, PickerDialog, FormDialog, .fz-card"],
            ["Couleurs thématiques + micro-effets", "Moyen", "Faible", "HomePage.tsx, AppShell.tsx"],
          ]}
          rowTone={["success", "success", "success", "success", "neutral", "neutral"]}
          striped
        />
        <Callout tone="success" title="Par où commencer">
          <Text size="small">
            L'UX d'édition est le meilleur premier chantier : il touche un
            usage quotidien, réutilise des dialogues existants et ne dépend
            d'aucun choix graphique. Ensuite typo + fond + surfaces, qui
            installent Scène partout en quelques tokens.
          </Text>
        </Callout>
      </Stack>
    </Stack>
  );
}
