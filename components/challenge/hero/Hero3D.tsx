"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import FilmReel from "./FilmReel";
import PosterField from "./PosterField";

// The intro step's hero. Loaded through next/dynamic with ssr: false from
// IntroStep, and mounted only while step 1 is on screen — leaving it mounted
// behind the form would keep a WebGL context and a rAF loop alive for the whole
// session.
//
// The parent renders the cover image underneath this canvas and keeps it there,
// so nothing the user sees is ever a black rectangle: the artwork is on screen
// from the first paint and the canvas fades in on top once it has a frame.

const BASE_SPEED = 0.22; // rad/s — one turn every ~29s.
const MAX_SPEED = 2.6;

export default function Hero3D({
  posterUrl,
  coverUrl,
  onReady,
}: {
  posterUrl: string | null;
  coverUrl: string | null;
  onReady?: () => void;
}) {
  // Read on first render, not in an effect: ssr is off for this component, so
  // window is there — and initialising to `false` would mean one frame at
  // desktop dpr with six posters on a phone, and one animated frame for someone
  // who asked for no animation.
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );
  const speedRef = useRef(BASE_SPEED);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 767px)");

    const sync = () => {
      setReducedMotion(motion.matches);
      setIsMobile(narrow.matches);
    };
    sync();

    motion.addEventListener("change", sync);
    narrow.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      narrow.removeEventListener("change", sync);
    };
  }, []);

  const animate = !reducedMotion;

  // Scroll drives the reel's speed: scrolling spins it up, and it eases back to
  // its idle rate. Listener is passive and only writes to a ref, so scrolling
  // costs no React render.
  useEffect(() => {
    if (!animate) return;

    let lastY = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = Math.abs(y - lastY);
      lastY = y;
      speedRef.current = Math.min(
        MAX_SPEED,
        speedRef.current + delta * 0.012,
      );
    };

    // Ease back down independently of the scroll events themselves, otherwise
    // the reel would stay fast forever after one flick.
    const decay = () => {
      speedRef.current += (BASE_SPEED - speedRef.current) * 0.04;
      frame = requestAnimationFrame(decay);
    };
    frame = requestAnimationFrame(decay);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [animate]);

  const urls = useMemo(
    () => [posterUrl, coverUrl].filter((u): u is string => Boolean(u)),
    [posterUrl, coverUrl],
  );

  return (
    <Canvas
      // A phone renders a third of the posters at a capped pixel ratio; the
      // scene is decoration, not detail work, and 3 GPU-bound megapixels is not
      // a trade worth making on a mid-range Android.
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.25, 6.2], fov: 42 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        onReady?.();
      }}
      // Reduced motion means no frame loop at all: r3f renders a single frame
      // on demand and then sits idle.
      frameloop={animate ? "always" : "demand"}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 7, 14]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 5, 5]} intensity={1.1} />
      {/* Brand rim light: green, behind and to the left, so it draws the edge
          of the discs rather than lighting their faces. */}
      <pointLight position={[-4.5, 1.5, -3]} intensity={38} color="#22c55e" />
      <pointLight position={[3.5, -2, -2.5]} intensity={14} color="#16a34a" />

      {/* Reflections for the metal, built in-scene from Lightformers. Using a
          preset here would pull an HDR file off a third-party CDN on every
          load; this generates its own 256px cube map locally instead. */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          intensity={2.2}
          position={[0, 3, 2]}
          scale={[8, 2, 1]}
          color="#ffffff"
        />
        <Lightformer
          intensity={3}
          position={[-4, 0, -2]}
          scale={[4, 4, 1]}
          color="#22c55e"
        />
        <Lightformer
          intensity={1.2}
          position={[4, -1, 1]}
          scale={[3, 3, 1]}
          color="#4ade80"
        />
      </Environment>

      <FilmReel animate={animate} speedRef={speedRef} />
      <PosterField urls={urls} count={isMobile ? 3 : 6} animate={animate} />

      <CameraParallax enabled={animate} />
    </Canvas>
  );
}

// Camera follows the pointer a little. Deliberately small (±0.55 world units)
// and heavily damped — a hero that lurches at the mouse is a hero people scroll
// past. Disabled entirely under prefers-reduced-motion.
function CameraParallax({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame((state, delta) => {
    if (!enabled) return;
    const damp = 1 - Math.pow(0.001, Math.min(delta, 0.1));
    camera.position.x += (state.pointer.x * 0.55 - camera.position.x) * damp;
    camera.position.y +=
      (0.25 + state.pointer.y * 0.28 - camera.position.y) * damp;
    camera.lookAt(target);
  });

  return null;
}
