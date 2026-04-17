"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import * as THREE from "three";

const COUNT = 3500;
const INNER_RADIUS = 2.6;
const OUTER_RADIUS = 5.2;
const REPEL_RADIUS = 1.2;

function buildParticles() {
  const positions = new Float32Array(COUNT * 3);
  const homes = new Float32Array(COUNT * 3);
  const displacements = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const r =
      INNER_RADIUS +
      Math.pow(Math.random(), 1.4) * (OUTER_RADIUS - INNER_RADIUS);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    positions[i * 3] = homes[i * 3] = x;
    positions[i * 3 + 1] = homes[i * 3 + 1] = y;
    positions[i * 3 + 2] = homes[i * 3 + 2] = z;
    sizes[i] = 0.7 + Math.random() * 1.4;
  }

  return { positions, homes, displacements, sizes };
}

const PARTICLES = buildParticles();

const vertexShader = /* glsl */ `
  uniform float uPixelRatio;
  attribute float aSize;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * (260.0 / -mvPosition.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.42, d);
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function InteractiveParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { camera, gl } = useThree();

  const { positions, homes, displacements, sizes } = useMemo(
    () => ({
      positions: PARTICLES.positions.slice(),
      homes: PARTICLES.homes,
      displacements: PARTICLES.displacements.slice(),
      sizes: PARTICLES.sizes,
    }),
    []
  );

  const uniforms = useMemo(
    () => ({
      uPixelRatio: { value: gl.getPixelRatio() },
      uColor: { value: new THREE.Color("#dff2ff") },
    }),
    [gl]
  );

  const dispersion = useRef({ factor: 0 });
  const prevPointer = useRef({ x: 0, y: 0, t: 0 });

  useEffect(() => {
    const canvas = gl.domElement;
    const tmpDir = new THREE.Vector3();
    const tmpWorld = new THREE.Vector3();
    prevPointer.current.t = performance.now();
    const dispersionState = dispersion.current;

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const now = performance.now();
      const dt = Math.max((now - prevPointer.current.t) / 1000, 0.001);
      const dx = nx - prevPointer.current.x;
      const dy = ny - prevPointer.current.y;
      const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
      prevPointer.current = { x: nx, y: ny, t: now };

      if (velocity < 0.4) return;

      tmpDir
        .set(nx, ny, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      const distToPlane = -camera.position.z / tmpDir.z;
      tmpWorld
        .copy(camera.position)
        .add(tmpDir.multiplyScalar(distToPlane));

      const strength = Math.min(velocity, 4) * 0.5;
      displacements.fill(0);

      for (let i = 0; i < COUNT; i++) {
        const hx = homes[i * 3];
        const hy = homes[i * 3 + 1];
        const hz = homes[i * 3 + 2];
        const tx = hx - tmpWorld.x;
        const ty = hy - tmpWorld.y;
        const tz = hz - tmpWorld.z;
        const dist = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (dist < REPEL_RADIUS) {
          const fall = (1 - dist / REPEL_RADIUS) * strength;
          const inv = 1 / Math.max(dist, 0.0001);
          displacements[i * 3] = tx * inv * fall;
          displacements[i * 3 + 1] = ty * inv * fall;
          displacements[i * 3 + 2] = tz * inv * fall;
        }
      }

      gsap.killTweensOf(dispersionState);
      dispersionState.factor = 1;
      gsap.to(dispersionState, {
        factor: 0,
        duration: 1.8,
        ease: "elastic.out(1, 0.5)",
      });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      gsap.killTweensOf(dispersionState);
    };
  }, [camera, gl, displacements, homes]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const f = dispersion.current.factor;
    const len = COUNT * 3;
    for (let i = 0; i < len; i++) {
      arr[i] = homes[i] + displacements[i] * f;
    }
    attr.needsUpdate = true;
    pointsRef.current.rotation.y += delta * 0.012;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={COUNT}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[sizes, 1]}
          count={COUNT}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
