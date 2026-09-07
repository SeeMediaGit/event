"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A film reel: two metal discs with a punched ring of holes, a hub and six
// spokes. The holes are not booleans — CSG at runtime costs more than it is
// worth here — they are near-black cylinders pushed through both discs, which
// reads as a hole under a rim light and costs one draw call each.

const HOLE_COUNT = 8;
const HOLE_RING_RADIUS = 1.12;
const SPOKE_COUNT = 6;
const DISC_RADIUS = 1.62;
const DISC_OFFSET = 0.19;

// Ring positions are fixed geometry, so they are computed once at module load
// rather than per render.
const HOLES = Array.from({ length: HOLE_COUNT }, (_, i) => {
  const angle = (i / HOLE_COUNT) * Math.PI * 2;
  return [
    Math.cos(angle) * HOLE_RING_RADIUS,
    Math.sin(angle) * HOLE_RING_RADIUS,
  ] as const;
});

const SPOKES = Array.from(
  { length: SPOKE_COUNT },
  (_, i) => (i / SPOKE_COUNT) * Math.PI,
);

export default function FilmReel({
  animate,
  speedRef,
}: {
  animate: boolean;
  // Radians per second, driven by scroll in Hero3D. A ref rather than a prop so
  // that scrolling never re-renders the React tree — only the frame loop reads it.
  speedRef: React.MutableRefObject<number>;
}) {
  const spin = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!animate || !spin.current) return;
    // delta is clamped: a backgrounded tab resumes with a multi-second delta,
    // which would otherwise snap the reel to a random angle.
    spin.current.rotation.z += speedRef.current * Math.min(delta, 0.1);
  });

  return (
    // Three-quarter view, so the discs read as discs and the rim light has an
    // edge to catch.
    <group rotation={[0.3, -0.38, 0]}>
      <group ref={spin} rotation={[0, 0, animate ? 0 : 0.42]}>
        {[DISC_OFFSET, -DISC_OFFSET].map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[DISC_RADIUS, DISC_RADIUS, 0.05, 64]} />
            <meshStandardMaterial
              color="#171717"
              metalness={0.95}
              roughness={0.28}
            />
          </mesh>
        ))}

        {/* Outer rim — a torus rather than a thicker disc, so the highlight
            runs as a thin line around the edge. */}
        {[DISC_OFFSET, -DISC_OFFSET].map((z) => (
          <mesh key={`rim-${z}`} position={[0, 0, z]}>
            <torusGeometry args={[DISC_RADIUS, 0.055, 16, 96]} />
            <meshStandardMaterial
              color="#2a2a2a"
              metalness={1}
              roughness={0.18}
            />
          </mesh>
        ))}

        {/* The film wound between the discs. */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.34, 1.34, DISC_OFFSET * 2 - 0.02, 64]} />
          <meshStandardMaterial
            color="#0d0d0d"
            metalness={0.4}
            roughness={0.75}
          />
        </mesh>

        {HOLES.map(([x, y], i) => (
          <mesh
            key={`hole-${i}`}
            position={[x, y, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.2, 0.2, DISC_OFFSET * 2 + 0.12, 24]} />
            <meshStandardMaterial
              color="#050505"
              metalness={0.2}
              roughness={0.9}
            />
          </mesh>
        ))}

        {SPOKES.map((angle, i) => (
          <mesh key={`spoke-${i}`} rotation={[0, 0, angle]}>
            <boxGeometry args={[2.5, 0.1, DISC_OFFSET * 2]} />
            <meshStandardMaterial
              color="#202020"
              metalness={0.9}
              roughness={0.35}
            />
          </mesh>
        ))}

        {/* Hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, DISC_OFFSET * 2 + 0.16, 32]} />
          <meshStandardMaterial
            color="#3a3a3a"
            metalness={1}
            roughness={0.22}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, DISC_OFFSET * 2 + 0.2, 24]} />
          <meshStandardMaterial color="#0a0a0a" roughness={1} />
        </mesh>
      </group>
    </group>
  );
}
