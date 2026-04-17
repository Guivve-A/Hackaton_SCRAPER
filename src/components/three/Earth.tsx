"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

const RADIUS = 2;
const SEGMENTS = 48;

export function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const { gl } = useThree();

  const [colorMap, normalMap, specularMap, cloudsMap] = useTexture([
    "/textures/earth-color.jpg",
    "/textures/earth-normal.jpg",
    "/textures/earth-specular.jpg",
    "/textures/earth-clouds.jpg",
  ]);

  useEffect(() => {
    const maxAniso = Math.min(gl.capabilities.getMaxAnisotropy(), 8);
    /* eslint-disable react-hooks/immutability -- three.js textures are designed to be configured after load */
    colorMap.colorSpace = THREE.SRGBColorSpace;
    cloudsMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = maxAniso;
    normalMap.anisotropy = maxAniso;
    colorMap.needsUpdate = true;
    cloudsMap.needsUpdate = true;
    /* eslint-enable react-hooks/immutability */
  }, [colorMap, normalMap, cloudsMap, gl]);

  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.04;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.055;
    }
  });

  return (
    <group position={[0, -1, 0]}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[RADIUS, SEGMENTS, SEGMENTS]} />
        <meshStandardMaterial
          map={colorMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.85, 0.85)}
          roughnessMap={specularMap}
          roughness={1}
          metalness={0.05}
        />
      </mesh>

      <mesh ref={cloudsRef}>
        <sphereGeometry args={[RADIUS * 1.01, SEGMENTS, SEGMENTS]} />
        <meshStandardMaterial
          map={cloudsMap}
          alphaMap={cloudsMap}
          transparent
          opacity={0.55}
          depthWrite={false}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

useTexture.preload([
  "/textures/earth-color.jpg",
  "/textures/earth-normal.jpg",
  "/textures/earth-specular.jpg",
  "/textures/earth-clouds.jpg",
]);
