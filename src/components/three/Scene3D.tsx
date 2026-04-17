"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";

import { Earth } from "./Earth";
import { InteractiveParticles } from "./InteractiveParticles";

export function Scene3D() {
  return (
    <Canvas
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 5.4], fov: 38 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.05} />
      <directionalLight position={[5, 3, 5]} intensity={2.5} color="#ffffff" />
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
      <InteractiveParticles />
    </Canvas>
  );
}
