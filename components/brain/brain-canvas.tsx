"use client";

import { useEffect, useRef } from "react";
import type { Fact } from "@hiperbrain/core";

interface BrainCanvasProps {
  facts: Fact[];
  height?: number;
  className?: string;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Edge {
  a: string;
  b: string;
}

interface Star {
  x: number;
  y: number;
  z: number;
}

interface Pulse {
  a: string;
  b: string;
  t: number;
  speed: number;
}

interface Shock {
  sx: number;
  sy: number;
  r: number;
  max: number;
  life: number;
  hue: number;
}

interface Node {
  name: string;
  degree: number;
  phase: number;
}

interface Graph {
  nodes: Node[];
  edges: Edge[];
  pos: Map<string, Vec3>;
  vel: Map<string, Vec3>;
  adj: Map<string, string[]>;
  labels: Set<string>;
  pulses: Pulse[];
  flash: Map<string, number>;
  shocks: Shock[];
}

const MAX_NODES = 80;
const MAX_PULSES = 80;
const MESH_DIST = 46;
// Near (cyan) -> far (violet), matching the brand glow.
const NEAR_RGB: [number, number, number] = [34, 211, 238];
const FAR_RGB: [number, number, number] = [139, 92, 246];

function emptyGraph(): Graph {
  return {
    nodes: [],
    edges: [],
    pos: new Map(),
    vel: new Map(),
    adj: new Map(),
    labels: new Set(),
    pulses: [],
    flash: new Map(),
    shocks: [],
  };
}

function rand(spread: number) {
  return (Math.random() - 0.5) * spread;
}

/** Stable 0..1 hash so per-node traits (breathing phase, curve side) don't jump on rebuild. */
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Build a 3D graph from facts, keeping positions of nodes that still exist. */
function buildGraph(facts: Fact[], prev: Graph): Graph {
  const degree = new Map<string, number>();
  for (const f of facts) {
    degree.set(f.subject, (degree.get(f.subject) ?? 0) + 1);
    degree.set(f.object, (degree.get(f.object) ?? 0) + 1);
  }

  const ranked = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_NODES);
  const keep = new Set(ranked.map(([name]) => name));
  const nodes: Node[] = ranked.map(([name, d]) => ({
    name,
    degree: d,
    phase: hash01(name) * Math.PI * 2,
  }));

