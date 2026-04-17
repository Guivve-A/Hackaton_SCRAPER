"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { Earth } from "./Earth";
import { InteractiveParticles } from "./InteractiveParticles";

function StarBackdrop() {
  const { scene } = useThree();
  const texture = useTexture("/textures/night_sky_stars.jpg");

  useEffect(() => {
    /* eslint-disable react-hooks/immutability -- three.js scene/texture are mutated imperatively after load */
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    scene.background = texture;
    return () => {
      if (scene.background === texture) scene.background = null;
    };
    /* eslint-enable react-hooks/immutability */
  }, [scene, texture]);

  return null;
}

function AdaptiveDpr() {
  const { gl } = useThree();

  useEffect(() => {
    const manager = THREE.DefaultLoadingManager;
    const prev = manager.onLoad;
    manager.onLoad = () => {
      prev?.();
      const target = Math.min(window.devicePixelRatio, 1.8);
      gl.setPixelRatio(target);
    };
    return () => {
      manager.onLoad = prev;
    };
  }, [gl]);

  return null;
}

export function Scene3D() {
  const [initialDpr] = useState<[number, number]>(() => [1, 1.4]);

  return (
    <Canvas
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      dpr={initialDpr}
      camera={{ position: [0, 0, 5.4], fov: 38 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.05} />
      <directionalLight position={[5, 3, 5]} intensity={2.5} color="#ffffff" />
      <AdaptiveDpr />
      <Suspense
        fallback={
          <Stars
            radius={80}
            depth={40}
            count={5000}
            factor={3.5}
            saturation={0}
            fade
            speed={0.4}
          />
        }
      >
        <StarBackdrop />
        <Earth />
      </Suspense>
      <InteractiveParticles />
    </Canvas>
  );
}
