"use client";
// components/ConfettiBurst.tsx — Lightweight CSS confetti for blowout wins

import React, { useEffect, useState } from "react";

const COLORS = ["#FF6B35", "#E63946", "#FFD166", "#06D6A0", "#118AB2", "#A8DADC", "#F4A261"];

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  size: number;
  vx: number;
  vy: number;
  opacity: number;
  shape: "square" | "circle" | "rect";
}

interface ConfettiBurstProps {
  active: boolean;
  onComplete?: () => void;
}

export function ConfettiBurst({ active, onComplete }: ConfettiBurstProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;

    const newParticles: Particle[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      size: Math.random() * 8 + 6,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      opacity: 1,
      shape: ["square", "circle", "rect"][Math.floor(Math.random() * 3)] as Particle["shape"],
    }));

    setParticles(newParticles);

    const timer = setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, 1800);

    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.shape === "rect" ? p.size * 2 : p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            animation: `confetti-fall-${p.id % 5} 1.8s ease-in forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall-0 { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) translateX(${Math.random() * 40 - 20}px) rotate(720deg); opacity: 0; } }
        @keyframes confetti-fall-1 { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) translateX(${Math.random() * 40 - 20}px) rotate(-540deg); opacity: 0; } }
        @keyframes confetti-fall-2 { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) translateX(${Math.random() * 40 - 20}px) rotate(900deg); opacity: 0; } }
        @keyframes confetti-fall-3 { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) translateX(${Math.random() * 40 - 20}px) rotate(-360deg); opacity: 0; } }
        @keyframes confetti-fall-4 { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) translateX(${Math.random() * 40 - 20}px) rotate(1080deg); opacity: 0; } }
      `}</style>
    </div>
  );
}