  const edges: Edge[] = [];
  const adj = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const f of facts) {
    if (keep.has(f.subject) && keep.has(f.object) && f.subject !== f.object) {
      const key = f.subject < f.object ? `${f.subject}|${f.object}` : `${f.object}|${f.subject}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ a: f.subject, b: f.object });
        (adj.get(f.subject) ?? adj.set(f.subject, []).get(f.subject)!).push(f.object);
        (adj.get(f.object) ?? adj.set(f.object, []).get(f.object)!).push(f.subject);
      }
    }
  }

  const pos = new Map<string, Vec3>();
  const vel = new Map<string, Vec3>();
  for (const { name } of nodes) {
    pos.set(name, prev.pos.get(name) ?? { x: rand(80), y: rand(80), z: rand(80) });
    vel.set(name, prev.vel.get(name) ?? { x: 0, y: 0, z: 0 });
  }

  const labels = new Set(nodes.slice(0, 14).map((n) => n.name));
  return {
    nodes,
    edges,
    pos,
    vel,
    adj,
    labels,
    pulses: prev.pulses,
    flash: prev.flash,
    shocks: [],
  };
}

export function BrainCanvas({ facts, height = 360, className }: BrainCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<Graph>(emptyGraph());

  useEffect(() => {
    graphRef.current = buildGraph(facts, graphRef.current);
  }, [facts]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = wrap.clientWidth;
    // Height follows the container so the canvas can flex to fill available
    // space (the home page sizes it to fit the viewport). Falls back to the prop.
    let vh = wrap.clientHeight || height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = wrap.clientWidth;
      vh = wrap.clientHeight || height;
      canvas.width = width * dpr;
      canvas.height = vh * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${vh}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    // Background starfield for parallax depth.
    const stars: Star[] = Array.from({ length: 200 }, () => ({
      x: rand(620),
      y: rand(460),
      z: rand(620),
    }));

    // Camera rotation: gentle auto-spin plus eased mouse parallax.
    let yaw = 0;
    let pitch = -0.15;
    let targetYaw = 0;
    let targetPitch = -0.15;
    let time = 0;
    let burstIn = 160;

    // Pointer state for the hover probe.
    let mx = -1;
    let my = -1;
    let inside = false;

    const onPointer = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
      inside = true;
      const nx = mx / rect.width - 0.5;
      const ny = my / rect.height - 0.5;
      targetYaw = nx * 0.9;
      targetPitch = -0.15 - ny * 0.7;
    };
    const onLeave = () => {
      inside = false;
      mx = -1;
      my = -1;
      targetYaw = 0;
      targetPitch = -0.15;
    };
    wrap.addEventListener("pointermove", onPointer);
    wrap.addEventListener("pointerleave", onLeave);

    const bound = () => Math.max(70, Math.min(width, vh) * 0.4);

    const project = (p: Vec3) => {
      const B = bound();
      const focal = B * 2.6;
      const cx = width / 2;
      const cy = vh / 2;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const x1 = p.x * cosY + p.z * sinY;
      const z1 = -p.x * sinY + p.z * cosY;
      const y2 = p.y * cosP - z1 * sinP;
      const z2 = p.y * sinP + z1 * cosP;
      const persp = focal / (focal + z2);
      return {
        sx: cx + x1 * persp,
        sy: cy + y2 * persp,
        persp,
        depth: Math.max(0, Math.min(1, (z2 + B) / (2 * B))),
        z: z2,
      };
    };

    const mix = (t: number, alpha: number) => {
      const r = Math.round(NEAR_RGB[0] + (FAR_RGB[0] - NEAR_RGB[0]) * t);
      const gg = Math.round(NEAR_RGB[1] + (FAR_RGB[1] - NEAR_RGB[1]) * t);
      const b = Math.round(NEAR_RGB[2] + (FAR_RGB[2] - NEAR_RGB[2]) * t);
      return `rgba(${r}, ${gg}, ${b}, ${alpha})`;
    };

    // Spawn pulses from a node along its edges (a "thought" firing).
    function ignite(g: Graph, name: string, count: number) {
      g.flash.set(name, 1);
      const neighbors = g.adj.get(name);
      if (!neighbors || neighbors.length === 0) return;
      for (let i = 0; i < count && g.pulses.length < MAX_PULSES; i++) {
        const to = neighbors[Math.floor(Math.random() * neighbors.length)];
        g.pulses.push({ a: name, b: to, t: 0, speed: 0.012 + Math.random() * 0.016 });
      }
    }

    const step = () => {
      const g = graphRef.current;
      const n = g.nodes.length;
      time += 1;

      yaw += (targetYaw - yaw) * 0.05 + (reduced ? 0.0006 : 0.0022);
      pitch += (targetPitch - pitch) * 0.05;
      if (n === 0) return;
      const B = bound();

      for (let i = 0; i < n; i++) {
        const a = g.pos.get(g.nodes[i].name)!;
        const va = g.vel.get(g.nodes[i].name)!;
        for (let j = i + 1; j < n; j++) {
          const b = g.pos.get(g.nodes[j].name)!;
          const vb = g.vel.get(g.nodes[j].name)!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dz = a.z - b.z;
          let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
          if (dist < 8) dist = 8;
          const force = 1400 / (dist * dist);
          dx /= dist;
          dy /= dist;
          dz /= dist;
          va.x += dx * force;
          va.y += dy * force;
          va.z += dz * force;
          vb.x -= dx * force;
          vb.y -= dy * force;
          vb.z -= dz * force;
        }
      }

      for (const e of g.edges) {
        const a = g.pos.get(e.a);
        const b = g.pos.get(e.b);
        const va = g.vel.get(e.a);
        const vb = g.vel.get(e.b);
        if (!a || !b || !va || !vb) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        const diff = (dist - 62) * 0.018;
        va.x += (dx / dist) * diff;
        va.y += (dy / dist) * diff;
        va.z += (dz / dist) * diff;
        vb.x -= (dx / dist) * diff;
        vb.y -= (dy / dist) * diff;
        vb.z -= (dz / dist) * diff;
      }

      for (const node of g.nodes) {
        const p = g.pos.get(node.name)!;
        const v = g.vel.get(node.name)!;
        v.x += -p.x * 0.01 + rand(0.08);
        v.y += -p.y * 0.01 + rand(0.08);
        v.z += -p.z * 0.01 + rand(0.08);
        v.x *= 0.85;
        v.y *= 0.85;
        v.z *= 0.85;
        const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (speed > 4) {
          v.x = (v.x / speed) * 4;
          v.y = (v.y / speed) * 4;
          v.z = (v.z / speed) * 4;
        }
        p.x += v.x;
        p.y += v.y;
        p.z += v.z;
        const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        if (r > B) {
          p.x = (p.x / r) * B;
          p.y = (p.y / r) * B;
          p.z = (p.z / r) * B;
          v.x *= 0.5;
          v.y *= 0.5;
          v.z *= 0.5;
        }
      }

      // Decay node flashes.
      for (const [name, f] of g.flash) {
        const nf = f * 0.92;
        if (nf < 0.02) g.flash.delete(name);
        else g.flash.set(name, nf);
      }

      // Advance pulses; on arrival, flash the target and propagate to neighbors.
      if (g.edges.length > 0) {
        const next: Pulse[] = [];
        for (const pulse of g.pulses) {
          pulse.t += pulse.speed;
          if (pulse.t < 1) {
            next.push(pulse);
            continue;
          }
          g.flash.set(pulse.b, 1);
          const neighbors = g.adj.get(pulse.b);
          if (neighbors && neighbors.length && next.length < MAX_PULSES && Math.random() < 0.72) {
            const children = 1 + (Math.random() < 0.4 ? 1 : 0);
            for (let c = 0; c < children && next.length < MAX_PULSES; c++) {
              const to = neighbors[Math.floor(Math.random() * neighbors.length)];
              if (to === pulse.a && neighbors.length > 1) continue;
              next.push({ a: pulse.b, b: to, t: 0, speed: 0.012 + Math.random() * 0.016 });
            }
          }
        }
        g.pulses = next;

        // Keep a baseline of spontaneous activity.
        while (g.pulses.length < 8) {
          const node = g.nodes[Math.floor(Math.random() * g.nodes.length)];
          ignite(g, node.name, 1);
          if (!g.adj.get(node.name)?.length) break;
        }

        // Periodic synapse burst from a hub + an expanding shockwave.
        burstIn -= 1;
        if (burstIn <= 0 && !reduced) {
          burstIn = 220 + Math.floor(Math.random() * 240);
          const hub = g.nodes[Math.floor(Math.random() * Math.min(10, g.nodes.length))];
          ignite(g, hub.name, 6);
          const hp = project(g.pos.get(hub.name)!);
          g.shocks.push({ sx: hp.sx, sy: hp.sy, r: 4, max: B * 1.6, life: 1, hue: 0.5 });
        }
      }

      // Advance shockwaves.
      for (const s of g.shocks) {
        s.r += (s.max - s.r) * 0.04 + 1.5;
        s.life -= 0.018;
      }
      g.shocks = g.shocks.filter((s) => s.life > 0);
    };

    const draw = () => {
      const g = graphRef.current;
      const B = bound();

      // Fade the previous frame toward transparent for motion trails. Using
      // destination-out keeps the canvas see-through, so it blends seamlessly
      // into the page background instead of showing a filled rectangle.
      if (reduced) {
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, width, vh);
      } else {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
        ctx.fillRect(0, 0, width, vh);
      }

      if (g.nodes.length === 0) {
        ctx.globalCompositeOperation = "source-over";
        return;
      }

      // Everything glowing is drawn additively for a neon bloom.
      ctx.globalCompositeOperation = "lighter";

      // Starfield (far behind).
      for (const s of stars) {
        const pr = project(s);
        const a = 0.05 + (1 - pr.depth) * 0.18;
        ctx.fillStyle = `rgba(150, 180, 220, ${a})`;
        const sz = pr.persp > 1 ? 1.6 : 1;
        ctx.fillRect(pr.sx, pr.sy, sz, sz);
      }

      // Project all nodes once; detect the hovered node (probe).
      const projOf = new Map<string, ReturnType<typeof project>>();
      for (const node of g.nodes) projOf.set(node.name, project(g.pos.get(node.name)!));

      let hovered: string | null = null;
      if (inside) {
        let bestD = 24 * 24;
        for (const node of g.nodes) {
          const p = projOf.get(node.name)!;
          const d = (p.sx - mx) ** 2 + (p.sy - my) ** 2;
          if (d < bestD) {
            bestD = d;
            hovered = node.name;
          }
        }
      }
      const hoverSet = new Set<string>();
      if (hovered) {
        hoverSet.add(hovered);
        for (const nb of g.adj.get(hovered) ?? []) hoverSet.add(nb);
      }

      // Constellation mesh: faint links between nearby nodes (depth of the net).
      ctx.lineWidth = 0.4;
      for (let i = 0; i < g.nodes.length; i++) {
        const ni = g.nodes[i].name;
        const a = g.pos.get(ni)!;
        for (let j = i + 1; j < g.nodes.length; j++) {
          const nj = g.nodes[j].name;
          const b = g.pos.get(nj)!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dz = a.z - b.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > MESH_DIST * MESH_DIST) continue;
          const fade = 1 - Math.sqrt(d2) / MESH_DIST;
          const pa = projOf.get(ni)!;
          const pb = projOf.get(nj)!;
          ctx.strokeStyle = `rgba(125, 211, 252, ${0.05 * fade})`;
          ctx.beginPath();
          ctx.moveTo(pa.sx, pa.sy);
          ctx.lineTo(pb.sx, pb.sy);
          ctx.stroke();
        }
      }

      // Curved control point for an edge, computed in screen space (order-independent).
      const curveOf = (n1: string, n2: string) => {
        const [a, b] = n1 < n2 ? [n1, n2] : [n2, n1];
        const pa = projOf.get(a)!;
        const pb = projOf.get(b)!;
        const ex = pb.sx - pa.sx;
        const ey = pb.sy - pa.sy;
        const len = Math.hypot(ex, ey) || 1;
        const side = hash01(`${a}|${b}`) > 0.5 ? 1 : -1;
        const off = len * 0.16 * side;
        return {
          a,
          b,
          pa,
          pb,
          cx: (pa.sx + pb.sx) / 2 + (-ey / len) * off,
          cy: (pa.sy + pb.sy) / 2 + (ex / len) * off,
        };
      };

      // Edges, sorted far -> near, drawn as glowing curves.
      const projEdges = g.edges
        .map((e) => {
          const c = curveOf(e.a, e.b);
          return { c, depth: (c.pa.depth + c.pb.depth) / 2, e };
        })
        .sort((u, v) => v.depth - u.depth);

      for (const { c, depth, e } of projEdges) {
        const t = (c.pa.depth + c.pb.depth) / 2;
        const hot = hoverSet.has(e.a) && hoverSet.has(e.b);
        const dim = hovered && !hot ? 0.3 : 1;
        const alpha = (hot ? 0.6 : 0.22) * (1 - depth * 0.7) * dim;
        ctx.strokeStyle = mix(t, alpha);
        ctx.lineWidth = Math.max(0.4, (hot ? 1.6 : 0.9) * ((c.pa.persp + c.pb.persp) / 2));
        ctx.beginPath();
        ctx.moveTo(c.pa.sx, c.pa.sy);
        ctx.quadraticCurveTo(c.cx, c.cy, c.pb.sx, c.pb.sy);
        ctx.stroke();
      }

      // Pulses travelling along curved edges with comet glow.
      for (const pulse of g.pulses) {
        if (!g.pos.get(pulse.a) || !g.pos.get(pulse.b)) continue;
        const c = curveOf(pulse.a, pulse.b);
        const tt = pulse.a === c.a ? pulse.t : 1 - pulse.t;
        const it = 1 - tt;
        const px = it * it * c.pa.sx + 2 * it * tt * c.cx + tt * tt * c.pb.sx;
        const py = it * it * c.pa.sy + 2 * it * tt * c.cy + tt * tt * c.pb.sy;
        const radius = 4.5;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.2);
        glow.addColorStop(0, "rgba(224, 242, 254, 0.95)");
        glow.addColorStop(0.4, "rgba(125, 211, 252, 0.6)");
        glow.addColorStop(1, "rgba(125, 211, 252, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, radius * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nodes, sorted far -> near.
      const projNodes = g.nodes
        .map((node) => ({ node, p: projOf.get(node.name)! }))
        .sort((u, v) => v.p.z - u.p.z);

      for (const { node, p } of projNodes) {
        const t = p.depth;
        const flash = g.flash.get(node.name) ?? 0;
        const breath = 1 + 0.12 * Math.sin(time * 0.05 + node.phase);
        const hot = hoverSet.has(node.name);
        const dim = hovered && !hot ? 0.4 : 1;
        const base = Math.min(7, 2 + node.degree * 0.7) * p.persp * breath * (hot ? 1.4 : 1);
        const coreAlpha = (0.95 - 0.5 * t) * dim;

        const glowR = base * (3.5 + flash * 4);
        const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, glowR);
        glow.addColorStop(0, mix(t, (0.35 + flash * 0.5) * (1 - t * 0.5) * dim));
        glow.addColorStop(1, mix(t, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = flash > 0.1 ? `rgba(255, 255, 255, ${coreAlpha})` : mix(t, coreAlpha);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, base, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shockwaves (synapse bursts + click ripples).
      for (const s of g.shocks) {
        ctx.strokeStyle = mix(s.hue, 0.4 * s.life);
        ctx.lineWidth = 2 * s.life;
        ctx.beginPath();
        ctx.arc(s.sx, s.sy, s.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Labels on top, no additive blending.
      ctx.globalCompositeOperation = "source-over";
      for (const { node, p } of projNodes) {
        const t = p.depth;
        const hot = hoverSet.has(node.name);
        if ((g.labels.has(node.name) && t < 0.5) || hot) {
          const base = Math.min(7, 2 + node.degree * 0.7) * p.persp;
          ctx.fillStyle = hot
            ? "rgba(236, 245, 255, 0.95)"
            : `rgba(231, 236, 243, ${0.6 * (1 - t * 1.6)})`;
          ctx.font = `${hot ? "12px" : "11px"} ui-monospace, monospace`;
          ctx.fillText(node.name, p.sx + base + 4, p.sy + 3);
        }
      }
    };

    let raf = 0;
    const loop = () => {
      if (!document.hidden) {
        step();
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      wrap.removeEventListener("pointermove", onPointer);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, [height]);

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} className="block" aria-hidden />
    </div>
  );
}
