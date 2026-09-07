"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Vertical poster planes orbiting the reel. Each one starts on a generated
// brand-green gradient and swaps to the real artwork only once that image has
// actually decoded, so a slow CDN or a blocked request degrades to a green card
// instead of a black rectangle or a thrown loader error.

const RADIUS = 3.7;
const PLANE_W = 1.05;
const PLANE_H = 1.55;

// One gradient canvas, reused by every plane that has no artwork. 2px wide is
// enough: the gradient runs top to bottom and the sampler stretches the rest.
function makeGradientTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#22c55e");
    gradient.addColorStop(0.55, "#16a34a");
    gradient.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Poster images come from Supabase Storage and Bunny's CDN, i.e. a different
// origin than events.seemedia.mn. Without crossOrigin = "anonymous" the texture
// either fails outright or taints the canvas.
function useArtworkTextures(urls: string[]): (THREE.Texture | null)[] {
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>(() =>
    urls.map(() => null),
  );

  // The URL list is derived from props on every render; joining it gives a
  // stable dependency so the loader does not restart each frame.
  const key = urls.join("|");

  useEffect(() => {
    let cancelled = false;
    const loaded: (THREE.Texture | null)[] = urls.map(() => null);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    urls.forEach((url, i) => {
      loader.load(
        url,
        (texture) => {
          if (cancelled) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          loaded[i] = texture;
          setTextures([...loaded]);
        },
        undefined,
        () => {
          // Missing or CORS-refused image: leave the slot null and let the
          // gradient stand in. Logged, not surfaced — a poster that failed to
          // load is not something the applicant can act on.
          console.warn("poster texture failed:", url);
        },
      );
    });

    return () => {
      cancelled = true;
      loaded.forEach((texture) => texture?.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return textures;
}

export default function PosterField({
  urls,
  count,
  animate,
}: {
  urls: string[];
  count: number;
  animate: boolean;
}) {
  // Cycle whatever artwork the event has across all the slots; an event with a
  // single poster still fills the ring.
  const slotUrls = useMemo(
    () =>
      urls.length === 0
        ? []
        : Array.from({ length: count }, (_, i) => urls[i % urls.length]),
    [urls, count],
  );

  const textures = useArtworkTextures(slotUrls);
  const gradient = useMemo(makeGradientTexture, []);

  useEffect(() => () => gradient.dispose(), [gradient]);

  // Fixed layout: evenly spaced around the reel, alternating heights so the
  // ring does not read as a flat carousel.
  const slots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + 0.4;
        return {
          angle,
          position: [
            Math.sin(angle) * RADIUS,
            (i % 3) * 0.42 - 0.5,
            Math.cos(angle) * RADIUS - 0.9,
          ] as [number, number, number],
          phase: i * 1.3,
        };
      }),
    [count],
  );

  return (
    <group>
      {slots.map((slot, i) => (
        <Poster
          key={i}
          position={slot.position}
          angle={slot.angle}
          phase={slot.phase}
          animate={animate}
          map={textures[i] ?? gradient}
        />
      ))}
    </group>
  );
}

function Poster({
  position,
  angle,
  phase,
  animate,
  map,
}: {
  position: [number, number, number];
  angle: number;
  phase: number;
  animate: boolean;
  map: THREE.Texture;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!animate || !ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 0.5 + phase) * 0.16;
    ref.current.rotation.z = Math.sin(t * 0.35 + phase) * 0.035;
  });

  return (
    <group ref={ref} position={position} rotation={[0, angle, 0]}>
      <mesh>
        <planeGeometry args={[PLANE_W, PLANE_H]} />
        {/* Double-sided: the far half of the ring shows its back to the camera
            and would otherwise be invisible. */}
        <meshBasicMaterial
          map={map}
          side={THREE.DoubleSide}
          transparent
          opacity={0.82}
          toneMapped={false}
        />
      </mesh>

      {/* Thin brand-green frame so a poster reads as an object rather than a
          floating image. */}
      <lineSegments>
        <edgesGeometry
          args={[new THREE.PlaneGeometry(PLANE_W + 0.03, PLANE_H + 0.03)]}
        />
        <lineBasicMaterial color="#22c55e" transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}
