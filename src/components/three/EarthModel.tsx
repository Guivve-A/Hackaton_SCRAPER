"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface EarthModelProps {
  scale?: number;
}

export function EarthModel({ scale = 1 }: EarthModelProps) {
  const { scene } = useGLTF("/models/tierra.glb");
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.07;
    }
  });

  return <primitive ref={ref} object={scene} scale={scale} />;
}

useGLTF.preload("/models/tierra.glb");
