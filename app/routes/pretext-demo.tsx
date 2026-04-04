import { useEffect, useRef } from "react";
import { prepareWithSegments, layoutNextLine } from "@chenglou/pretext";
import type { PreparedTextWithSegments, LayoutCursor } from "@chenglou/pretext";

// ─── Article body ─────────────────────────────────────────────────────────────
const ARTICLE_TEXT = `The Cartography of Forgotten Things

There is a peculiar kind of map that exists only in memory. It is drawn not with ink or pixels but with the slow sediment of experience — each path etched by the rubber soles of shoes worn down across years of walking, each landmark fixed not by coordinates but by emotion. I have been thinking about these maps lately, especially in the context of what it means to truly know a place, and what it means to lose that knowledge when a place changes beyond recognition.

I grew up in a mid-sized city that was once famous for its textile mills. By the time I was born, the mills had been shuttered for two decades, but their bones remained — massive brick cathedrals to the industrial age, shedding their facades in slow cascades of crumbling mortar. My childhood map was anchored by these ruins. There was the mill on Archer Street with the smashed-out windows on the fourth floor that pigeons colonized every spring. There was the canal behind the Hutchinson complex, half-silted with decades of neglect, where we caught crayfish in summer and skated badly in January. There was the watchtower nobody could quite explain, taller than the surrounding structures, its wrought-iron staircase still functional but forbidden.

These places did not appear on any official map of the city. They appeared only on ours — the informal, collaborative cartography maintained by children with too much free time and just enough courage to cross a fence. It was a living document, updated through whispered conversations and daring excursions. The abandoned buildings shifted constantly: floors collapsed, new sections became accessible, security guards appeared and disappeared. Navigating this landscape required constant revision.

What I did not understand then, but understand now, is that this kind of mapping is one of the oldest human activities. Before the age of satellite imagery and GPS, before the careful surveys of the Enlightenment and the elaborate portolan charts of medieval navigators, there was only the map carried in the mind — the cognitive landscape assembled from walking and looking and remembering. Archaeologists have found carved stones they believe represent territorial boundaries, river systems, constellations. The impulse to make the world legible, to translate experience into something that can be shared or recalled, is as old as the species itself.

The problem with mental maps is their fragility. They depend on the continued existence of the anchoring landmarks. When the mills were finally demolished — most of them, over the course of a decade, converted or simply razed for new development — something more than architecture disappeared. The map became illegible. Streets I had known by feel and by the particular quality of the light that bounced off that particular brick wall became alien corridors. I would drive through neighborhoods I had spent thousands of hours in and feel a disorientation that was almost physical, a kind of vertigo triggered not by height but by the loss of reference.

This phenomenon has been studied, though not exhaustively. There is a term used in some environmental psychology circles — place attachment — which describes the emotional bonds people form with specific locations. When those locations change, the bond does not simply dissolve; it becomes a kind of grief, an affective loss with no clear social script for processing it. Nobody sends condolences when a building is torn down. The bereavement is private, frequently dismissed even by the mourner as sentimental or irrational.

But I think there is something genuinely important being lost, something beyond sentiment. The mental maps we carry are not merely navigation aids. They are cognitive scaffolding for memory itself. Episodic memories — the stuff of personal history, the specific events that constitute a life — are deeply tied to place. Remove the place and the memories become harder to access, more abstract, less vivid. The city is not just a backdrop to a life; it is a kind of external hard drive for the memories that make up a self.

I notice this most acutely when I return. There is a bench that used to sit at the edge of the park near my parents' house — an unremarkable wooden bench, green-painted, slightly warped from years of rain and freezing. I sat on that bench when I was seventeen and had a conversation that changed the direction of my life. The bench is gone now, replaced by a modern composite structure that is no doubt more durable and probably more comfortable. But I cannot locate the memory as precisely anymore. It floats somewhat unmoored, clear in its emotional content but uncertain in its spatial grounding.

Perhaps this is merely an artifact of how human memory works — imprecise, reconstructive, always a little less reliable than we would like. Perhaps the bench was never doing the work I thought it was doing. But I do not think so. I think the geography of a life matters, that the places we move through leave their shape on the memories we form, and that when those places change, we lose something real: a coordinate system for the self, drawn in chalk on the pavement of years.`;

// ─── Typography ───────────────────────────────────────────────────────────────
const DISPLAY_FAMILY = '"Anton", "Impact", sans-serif';
const BODY_FONT = '17px "Playfair Display", Georgia, serif';
const MONO_FAMILY = '"JetBrains Mono", "Courier New", monospace';

