"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";

import { EarthModel } from "./EarthModel";
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
      camera={{ position: [0, 0, 4.6], fov: 38 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 3, 5]} intensity={0.9} />
      <Suspense fallback={null}>
        <Environment preset="city" />
        <EarthModel scale={1.1} />
      </Suspense>
      <InteractiveParticles />
    </Canvas>
  );
}
