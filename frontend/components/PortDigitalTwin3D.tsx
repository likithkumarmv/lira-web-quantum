"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Rotate3d,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Box,
  Truck,
  Ship,
  Layers,
  Info,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause
} from "lucide-react";
import { fetchIncidents } from "@/lib/api";
import { Incident } from "@/lib/types";

interface Container3D {
  id: string;
  code: string;
  x: number; // grid coords
  y: number; // height (tier)
  z: number; // depth
  size: 20 | 40;
  color: string;
  darkColor: string;
  status: "NORMAL" | "BLOCKER" | "RECOVERED" | "CRITICAL";
  truck?: string;
  desc: string;
  weight: string;
  avoidableCost?: number;
}

interface Truck3D {
  id: string;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  speed: number;
  color: string;
  status: string;
}

export default function PortDigitalTwin3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3D Camera State
  const [rotX, setRotX] = useState<number>(0.55); // pitch (~31 deg)
  const [rotY, setRotY] = useState<number>(-0.78); // yaw (~-45 deg)
  const [zoom, setZoom] = useState<number>(1.0);
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(true);
  const [selectedEntity, setSelectedEntity] = useState<Container3D | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<Container3D | null>(null);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [liveContainers, setLiveContainers] = useState<Container3D[]>([]);

  // Drag interaction refs
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Dynamic Trucks simulation based on real assigned trucks
  const trucksRef = useRef<Truck3D[]>([
    { id: "T04", x: -140, z: 60, targetX: -20, targetZ: 60, speed: 0.6, color: "#388bfd", status: "Approaching Bay S1600 (Assigned C102)" },
    { id: "T07", x: 40, z: 120, targetX: 120, targetZ: 120, speed: 0.4, color: "#d29922", status: "Corridor Transit (Assigned Recovery S1630)" }
  ]);

  // Load real incidents and map to 3D containers
  useEffect(() => {
    const loadRealContainers = async () => {
      try {
        const incidents: Incident[] = await fetchIncidents();
        
        // Base coordinate mapping for real terminal bays
        const realMapped: Container3D[] = [
          // Staging Bay Slot S1600 (Live assigned slot)
          { 
            id: "SLOT-S1600", 
            code: "S1600", 
            x: -20, 
            y: 0, 
            z: 70, 
            size: 20, 
            color: "#388bfd", 
            darkColor: "#58a6ff", 
            status: "NORMAL", 
            desc: "Bay Slot S1600: Dedicated Staging Bay for Recovery C102 (Slot confirmed 16:00-16:30)", 
            weight: "Bay 01 Staging" 
          }
        ];

        // Known physical containers in the database
        const containerMeta: Record<string, { x: number; y: number; z: number; size: 20 | 40; weight: string; truck: string }> = {
          "C102": { x: -30, y: 0, z: -20, size: 40, weight: "22,450 kg", truck: "T04" },
          "C105": { x: -30, y: 18, z: -20, size: 40, weight: "26,000 kg", truck: "T07" },
          "C107": { x: 30, y: 0, z: -20, size: 20, weight: "16,800 kg", truck: "T09" }
        };

        // Add real containers
        Object.entries(containerMeta).forEach(([cId, meta]) => {
          const matchingInc = incidents.find(i => i.container_id === cId);
          const isHard = matchingInc?.severity === "CRITICAL";
          const isNeedsVerif = matchingInc?.severity === "HIGH";

          realMapped.push({
            id: cId,
            code: cId,
            x: meta.x,
            y: meta.y,
            z: meta.z,
            size: meta.size,
            color: isHard ? "#da3633" : isNeedsVerif ? "#d29922" : "#238636",
            darkColor: isHard ? "#f85149" : isNeedsVerif ? "#e3b341" : "#3fb950",
            status: isHard ? "BLOCKER" : isNeedsVerif ? "CRITICAL" : "RECOVERED",
            desc: matchingInc ? `${matchingInc.title} (Root: ${matchingInc.root_blocker_code})` : `Cleared container ${cId} - Staged for gate-out`,
            weight: meta.weight,
            truck: meta.truck,
            avoidableCost: matchingInc?.projected_avoidable_cost_inr || 0
          });
        });

        setLiveContainers(realMapped);
      } catch (err) {
        console.error(err);
      }
    };

    loadRealContainers();
    const interval = setInterval(loadRealContainers, 6000);
    return () => clearInterval(interval);
  }, []);

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

  // 3D Matrix Mathematics
  const project3D = useCallback(
    (x: number, y: number, z: number, width: number, height: number, cx: number, cy: number, currentRotX: number, currentRotY: number, currentZoom: number) => {
      // Rotation around Y axis (yaw)
      const cosY = Math.cos(currentRotY);
      const sinY = Math.sin(currentRotY);
      const x1 = x * cosY - z * sinY;
      const z1 = z * cosY + x * sinY;

      // Rotation around X axis (pitch)
      const cosX = Math.cos(currentRotX);
      const sinX = Math.sin(currentRotX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = z1 * cosX + y * sinX;

      // Camera distance and perspective projection
      const cameraDist = 480;
      const scale = (cameraDist / (cameraDist + z2)) * currentZoom * 1.4;

      const screenX = cx + x1 * scale;
      const screenY = cy - y2 * scale; // invert Y for screen coords

      return { x: screenX, y: screenY, depth: z2, scale };
    },
    []
  );

  // Render 3D Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localRotY = rotY;

    const render = () => {
      timeRef.current += 0.016;
      if (isAutoRotate && !isDraggingRef.current) {
        localRotY += 0.003;
        setRotY(localRotY);
      } else {
        localRotY = rotY;
      }

      // Handle retina displays
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
      const cy = height / 2 + 25;

      // Background styling
      const bg = isDark ? "#0d1117" : "#f6f8fa";
      const gridLine = isDark ? "#21262d" : "#e1e4e8";
      const groundColor = isDark ? "#161b22" : "#ffffff";
      const waterColor = isDark ? "#0f172a" : "#e0f2fe";

      // 1. Draw Waterway (Berth Basin)
      const waterPoly = [
        project3D(-260, -2, -180, width, height, cx, cy, rotX, localRotY, zoom),
        project3D(260, -2, -180, width, height, cx, cy, rotX, localRotY, zoom),
        project3D(260, -2, -90, width, height, cx, cy, rotX, localRotY, zoom),
        project3D(-260, -2, -90, width, height, cx, cy, rotX, localRotY, zoom)
      ];

      ctx.beginPath();
      ctx.moveTo(waterPoly[0].x, waterPoly[0].y);
      for (let i = 1; i < waterPoly.length; i++) ctx.lineTo(waterPoly[i].x, waterPoly[i].y);
      ctx.closePath();
      ctx.fillStyle = waterColor;
      ctx.fill();
      ctx.strokeStyle = isDark ? "#1e293b" : "#bae6fd";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Water Ripple Animation
      const rippleOffset = Math.sin(timeRef.current * 2) * 5;
      const wR1 = project3D(-180 + rippleOffset, -2, -135, width, height, cx, cy, rotX, localRotY, zoom);
      const wR2 = project3D(180 + rippleOffset, -2, -135, width, height, cx, cy, rotX, localRotY, zoom);
      ctx.beginPath();
      ctx.moveTo(wR1.x, wR1.y);
      ctx.lineTo(wR2.x, wR2.y);
      ctx.strokeStyle = isDark ? "#38bdf820" : "#38bdf840";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Draw Vessel (Maersk Saltoro Hull)
      const shipCenter = { x: 0, z: -135 };
      const shipCorners = [
        project3D(shipCenter.x - 170, 0, shipCenter.z - 30, width, height, cx, cy, rotX, localRotY, zoom),
        project3D(shipCenter.x + 130, 0, shipCenter.z - 30, width, height, cx, cy, rotX, localRotY, zoom),
        project3D(shipCenter.x + 165, 0, shipCenter.z, width, height, cx, cy, rotX, localRotY, zoom), // bow taper
        project3D(shipCenter.x + 130, 0, shipCenter.z + 30, width, height, cx, cy, rotX, localRotY, zoom),
        project3D(shipCenter.x - 170, 0, shipCenter.z + 30, width, height, cx, cy, rotX, localRotY, zoom)
      ];

      ctx.beginPath();
      ctx.moveTo(shipCorners[0].x, shipCorners[0].y);
      for (let i = 1; i < shipCorners.length; i++) ctx.lineTo(shipCorners[i].x, shipCorners[i].y);
      ctx.closePath();
      ctx.fillStyle = isDark ? "#1e293b" : "#cbd5e1";
      ctx.fill();
      ctx.strokeStyle = isDark ? "#388bfd" : "#0284c7";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Vessel superstructure & name
      const shipBridge = project3D(shipCenter.x - 120, 15, shipCenter.z, width, height, cx, cy, rotX, localRotY, zoom);
      ctx.fillStyle = isDark ? "#f8fafc" : "#0f172a";
      ctx.font = "bold 9px monospace";
      ctx.fillText("MAERSK SALTORO [BERTH 03]", shipBridge.x - 65, shipBridge.y);

      // 3. Ground Quay & Staging Grid
      const groundPoints = [
        project3D(-240, 0, -85, width, height, cx, cy, rotX, localRotY, zoom),
        project3D(240, 0, -85, width, height, cx, cy, rotX, localRotY, zoom),
        project3D(240, 0, 190, width, height, cx, cy, rotX, localRotY, zoom),
        project3D(-240, 0, 190, width, height, cx, cy, rotX, localRotY, zoom)
      ];

      ctx.beginPath();
      ctx.moveTo(groundPoints[0].x, groundPoints[0].y);
      for (let i = 1; i < groundPoints.length; i++) ctx.lineTo(groundPoints[i].x, groundPoints[i].y);
      ctx.closePath();
      ctx.fillStyle = groundColor;
      ctx.fill();
      ctx.strokeStyle = gridLine;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Grid Lines on Quay
      for (let x = -200; x <= 200; x += 40) {
        const p1 = project3D(x, 0, -80, width, height, cx, cy, rotX, localRotY, zoom);
        const p2 = project3D(x, 0, 180, width, height, cx, cy, rotX, localRotY, zoom);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = gridLine;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      for (let z = -80; z <= 180; z += 40) {
        const p1 = project3D(-200, 0, z, width, height, cx, cy, rotX, localRotY, zoom);
        const p2 = project3D(200, 0, z, width, height, cx, cy, rotX, localRotY, zoom);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = gridLine;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      // 4. STS Gantry Cranes (Berth Cranes)
      const cranePositions = [-100, 40];
      cranePositions.forEach((craneX) => {
        const base1 = project3D(craneX - 18, 0, -75, width, height, cx, cy, rotX, localRotY, zoom);
        const base2 = project3D(craneX + 18, 0, -75, width, height, cx, cy, rotX, localRotY, zoom);
        const top1 = project3D(craneX - 18, 55, -75, width, height, cx, cy, rotX, localRotY, zoom);
        const top2 = project3D(craneX + 18, 55, -75, width, height, cx, cy, rotX, localRotY, zoom);
        const boomSea = project3D(craneX, 60, -145, width, height, cx, cy, rotX, localRotY, zoom);
        const boomLand = project3D(craneX, 60, 0, width, height, cx, cy, rotX, localRotY, zoom);

        // Crane Gantry Structure
        ctx.beginPath();
        ctx.moveTo(base1.x, base1.y);
        ctx.lineTo(top1.x, top1.y);
        ctx.lineTo(top2.x, top2.y);
        ctx.lineTo(base2.x, base2.y);
        ctx.moveTo(top1.x, top1.y);
        ctx.lineTo(boomSea.x, boomSea.y);
        ctx.lineTo(boomLand.x, boomLand.y);
        ctx.strokeStyle = isDark ? "#e3b341" : "#d97706";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Trolley & Spreader cable
        const trolleyX = craneX;
        const trolleyZ = -100 + Math.sin(timeRef.current * 1.5 + craneX) * 25;
        const trolley = project3D(trolleyX, 58, trolleyZ, width, height, cx, cy, rotX, localRotY, zoom);
        const spreader = project3D(trolleyX, 22, trolleyZ, width, height, cx, cy, rotX, localRotY, zoom);

        ctx.beginPath();
        ctx.moveTo(trolley.x, trolley.y);
        ctx.lineTo(spreader.x, spreader.y);
        ctx.strokeStyle = isDark ? "#94a3b8" : "#64748b";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Spreader Head
        ctx.fillStyle = isDark ? "#f59e0b" : "#b45309";
        ctx.fillRect(spreader.x - 6, spreader.y - 2, 12, 4);
      });

      // 5. Draw 3D Polygons for Containers (Depth Sorted)
      interface DrawablePoly {
        points: { x: number; y: number }[];
        fillColor: string;
        strokeColor: string;
        avgZ: number;
        isContainer?: boolean;
        containerData?: Container3D;
      }

      const drawables: DrawablePoly[] = [];

      liveContainers.forEach((c) => {
        const length = c.size === 40 ? 50 : 25;
        const widthHalf = 12;
        const height = 16;

        const x0 = c.x - length / 2;
        const x1 = c.x + length / 2;
        const y0 = c.y;
        const y1 = c.y + height;
        const z0 = c.z - widthHalf;
        const z1 = c.z + widthHalf;

        // 8 vertices of 3D box
        const v000 = project3D(x0, y0, z0, width, height, cx, cy, rotX, localRotY, zoom);
        const v100 = project3D(x1, y0, z0, width, height, cx, cy, rotX, localRotY, zoom);
        const v110 = project3D(x1, y1, z0, width, height, cx, cy, rotX, localRotY, zoom);
        const v010 = project3D(x0, y1, z0, width, height, cx, cy, rotX, localRotY, zoom);
        const v001 = project3D(x0, y0, z1, width, height, cx, cy, rotX, localRotY, zoom);
        const v101 = project3D(x1, y0, z1, width, height, cx, cy, rotX, localRotY, zoom);
        const v111 = project3D(x1, y1, z1, width, height, cx, cy, rotX, localRotY, zoom);
        const v011 = project3D(x0, y1, z1, width, height, cx, cy, rotX, localRotY, zoom);

        const baseColor = isDark ? c.darkColor : c.color;
        const stroke = isDark ? "#30363d" : "#ffffff";

        // Top face
        drawables.push({
          points: [v010, v110, v111, v011],
          fillColor: baseColor,
          strokeColor: stroke,
          avgZ: (v010.depth + v110.depth + v111.depth + v011.depth) / 4,
          isContainer: true,
          containerData: c
        });

        // Front face (+Z)
        drawables.push({
          points: [v001, v101, v111, v011],
          fillColor: adjustBrightness(baseColor, -15),
          strokeColor: stroke,
          avgZ: (v001.depth + v101.depth + v111.depth + v011.depth) / 4,
          isContainer: true,
          containerData: c
        });

        // Right face (+X)
        drawables.push({
          points: [v100, v101, v111, v110],
          fillColor: adjustBrightness(baseColor, -25),
          strokeColor: stroke,
          avgZ: (v100.depth + v101.depth + v111.depth + v110.depth) / 4,
          isContainer: true,
          containerData: c
        });
      });

      // Sort faces by depth (Painter's algorithm: farthest first)
      drawables.sort((a, b) => a.avgZ - b.avgZ);

      // Render sorted 3D faces
      drawables.forEach((poly) => {
        ctx.beginPath();
        ctx.moveTo(poly.points[0].x, poly.points[0].y);
        for (let i = 1; i < poly.points.length; i++) ctx.lineTo(poly.points[i].x, poly.points[i].y);
        ctx.closePath();
        ctx.fillStyle = poly.fillColor;
        ctx.fill();
        ctx.strokeStyle = poly.strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label highlight on top face
        if (poly.containerData && poly.points[0] === poly.points[0]) {
          const isSelected = selectedEntity?.id === poly.containerData.id;
          const isHovered = hoveredEntity?.id === poly.containerData.id;

          if (isSelected || isHovered) {
            ctx.strokeStyle = "#388bfd";
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }
        }
      });

      // 6. Draw Animated Trucks on Transport Lanes
      trucksRef.current.forEach((truck) => {
        // Move truck toward target
        const dx = truck.targetX - truck.x;
        const dz = truck.targetZ - truck.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1) {
          truck.x += (dx / dist) * truck.speed;
          truck.z += (dz / dist) * truck.speed;
        } else {
          // loop back
          if (truck.id === "T04") {
            truck.x = -140;
            truck.z = 60;
          } else {
            truck.x = 40;
            truck.z = 120;
          }
        }

        const tCenter = project3D(truck.x, 0, truck.z, width, height, cx, cy, rotX, localRotY, zoom);
        const tCab = project3D(truck.x + 10, 8, truck.z, width, height, cx, cy, rotX, localRotY, zoom);

        // Draw Truck Chassis & Cab
        ctx.beginPath();
        ctx.arc(tCenter.x, tCenter.y, 6 * tCenter.scale, 0, Math.PI * 2);
        ctx.fillStyle = truck.color;
        ctx.fill();
        ctx.strokeStyle = isDark ? "#ffffff" : "#1f2328";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Truck Label Pill
        ctx.fillStyle = isDark ? "#ffffff" : "#1f2328";
        ctx.font = "bold 9px monospace";
        ctx.fillText(truck.id, tCenter.x + 8, tCenter.y + 3);

        // Route guide path line
        if (showRoutes && truck.id === "T04") {
          const startPt = project3D(-140, 0, 60, width, height, cx, cy, rotX, localRotY, zoom);
          const endPt = project3D(-20, 0, 60, width, height, cx, cy, rotX, localRotY, zoom);
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.moveTo(startPt.x, startPt.y);
          ctx.lineTo(endPt.x, endPt.y);
          ctx.strokeStyle = isDark ? "#388bfd80" : "#2563eb80";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // 7. Render 3D HUD Markers for Key Locations
      const s1600Marker = project3D(-20, 18, 70, width, height, cx, cy, rotX, localRotY, zoom);
      ctx.fillStyle = isDark ? "#388bfd" : "#2563eb";
      ctx.font = "bold 10px monospace";
      ctx.fillText("BAY S1600", s1600Marker.x - 28, s1600Marker.y - 12);

      // Blocker Pulsing Beacon for C102
      const c102 = liveContainers.find((c) => c.id === "C102");
      if (c102) {
        const beaconPt = project3D(c102.x, c102.y + 32, c102.z, width, height, cx, cy, rotX, localRotY, zoom);
        const pulse = (Math.sin(timeRef.current * 4) + 1) / 2;
        ctx.beginPath();
        ctx.arc(beaconPt.x, beaconPt.y, 4 + pulse * 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(248, 81, 73, ${0.4 + pulse * 0.4})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(beaconPt.x, beaconPt.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#da3633";
        ctx.fill();

        ctx.fillStyle = isDark ? "#f85149" : "#cf222e";
        ctx.font = "bold 9px monospace";
        ctx.fillText("BLOCKER C102", beaconPt.x + 8, beaconPt.y + 3);
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [rotX, rotY, zoom, isAutoRotate, isDark, showRoutes, selectedEntity, hoveredEntity, project3D, liveContainers]);

  // Color helper function
  const adjustBrightness = (hex: string, percent: number) => {
    let num = parseInt(hex.replace("#", ""), 16);
    if (isNaN(num)) return hex;
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00ff) + percent;
    let b = (num & 0x0000ff) + percent;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  // Mouse drag handlers for full 3D orbital control
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
    setRotX((prev) => Math.max(0.15, Math.min(1.2, prev + dy * 0.006)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Toggle container selection (defaults to C102 on click)
    if (!selectedEntity) {
      const c102 = liveContainers.find((c) => c.id === "C102");
      setSelectedEntity(c102 || null);
    } else {
      setSelectedEntity(null);
    }
  };

  return (
    <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* 3D Viewport Header */}
      <div className="bg-[#F3F4F6] dark:bg-[#090B0E] px-4 py-2.5 border-b border-[#D1D5DB] dark:border-[#222936] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Rotate3d className="w-5 h-5 text-[#0284C7]" />
          <div>
            <h3 className="font-mono text-xs font-bold text-[#111827] dark:text-[#F0F4F8] uppercase tracking-wide">
              JNPT Nhava Sheva Terminal: 3D Digital Twin
            </h3>
            <span className="text-[10px] text-[#D97706] font-mono font-bold block">
              ILLUSTRATIVE SIMULATION VIEW — NOT LIVE PHYSICAL TELEMETRY
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-sm bg-[#16A34A]/10 text-[#16A34A] font-mono text-[10px] font-bold border border-[#16A34A]/30 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            <span>60 FPS</span>
          </span>
        </div>

        {/* 3D Controls Bar */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            onClick={() => setIsAutoRotate(!isAutoRotate)}
            className={`px-2.5 py-1 rounded-md border flex items-center space-x-1 transition shadow-sm ${
              isAutoRotate
                ? "bg-blue-50 dark:bg-[#1f6feb]/15 border-blue-300 dark:border-[#388bfd] text-blue-700 dark:text-sky-400 font-bold"
                : "bg-white dark:bg-[#21262d] border-[#d0d7de] dark:border-[#30363d] text-[#656d76] dark:text-[#8b949e]"
            }`}
            title="Toggle Auto Rotation"
          >
            {isAutoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isAutoRotate ? "Pause Spin" : "Auto Spin"}</span>
          </button>

          <button
            onClick={() => setShowRoutes(!showRoutes)}
            className={`px-2.5 py-1 rounded-md border flex items-center space-x-1 transition shadow-sm ${
              showRoutes
                ? "bg-blue-50 dark:bg-[#1f6feb]/15 border-blue-300 dark:border-[#388bfd] text-blue-700 dark:text-sky-400 font-bold"
                : "bg-white dark:bg-[#21262d] border-[#d0d7de] dark:border-[#30363d] text-[#656d76] dark:text-[#8b949e]"
            }`}
            title="Toggle Truck Haulage Routes"
          >
            <Truck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Truck Lanes</span>
          </button>

          <div className="flex items-center space-x-1 border-l border-[#d0d7de] dark:border-[#30363d] pl-2">
            <button
              onClick={() => setZoom((prev) => Math.min(1.8, prev + 0.15))}
              className="p-1.5 bg-white dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] hover:bg-gray-100 dark:hover:bg-[#30363d] rounded-md text-[#1f2328] dark:text-[#e6edf3]"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.15))}
              className="p-1.5 bg-white dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] hover:bg-gray-100 dark:hover:bg-[#30363d] rounded-md text-[#1f2328] dark:text-[#e6edf3]"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setRotX(0.55);
                setRotY(-0.78);
                setZoom(1.0);
              }}
              className="p-1.5 bg-white dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] hover:bg-gray-100 dark:hover:bg-[#30363d] rounded-md text-[#1f2328] dark:text-[#e6edf3]"
              title="Reset 3D Perspective"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3D Interactive Canvas Area */}
      <div className="relative w-full h-[360px] cursor-grab active:cursor-grabbing overflow-hidden bg-[#f6f8fa] dark:bg-[#0d1117]">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
          className="w-full h-full block"
        />

        {/* Floating Controls Overlay Tip */}
        <div className="absolute bottom-3 left-3 bg-white dark:bg-[#161B24] px-3 py-1.5 rounded-sm border border-[#D1D5DB] dark:border-[#222936] text-[10px] font-mono text-[#6B7280] dark:text-[#8A99AD] flex items-center space-x-2 pointer-events-none">
          <Rotate3d className="w-3 h-3 text-[#0284C7]" />
          <span>Click & Drag to Orbit | Scroll to Zoom | Click Container for Inspection</span>
        </div>

        {/* Selected Entity Card Drawer */}
        {selectedEntity && (
          <div className="absolute top-3 right-3 w-80 bg-white dark:bg-[#161B24] p-3 rounded-sm border border-[#0284C7] shadow-none text-xs font-mono space-y-2.5 transition animate-in fade-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-[#d0d7de] dark:border-[#30363d] pb-2">
              <span className="font-bold text-[#1f2328] dark:text-[#e6edf3] text-sm flex items-center space-x-1.5">
                <Box className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                <span>Container {selectedEntity.code}</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedEntity.status === "BLOCKER"
                    ? "bg-red-100 dark:bg-[#da3633]/20 text-red-700 dark:text-[#f85149]"
                    : selectedEntity.status === "RECOVERED"
                    ? "bg-emerald-100 dark:bg-[#238636]/20 text-emerald-700 dark:text-[#3fb950]"
                    : "bg-blue-100 dark:bg-[#1f6feb]/20 text-blue-700 dark:text-[#58a6ff]"
                }`}
              >
                {selectedEntity.status}
              </span>
            </div>

            <p className="text-[#1f2328] dark:text-[#e6edf3] text-xs font-sans leading-relaxed">
              {selectedEntity.desc}
            </p>

            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
              <div className="bg-[#f6f8fa] dark:bg-[#0d1117] p-2 rounded border border-[#d0d7de] dark:border-[#30363d]">
                <span className="text-[#656d76] dark:text-[#8b949e] block">GROSS WEIGHT</span>
                <strong className="text-[#1f2328] dark:text-[#e6edf3]">{selectedEntity.weight}</strong>
              </div>
              <div className="bg-[#f6f8fa] dark:bg-[#0d1117] p-2 rounded border border-[#d0d7de] dark:border-[#30363d]">
                <span className="text-[#656d76] dark:text-[#8b949e] block">ASSIGNED TRUCK</span>
                <strong className="text-blue-600 dark:text-sky-400">{selectedEntity.truck || "Truck T04"}</strong>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-[#d0d7de] dark:border-[#30363d] text-[10px]">
              <span className="text-[#656d76] dark:text-[#8b949e]">QpiAI QAOA Demurrage Risk: ₹18,000</span>
              <button
                onClick={() => setSelectedEntity(null)}
                className="text-blue-600 dark:text-sky-400 hover:underline font-bold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Yard Operations Status Legend Bar */}
      <div className="bg-[#f6f8fa] dark:bg-[#161b22] px-4 py-2.5 border-t border-[#d0d7de] dark:border-[#30363d] flex flex-wrap items-center justify-between text-xs font-mono text-[#656d76] dark:text-[#8b949e]">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600 dark:bg-[#f85149]" />
            <span>Active Blocker (C102)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-[#238636]" />
            <span>Recovered / Cleared</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 dark:bg-[#1f6feb]" />
            <span>Scheduled Staging</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 dark:bg-[#e3b341]" />
            <span>STS Crane Gantry</span>
          </span>
        </div>

        <div className="text-[11px] font-semibold text-[#1f2328] dark:text-[#e6edf3]">
          Berth 03: STS Cranes 01 & 02 Operating Normal
        </div>
      </div>
    </div>
  );
}

