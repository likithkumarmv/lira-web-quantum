"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Rotate3d,
  Sliders,
  Play,
  Pause,
  RefreshCw,
  Cpu,
  Zap,
  Activity,
  Layers
} from "lucide-react";

interface QuantumBlochSphere3DProps {
  gammaInitial?: number;
  betaInitial?: number;
}

export default function QuantumBlochSphere3D({
  gammaInitial = 0.35,
  betaInitial = 0.25
}: QuantumBlochSphere3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3D Camera Angles
  const [rotX, setRotX] = useState<number>(0.38);
  const [rotY, setRotY] = useState<number>(-0.62);
  const [isPrecessing, setIsPrecessing] = useState<boolean>(true);

  // Quantum State Parameters: theta [0, PI], phi [0, 2*PI]
  const [theta, setTheta] = useState<number>(1.12); // ~64 deg
  const [phi, setPhi] = useState<number>(0.78); // ~45 deg
  const [gamma, setGamma] = useState<number>(gammaInitial);
  const [beta, setBeta] = useState<number>(betaInitial);
  const [isDark, setIsDark] = useState<boolean>(true);

  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const tracePointsRef = useRef<{ x: number; y: number; z: number }[]>([]);

  // Sync theme
  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // 3D Mathematical Projection
  const project3D = useCallback(
    (x: number, y: number, z: number, cx: number, cy: number, currentRotX: number, currentRotY: number, r: number) => {
      const cosY = Math.cos(currentRotY);
      const sinY = Math.sin(currentRotY);
      const x1 = x * cosY - z * sinY;
      const z1 = z * cosY + x * sinY;

      const cosX = Math.cos(currentRotX);
      const sinX = Math.sin(currentRotX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = z1 * cosX + y * sinX;

      const scale = (350 / (350 + z2 * 0.4)) * 1.0;
      const screenX = cx + x1 * r * scale;
      const screenY = cy - y2 * r * scale;

      return { x: screenX, y: screenY, depth: z2, scale };
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let currentRotY = rotY;

    const render = () => {
      timeRef.current += 0.02;

      // Hamiltonian Precession under QAOA Mixer + Cost operator
      if (isPrecessing) {
        const precessionSpeed = beta * 1.5;
        const newPhi = (phi + precessionSpeed * 0.03) % (Math.PI * 2);
        setPhi(newPhi);
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) * 0.36;

      const sphereOutline = isDark ? "#30363d" : "#d0d7de";
      const equatorColor = isDark ? "#388bfd40" : "#2563eb30";
      const axisColor = isDark ? "#6e7681" : "#8c959f";

      // 1. Draw Bloch Sphere Outer Circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = sphereOutline;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Draw Equator Ellipse
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
        const x = Math.cos(a);
        const y = 0;
        const z = Math.sin(a);
        const p = project3D(x, y, z, cx, cy, rotX, rotY, r);
        if (a === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = equatorColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 3. Draw Prime Meridian
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
        const x = Math.sin(a);
        const y = Math.cos(a);
        const z = 0;
        const p = project3D(x, y, z, cx, cy, rotX, rotY, r);
        if (a === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = equatorColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 4. Draw Cartesian Axes (X, Y, Z)
      const axes = [
        { x: 1.35, y: 0, z: 0, label: "+X |+⟩" },
        { x: -1.25, y: 0, z: 0, label: "-X |-⟩" },
        { x: 0, y: 1.35, z: 0, label: "+Z |0⟩" },
        { x: 0, y: -1.35, z: 0, label: "-Z |1⟩" },
        { x: 0, y: 0, z: 1.35, label: "+Y |i⟩" }
      ];

      axes.forEach((ax) => {
        const start = project3D(0, 0, 0, cx, cy, rotX, rotY, r);
        const end = project3D(ax.x, ax.y, ax.z, cx, cy, rotX, rotY, r);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isDark ? "#8b949e" : "#57606a";
        ctx.font = "bold 9px monospace";
        ctx.fillText(ax.label, end.x + 4, end.y + 3);
      });

      // 5. Calculate Statevector on Bloch Sphere:
      // x = sin(theta) * cos(phi)
      // y = cos(theta) [North/South Pole]
      // z = sin(theta) * sin(phi)
      const svX = Math.sin(theta) * Math.cos(phi);
      const svY = Math.cos(theta);
      const svZ = Math.sin(theta) * Math.sin(phi);

      // Record trace path
      tracePointsRef.current.push({ x: svX, y: svY, z: svZ });
      if (tracePointsRef.current.length > 50) tracePointsRef.current.shift();

      // Draw Precession Trace Path
      if (tracePointsRef.current.length > 2) {
        ctx.beginPath();
        tracePointsRef.current.forEach((pt, i) => {
          const projected = project3D(pt.x, pt.y, pt.z, cx, cy, rotX, rotY, r);
          if (i === 0) ctx.moveTo(projected.x, projected.y);
          else ctx.lineTo(projected.x, projected.y);
        });
        ctx.strokeStyle = isDark ? "#388bfd60" : "#2563eb60";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 6. Draw Statevector Needle
      const centerPt = project3D(0, 0, 0, cx, cy, rotX, rotY, r);
      const tipPt = project3D(svX, svY, svZ, cx, cy, rotX, rotY, r);

      // Gradient vector line
      ctx.beginPath();
      ctx.moveTo(centerPt.x, centerPt.y);
      ctx.lineTo(tipPt.x, tipPt.y);
      ctx.strokeStyle = isDark ? "#388bfd" : "#1f6feb";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Arrow tip sphere
      ctx.beginPath();
      ctx.arc(tipPt.x, tipPt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#388bfd";
      ctx.fill();
      ctx.strokeStyle = isDark ? "#ffffff" : "#0d1117";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // State label
      ctx.fillStyle = isDark ? "#58a6ff" : "#0969da";
      ctx.font = "bold 11px monospace";
      ctx.fillText("|ψ(γ, β)⟩", tipPt.x + 8, tipPt.y - 4);

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [rotX, rotY, theta, phi, gamma, beta, isPrecessing, isDark, project3D]);

  // Drag interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setRotY((prev) => prev + dx * 0.008);
    setRotX((prev) => Math.max(-1.5, Math.min(1.5, prev + dy * 0.008)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Quantum measurement probabilities
  const prob0 = (Math.cos(theta / 2) ** 2 * 100).toFixed(1);
  const prob1 = (Math.sin(theta / 2) ** 2 * 100).toFixed(1);

  return (
    <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* Header */}
      <div className="bg-[#F3F4F6] dark:bg-[#090B0E] px-4 py-2.5 border-b border-[#D1D5DB] dark:border-[#222936] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-[#0284C7]" />
          <div>
            <h3 className="font-mono text-xs font-bold text-[#111827] dark:text-[#F0F4F8] uppercase tracking-wide">
              QAOA Conflict-Core 3D Bloch Sphere
            </h3>
            <span className="text-[10px] text-[#D97706] font-mono font-bold block">
              ILLUSTRATIVE SIMULATION VIEW — NOT LIVE PHYSICAL TELEMETRY
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-sm bg-[#0284C7]/10 text-[#0284C7] font-mono text-[10px] font-bold border border-[#0284C7]/30">
            SU(2) STATEVECTOR
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            onClick={() => setIsPrecessing(!isPrecessing)}
            className={`px-2.5 py-1 rounded-md border flex items-center space-x-1 transition shadow-sm ${
              isPrecessing
                ? "bg-blue-50 dark:bg-[#1f6feb]/15 border-blue-300 dark:border-[#388bfd] text-blue-700 dark:text-sky-400 font-bold"
                : "bg-white dark:bg-[#21262d] border-[#d0d7de] dark:border-[#30363d] text-[#656d76] dark:text-[#8b949e]"
            }`}
          >
            {isPrecessing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPrecessing ? "Pause Precession" : "Precess State"}</span>
          </button>

          <button
            onClick={() => {
              setRotX(0.38);
              setRotY(-0.62);
              setTheta(1.12);
              setPhi(0.78);
            }}
            className="p-1.5 bg-white dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] hover:bg-gray-100 dark:hover:bg-[#30363d] rounded-md text-[#1f2328] dark:text-[#e6edf3]"
            title="Reset View"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#d0d7de] dark:divide-[#30363d]">
        <div className="lg:col-span-2 relative h-[320px] bg-[#f6f8fa] dark:bg-[#0d1117] cursor-grab active:cursor-grabbing">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-full block"
          />

          <div className="absolute bottom-2 left-3 bg-white dark:bg-[#161B24] px-2.5 py-1 rounded-sm text-[10px] font-mono text-[#6B7280] dark:text-[#8A99AD] border border-[#D1D5DB] dark:border-[#222936] pointer-events-none">
            Drag to Rotate Bloch Sphere | Trace: e^(-i γ H_C) e^(-i β H_M)
          </div>
        </div>

        {/* Statevector Controls & Measurement Probabilities */}
        <div className="p-4 bg-white dark:bg-[#161b22] space-y-4 text-xs font-mono">
          <div>
            <div className="flex justify-between text-[#656d76] dark:text-[#8b949e] mb-1 font-semibold">
              <span>MIXER ANGLE β (THETA):</span>
              <span className="text-[#1f2328] dark:text-[#e6edf3]">{(theta / Math.PI).toFixed(2)}π</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.PI}
              step="0.05"
              value={theta}
              onChange={(e) => setTheta(parseFloat(e.target.value))}
              className="w-full accent-blue-600 dark:accent-sky-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-[#656d76] dark:text-[#8b949e] mb-1 font-semibold">
              <span>COST ANGLE γ (PHI):</span>
              <span className="text-[#1f2328] dark:text-[#e6edf3]">{(phi / Math.PI).toFixed(2)}π</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.PI * 2}
              step="0.05"
              value={phi}
              onChange={(e) => setPhi(parseFloat(e.target.value))}
              className="w-full accent-blue-600 dark:accent-sky-400"
            />
          </div>

          <div className="pt-2 border-t border-[#d0d7de] dark:border-[#30363d] space-y-2">
            <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] uppercase font-bold block">
              Z-Basis Projective Readout:
            </span>

            <div className="flex items-center justify-between p-2 rounded bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d]">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">P(|0⟩) Ground</span>
              <strong className="text-base text-[#1f2328] dark:text-[#e6edf3]">{prob0}%</strong>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d]">
              <span className="font-bold text-blue-600 dark:text-sky-400">P(|1⟩) Excited</span>
              <strong className="text-base text-[#1f2328] dark:text-[#e6edf3]">{prob1}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