// ─── Layout zones (px) ────────────────────────────────────────────────────────
const TOP_BAR_H = 38;
const BOT_BAR_H = 50;
const HL_SIZE = 74; // headline font-size
const HL_LINE_H = HL_SIZE * 1.06;
const HL_PAD_T = 20;
const HL_PAD_B = 22;
const HL_ZONE_H = HL_PAD_T + HL_LINE_H * 2 + HL_PAD_B;
const TEXT_START = TOP_BAR_H + HL_ZONE_H; // Y where article text begins
const PAD_X = 60;
const LINE_H = 30;
const SPHERE_R = 128;
const SPHERE_GAP = 10; // clearance between sphere edge and text

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#09080d",
  bar: "#0d0b15",
  sep: "#1c192a",
  body: "#c4bfb3",
  hl: "#edeade",
  accent: "#c8a74a",
  muted: "#38344a",
  midMuted: "#65607a",
} as const;

type SphereState = { x: number; y: number; r: number };
type DragState = { active: boolean; ox: number; oy: number };
type FpsState = { frames: number; lastTime: number; fps: number };

export function PretextDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sphereRef = useRef<SphereState>({ x: 0, y: 0, r: SPHERE_R });
  const dragRef = useRef<DragState>({ active: false, ox: 0, oy: 0 });
  const prepRef = useRef<PreparedTextWithSegments | null>(null);
  const rafRef = useRef<number>(0);
  const fpsRef = useRef<FpsState>({
    frames: 0,
    lastTime: performance.now(),
    fps: 0,
  });
  const grainRef = useRef<HTMLCanvasElement | null>(null);
  const fontsRef = useRef<boolean>(false);
  const statsRef = useRef({ lines: 0, ms: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Pre-compute grain canvas ──────────────────────────────────────────────
    const gCvs = document.createElement("canvas");
    gCvs.width = 256;
    gCvs.height = 256;
    const gCtx = gCvs.getContext("2d")!;
    const gd = gCtx.createImageData(256, 256);
    for (let i = 0; i < gd.data.length; i += 4) {
      const v = Math.floor(Math.random() * 55);
      gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = v;
      gd.data[i + 3] = 16;
    }
    gCtx.putImageData(gd, 0, 0);
    grainRef.current = gCvs;

    // ── Inject Google Fonts ───────────────────────────────────────────────────
    const FONT_ID = "__pd-fonts";
    if (!document.getElementById(FONT_ID)) {
      const lnk = document.createElement("link");
      lnk.id = FONT_ID;
      lnk.rel = "stylesheet";
      lnk.href =
        "https://fonts.googleapis.com/css2?family=Anton&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap";
      document.head.appendChild(lnk);
    }

    // Wait for fonts, then invalidate prepared text
    Promise.allSettled([
      document.fonts.load(`${HL_SIZE}px "Anton"`),
      document.fonts.load('17px "Playfair Display"'),
      document.fonts.load(`12px "JetBrains Mono"`),
    ]).then(() => {
      fontsRef.current = true;
      prepRef.current = null; // re-measure with correct font
    });

    // ── Resize ────────────────────────────────────────────────────────────────
    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (sphereRef.current.x === 0) {
        sphereRef.current.x = window.innerWidth * 0.63;
        sphereRef.current.y =
          TOP_BAR_H +
          HL_ZONE_H +
          (window.innerHeight - TOP_BAR_H - HL_ZONE_H - BOT_BAR_H) * 0.48;
      }
      prepRef.current = null;
    }
    resize();
    window.addEventListener("resize", resize);

    // ── Drag ──────────────────────────────────────────────────────────────────
    function onDown(e: MouseEvent) {
      const { x, y, r } = sphereRef.current;
      const dx = e.clientX - x,
        dy = e.clientY - y;
      if (dx * dx + dy * dy <= r * r) {
        dragRef.current = { active: true, ox: dx, oy: dy };
        canvas!.style.cursor = "grabbing";
      }
    }
    function onMove(e: MouseEvent) {
      if (dragRef.current.active) {
        sphereRef.current.x = e.clientX - dragRef.current.ox;
        sphereRef.current.y = e.clientY - dragRef.current.oy;
      } else {
        const { x, y, r } = sphereRef.current;
        const dx = e.clientX - x,
          dy = e.clientY - y;
        canvas!.style.cursor = dx * dx + dy * dy <= r * r ? "grab" : "default";
      }
    }
    function onUp() {
      dragRef.current.active = false;
      canvas!.style.cursor = "default";
    }

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    window.addEventListener("mouseup", onUp);

    // ── Draw helpers ──────────────────────────────────────────────────────────
    function drawTopBar(W: number) {
      ctx!.fillStyle = C.bar;
      ctx!.fillRect(0, 0, W, TOP_BAR_H);
      ctx!.fillStyle = C.sep;
      ctx!.fillRect(0, TOP_BAR_H - 1, W, 1);
      ctx!.font = `500 11px ${MONO_FAMILY}`;
      ctx!.fillStyle = C.muted;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText(
        "DRAG THE ORB  ·  TEXT REFLOWS AT 60FPS  ·  ZERO REACT STATE UPDATES  ·  @CHENGLOU/PRETEXT",
        W / 2,
        TOP_BAR_H / 2,
      );
    }

    function drawHeadline(W: number) {
      const font = fontsRef.current ? DISPLAY_FAMILY : '"Impact", sans-serif';
      ctx!.textAlign = "left";
      ctx!.textBaseline = "top";
      const y0 = TOP_BAR_H + HL_PAD_T;
      ctx!.font = `${HL_SIZE}px ${font}`;
      ctx!.fillStyle = C.hl;
      ctx!.fillText("THE FUTURE OF TEXT LAYOUT", PAD_X, y0);
      ctx!.fillStyle = C.accent;
      ctx!.fillText("IS NOT CSS.", PAD_X, y0 + HL_LINE_H);
      // rule
      const ruleY = y0 + HL_LINE_H * 2 + HL_PAD_B * 0.4;
      ctx!.fillStyle = C.sep;
      ctx!.fillRect(PAD_X, ruleY, W - PAD_X * 2, 1);
    }

    function drawSphere(timestamp: number) {
      const { x: sx, y: sy, r: sr } = sphereRef.current;
      const t = timestamp * 0.0007;
      const hlX = -sr * 0.3 + Math.sin(t * 0.8) * sr * 0.07;
      const hlY = -sr * 0.28 + Math.cos(t * 0.55) * sr * 0.06;

      // Ambient glow
      const glowR = sr * 2.0;
      const glow = ctx!.createRadialGradient(sx, sy, sr * 0.2, sx, sy, glowR);
      glow.addColorStop(0, "rgba(80, 40, 210, 0.22)");
      glow.addColorStop(0.5, "rgba(50, 20, 140, 0.07)");
      glow.addColorStop(1, "rgba(20,  8,  60, 0)");
      ctx!.beginPath();
      ctx!.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx!.fillStyle = glow;
      ctx!.fill();

      // Body with shadow
      ctx!.save();
      ctx!.shadowColor = "rgba(0,0,0,0.7)";
      ctx!.shadowBlur = 55;
      ctx!.shadowOffsetY = 22;
      const body = ctx!.createRadialGradient(
        sx + hlX,
        sy + hlY,
        sr * 0.04,
        sx,
        sy,
        sr,
      );
      body.addColorStop(0, "#d0b8ff");
      body.addColorStop(0.18, "#7248f0");
      body.addColorStop(0.48, "#2c1595");
      body.addColorStop(0.76, "#120850");
      body.addColorStop(1, "#050210");
      ctx!.beginPath();
      ctx!.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx!.fillStyle = body;
      ctx!.fill();
      ctx!.restore();

      // Specular glint
      const gx = sx + hlX * 0.62,
        gy = sy + hlY * 0.62;
      const glint = ctx!.createRadialGradient(gx, gy, 0, gx, gy, sr * 0.21);
      glint.addColorStop(0, "rgba(255,255,255,0.65)");
      glint.addColorStop(0.45, "rgba(210,195,255,0.20)");
      glint.addColorStop(1, "rgba(200,185,255,0)");
      ctx!.beginPath();
      ctx!.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx!.fillStyle = glint;
      ctx!.fill();
    }

    function drawBottomBar(W: number, H: number) {
      ctx!.fillStyle = C.bar;
      ctx!.fillRect(0, H - BOT_BAR_H, W, BOT_BAR_H);
      ctx!.fillStyle = C.sep;
      ctx!.fillRect(0, H - BOT_BAR_H, W, 1);

      const items: [string, string][] = [
        ["LINES", String(statsRef.current.lines)],
        ["REFLOW", `${statsRef.current.ms.toFixed(2)}ms`],
        ["FPS", String(fpsRef.current.fps)],
        ["ENGINE", "@chenglou/pretext"],
      ];

      ctx!.textBaseline = "middle";
      const statY = H - BOT_BAR_H / 2;
      let sx2 = PAD_X;
      for (const [label, val] of items) {
        ctx!.font = `500 11px ${MONO_FAMILY}`;
        ctx!.fillStyle = C.midMuted;
        ctx!.textAlign = "left";
        ctx!.fillText(label + " ", sx2, statY);
        const lw = ctx!.measureText(label + " ").width;
        ctx!.fillStyle = C.accent;
        ctx!.fillText(val, sx2 + lw, statY);
        sx2 += lw + ctx!.measureText(val).width + 36;
      }
    }

    function drawGrain(W: number, H: number) {
      const grain = grainRef.current;
      if (!grain) return;
      const pat = ctx!.createPattern(grain, "repeat");
      if (!pat) return;
      ctx!.save();
      ctx!.globalCompositeOperation = "screen";
      ctx!.globalAlpha = 0.9;
      ctx!.fillStyle = pat;
      ctx!.fillRect(0, 0, W, H);
      ctx!.restore();
    }

    function drawVignette(W: number, H: number) {
      const vg = ctx!.createRadialGradient(
        W / 2,
        H / 2,
        H * 0.28,
        W / 2,
        H / 2,
        H * 0.9,
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx!.fillStyle = vg;
      ctx!.fillRect(0, 0, W, H);
    }

    // ── Main animation loop ───────────────────────────────────────────────────
    function drawFrame(timestamp: number) {
      if (!canvas || !ctx) return;

      const W = canvas.width;
      const H = canvas.height;

      // Background
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);

      // Grain
      drawGrain(W, H);

      // Bars & headline (drawn before sphere so sphere is on top visually)
      drawTopBar(W);
      drawHeadline(W);

      // Sphere
      drawSphere(timestamp);

      // Vignette on top of sphere but before text
      drawVignette(W, H);

      // ── Prepare text if needed ──────────────────────────────────────────────
      if (!prepRef.current && fontsRef.current) {
        prepRef.current = prepareWithSegments(ARTICLE_TEXT, BODY_FONT);
      }

      // ── Text layout ────────────────────────────────────────────────────────
      const { x: sx, y: sy, r: sr } = sphereRef.current;
      const textW = W - PAD_X * 2;
      let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
      let ty = TEXT_START + LINE_H;
      let lineCount = 0;
      const t0 = performance.now();

      if (prepRef.current) {
        const prep = prepRef.current;
        ctx.fillStyle = C.body;
        ctx.font = BODY_FONT;
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        while (ty < H - BOT_BAR_H) {
          const cy = ty + LINE_H / 2;
          const dy = cy - sy;
          const rr = sr + SPHERE_GAP;
          const disc = rr * rr - dy * dy;

          if (disc > 0) {
            const half = Math.sqrt(disc);
            const leftW = Math.max(0, sx - half - SPHERE_GAP - PAD_X);
            const rightX = sx + half + SPHERE_GAP;
            const rightW = Math.max(0, W - PAD_X - rightX);

            if (leftW < 48 && rightW < 48) {
              ty += LINE_H;
              continue;
            }

            if (leftW >= 48) {
              const ll = layoutNextLine(prep, cursor, leftW);
              if (!ll) break;
              ctx.fillText(ll.text, PAD_X, ty);
              if (rightW >= 48) {
                const rl = layoutNextLine(prep, ll.end, rightW);
                cursor = rl
                  ? (ctx.fillText(rl.text, rightX, ty), rl.end)
                  : ll.end;
              } else {
                cursor = ll.end;
              }
            } else {
              const rl = layoutNextLine(prep, cursor, rightW);
              if (!rl) break;
              ctx.fillText(rl.text, rightX, ty);
              cursor = rl.end;
            }
          } else {
            const line = layoutNextLine(prep, cursor, textW);
            if (!line) break;
            ctx.fillText(line.text, PAD_X, ty);
            cursor = line.end;
          }

          lineCount++;
          ty += LINE_H;
        }
      } else if (!fontsRef.current) {
        // Loading state
        ctx.font = `500 13px ${MONO_FAMILY}`;
        ctx.fillStyle = C.muted;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Loading fonts…", W / 2, (TEXT_START + H - BOT_BAR_H) / 2);
      }

      statsRef.current = { lines: lineCount, ms: performance.now() - t0 };

      // FPS
      const fps = fpsRef.current;
      fps.frames++;
      const el = timestamp - fps.lastTime;
      if (el >= 500) {
        fps.fps = Math.round((fps.frames * 1000) / el);
        fps.frames = 0;
        fps.lastTime = timestamp;
      }

      // Bottom bar drawn last so it occludes text that runs off screen
      drawBottomBar(W, H);

      rafRef.current = requestAnimationFrame(drawFrame);
    }

    rafRef.current = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
      }}
    />
  );
}
