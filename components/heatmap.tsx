"use client";

import { useEffect, useRef } from "react";
import type { Hypervector } from "@/lib/hdc";

interface HeatmapProps {
  vector: Hypervector;
  /** Number of columns in the grid. Defaults to a near-square layout. */
  columns?: number;
  /** Optional reference vector; cells that differ are highlighted. */
  compareTo?: Hypervector;
  /** Pixel size of each cell. */
  cell?: number;
  /** Pixel gap between cells. */
  gap?: number;
  className?: string;
}

/**
 * Renders a hypervector as a grid of cells (+1 lit, -1 dark) on a canvas.
 * With 10,000 dimensions this is a 100x100 "thought fingerprint". When a
 * `compareTo` vector is supplied, flipped components are highlighted so damage
 * or change is visible at a glance.
 */
export function HypervectorHeatmap({
  vector,
  columns,
  compareTo,
  cell = 6,
  gap = 1,
  className,
}: HeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cols = columns ?? Math.ceil(Math.sqrt(vector.length));
    const rows = Math.ceil(vector.length / cols);
    const step = cell + gap;

    const width = cols * step;
    const height = rows * step;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < vector.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * step;
      const y = row * step;
      const on = vector[i] > 0;
      const flipped = compareTo ? compareTo[i] !== vector[i] : false;

      if (flipped) {
        ctx.fillStyle = on ? "#fb7185" : "#5b1228";
      } else {
        ctx.fillStyle = on ? "#22d3ee" : "#0c141d";
      }
      ctx.fillRect(x, y, cell, cell);
    }
  }, [vector, columns, compareTo, cell, gap]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
