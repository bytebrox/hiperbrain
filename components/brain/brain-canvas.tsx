"use client";

import { useEffect, useRef } from "react";
import type { Fact } from "@/lib/hdc";

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

interface Graph {
  nodes: { name: string; degree: number }[];
  edges: Edge[];
  pos: Map<string, Vec3>;
  vel: Map<string, Vec3>;
  labels: Set<string>;
  pulses: { a: string; b: string; t: number; speed: number }[];
}

const MAX_NODES = 80;
// Near (cyan) -> far (violet), matching the brand glow.
const NEAR_RGB: [number, number, number] = [34, 211, 238];
const FAR_RGB: [number, number, number] = [139, 92, 246];

function emptyGraph(): Graph {
  return { nodes: [], edges: [], pos: new Map(), vel: new Map(), labels: new Set(), pulses: [] };
}

function rand(spread: number) {
  return (Math.random() - 0.5) * spread;
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
  const nodes = ranked.map(([name, d]) => ({ name, degree: d }));

  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const f of facts) {
    if (keep.has(f.subject) && keep.has(f.object) && f.subject !== f.object) {
      const key = f.subject < f.object ? `${f.subject}|${f.object}` : `${f.object}|${f.subject}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ a: f.subject, b: f.object });
      }
    }
  }

  const pos = new Map<string, Vec3>();
  const vel = new Map<string, Vec3>();
  for (const { name } of nodes) {
    pos.set(name, prev.pos.get(name) ?? { x: rand(80), y: rand(80), z: rand(80) });
    vel.set(name, prev.vel.get(name) ?? { x: 0, y: 0, z: 0 });
  }

  const labels = new Set(nodes.slice(0, 12).map((n) => n.name));
  return { nodes, edges, pos, vel, labels, pulses: prev.pulses };
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

    let width = wrap.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = wrap.clientWidth;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    // Background starfield for parallax depth.
    const stars: Star[] = Array.from({ length: 160 }, () => ({
      x: rand(560),
      y: rand(420),
      z: rand(560),
    }));

    // Camera rotation: gentle auto-spin plus eased mouse parallax.
    let yaw = 0;
    let pitch = -0.15;
    let targetYaw = 0;
    let targetPitch = -0.15;

    const onPointer = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetYaw = nx * 0.9;
      targetPitch = -0.15 - ny * 0.7;
    };
    const onLeave = () => {
      targetYaw = 0;
      targetPitch = -0.15;
    };
    wrap.addEventListener("pointermove", onPointer);
    wrap.addEventListener("pointerleave", onLeave);

    const bound = () => Math.max(70, Math.min(width, height) * 0.4);

    const step = () => {
      const g = graphRef.current;
      const n = g.nodes.length;
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

      const target = Math.min(10, g.edges.length);
      while (g.pulses.length < target) {
        const e = g.edges[Math.floor(Math.random() * g.edges.length)];
        g.pulses.push({ a: e.a, b: e.b, t: Math.random(), speed: 0.004 + Math.random() * 0.012 });
      }
      for (const pulse of g.pulses) {
        pulse.t += pulse.speed;
        if (pulse.t >= 1 && g.edges.length > 0) {
          const e = g.edges[Math.floor(Math.random() * g.edges.length)];
          pulse.a = e.a;
          pulse.b = e.b;
          pulse.t = 0;
          pulse.speed = 0.004 + Math.random() * 0.012;
        }
      }
    };

    const draw = () => {
      const g = graphRef.current;
      ctx.clearRect(0, 0, width, height);

      yaw += (targetYaw - yaw) * 0.05 + 0.0022;
      pitch += (targetPitch - pitch) * 0.05;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const B = bound();
      const focal = B * 2.6;
      const cx = width / 2;
      const cy = height / 2;

      const project = (p: Vec3) => {
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

      // Starfield (drawn first, far behind).
      for (const s of stars) {
        const pr = project(s);
        const a = 0.06 + (1 - pr.depth) * 0.16;
        ctx.fillStyle = `rgba(148, 163, 184, ${a})`;
        ctx.fillRect(pr.sx, pr.sy, pr.persp > 1 ? 1.5 : 1, pr.persp > 1 ? 1.5 : 1);
      }

      // Edges, sorted far -> near.
      const projEdges = g.edges
        .map((e) => {
          const a = g.pos.get(e.a);
          const b = g.pos.get(e.b);
          if (!a || !b) return null;
          const pa = project(a);
          const pb = project(b);
          return { pa, pb, depth: (pa.depth + pb.depth) / 2 };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((u, v) => v.depth - u.depth);

      for (const e of projEdges) {
        const alpha = 0.22 * (1 - e.depth * 0.7);
        const t = (e.pa.depth + e.pb.depth) / 2;
        ctx.strokeStyle = mix(t, alpha);
        ctx.lineWidth = Math.max(0.4, 0.9 * ((e.pa.persp + e.pb.persp) / 2));
        ctx.beginPath();
        ctx.moveTo(e.pa.sx, e.pa.sy);
        ctx.lineTo(e.pb.sx, e.pb.sy);
        ctx.stroke();
      }

      // Pulses travelling along edges.
      for (const pulse of g.pulses) {
        const a = g.pos.get(pulse.a);
        const b = g.pos.get(pulse.b);
        if (!a || !b) continue;
        const p = project({
          x: a.x + (b.x - a.x) * pulse.t,
          y: a.y + (b.y - a.y) * pulse.t,
          z: a.z + (b.z - a.z) * pulse.t,
        });
        const radius = 5 * p.persp;
        const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, radius);
        glow.addColorStop(0, `rgba(186, 230, 253, ${0.9 * (1 - p.depth * 0.5)})`);
        glow.addColorStop(1, "rgba(186, 230, 253, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nodes, sorted far -> near.
      const projNodes = g.nodes
        .map((node) => ({ node, p: project(g.pos.get(node.name)!) }))
        .sort((u, v) => v.p.z - u.p.z);

      for (const { node, p } of projNodes) {
        const base = Math.min(7, 2 + node.degree * 0.7) * p.persp;
        const t = p.depth;
        const coreAlpha = 0.95 - 0.5 * t;

        const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, base * 3.5);
        glow.addColorStop(0, mix(t, 0.35 * (1 - t * 0.5)));
        glow.addColorStop(1, mix(t, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, base * 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = mix(t, coreAlpha);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, base, 0, Math.PI * 2);
        ctx.fill();

        if (g.labels.has(node.name) && t < 0.5) {
          ctx.fillStyle = `rgba(231, 236, 243, ${0.65 * (1 - t * 1.6)})`;
          ctx.font = "11px ui-monospace, monospace";
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
      <canvas ref={canvasRef} aria-hidden />
    </div>
  );
}
