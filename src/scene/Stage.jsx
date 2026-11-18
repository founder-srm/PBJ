// The 3D stage behind the story. Scroll progress through the story wrapper picks a keyframe for each layer;
// every frame the layers ease toward it, so scrolling feels smooth in both directions.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildSandwich, blobShadowTexture, DIM } from './sandwich.js';

/* ---------- Keyframes ---------- */
// Assembled heights (layer centres), slightly overlapped so the fillings look squeezed.
const Y = {
  bottom: 0,
  butter: DIM.bread / 2 + DIM.butter / 2 - 0.02,
  jelly: DIM.bread / 2 + DIM.butter + DIM.jelly / 2 - 0.04,
  top: DIM.bread / 2 + DIM.butter + DIM.jelly + DIM.bread / 2 - 0.06,
};
const LAYERS = ['bottom', 'butter', 'jelly', 'top'];

// One entry per story chapter: [position, rotation (radians), scale] per layer.
// 0 hero · 1 problem · 2 Pitch · 3 Build · 4 Jump · 5 assembled finale
const K = [
  { bottom: [[0, Y.bottom, 0], [0, 0, 0], 1], butter: [[0, Y.butter, 0], [0, 0, 0], 1], jelly: [[0, Y.jelly, 0], [0, 0, 0], 1], top: [[0, Y.top, 0], [0, 0, 0], 1] },
  { bottom: [[0, -1.45, 0], [0.18, 0.2, -0.05], 0.88], butter: [[0, -0.55, 0], [0.3, -0.25, 0.06], 0.88], jelly: [[0, 0.3, 0], [0.38, 0.3, -0.04], 0.88], top: [[0, 1.18, 0], [0.42, -0.15, 0.08], 0.88] },
  { bottom: [[1.8, -3.6, -2.6], [0.3, 0.4, 0], 0.85], butter: [[-0.2, 0.2, 0.9], [0.8, -0.3, 0], 0.98], jelly: [[1.4, 3.4, -2.6], [0.4, 0.6, 0], 0.85], top: [[-1.6, 3.4, -2.8], [-0.3, -0.4, 0.2], 0.85] },
  { bottom: [[-0.95, 0.1, 0.4], [1.3, 0.2, 0.1], 0.72], butter: [[0.4, -3.0, -2.8], [0.4, 0.5, 0], 0.8], jelly: [[-0.6, 3.3, -3], [0.5, -0.5, 0], 0.8], top: [[1.0, 0.1, 0.4], [1.3, -0.2, -0.1], 0.72] },
  { bottom: [[1.6, -3.6, -2.6], [0.3, 0.3, 0], 0.85], butter: [[2.4, -3.2, -3.2], [0.3, -0.4, 0], 0.85], jelly: [[-0.15, 0.25, 1.0], [0.85, 0.3, 0], 0.95], top: [[0.5, 3.4, -2.8], [-0.3, 0.4, 0.2], 0.85] },
  { bottom: [[0, Y.bottom, 0], [0, 0, 0], 1], butter: [[0, Y.butter, 0], [0, 0, 0], 1], jelly: [[0, Y.jelly, 0], [0, 0, 0], 1], top: [[0, Y.top, 0], [0, 0, 0], 1] },
];
const LAST = K.length - 1;

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function sample(layer, c) {
  const i = Math.min(LAST - 1, Math.floor(c));
  const t = smooth(clamp01(c - i));
  const a = K[i][layer], b = K[i + 1][layer];
  return {
    pos: a[0].map((v, j) => v + (b[0][j] - v) * t),
    rot: a[1].map((v, j) => v + (b[1][j] - v) * t),
    scale: a[2] + (b[2] - a[2]) * t,
  };
}

/* ---------- Scene ---------- */

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => { env.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

function Sandwich({ progressRef, layout, reduced, lite }) {
  const parts = useMemo(() => buildSandwich({ lite }), [lite]);
  useEffect(() => () => parts.dispose(), [parts]);
  const shadowTex = useMemo(() => blobShadowTexture(), []);

  const group = useRef();
  const refs = { bottom: useRef(), butter: useRef(), jelly: useRef(), top: useRef() };
  const shadow = useRef();
  const state = useRef({ c: 0, spin: 0 });

  useFrame((_, dt) => {
    const target = reduced ? 0 : progressRef.current * LAST;
    const s = state.current;
    s.c += (target - s.c) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
    const c = s.c;
    const time = performance.now() / 1000;

    for (const name of LAYERS) {
      const o = refs[name].current;
      if (!o) continue;
      const k = sample(name, c);
      o.position.set(k.pos[0], k.pos[1], k.pos[2]);
      o.rotation.set(k.rot[0], k.rot[1], k.rot[2]);
      o.scale.setScalar(k.scale);
    }

    // Jelly wobbles while it has the stage.
    const jellyStage = Math.max(0, 1 - Math.abs(c - 4));
    if (refs.jelly.current && !reduced) {
      refs.jelly.current.scale.y *= 1 + Math.sin(time * 5) * 0.06 * jellyStage;
      refs.jelly.current.rotation.z += Math.sin(time * 2.2) * 0.04 * jellyStage;
    }

    // The jump: in the last chapter the closed sandwich hops once and lands with a squash.
    const jt = clamp01((c - 4.55) / 0.4);
    const hop = Math.sin(jt * Math.PI);
    const land = jt > 0.85 ? Math.sin(((jt - 0.85) / 0.15) * Math.PI) : 0;

    const g = group.current;
    if (g) {
      const assembled = Math.max(clamp01(1 - c), clamp01(c - 4));
      // Spin slowly only while the sandwich is whole; wrap the angle so un-spinning takes at most half a turn.
      if (!reduced) s.spin += dt * 0.3 * assembled;
      const wrapped = Math.atan2(Math.sin(s.spin), Math.cos(s.spin));
      g.rotation.y = 0.55 * assembled + wrapped * assembled + 0.15 * (1 - assembled);
      g.rotation.x = 0.24 * assembled + 0.1;
      g.position.set(layout.x, layout.y + hop * 1.1 + (reduced ? 0 : Math.sin(time * 1.4) * 0.05 * assembled), 0);
      g.scale.set(layout.s * (1 + land * 0.06), layout.s * (1 - land * 0.1), layout.s * (1 + land * 0.06));
    }
    if (shadow.current) {
      shadow.current.position.set(layout.x, layout.y - 1.35 * layout.s, 0);
      const spread = 1 - hop * 0.45;
      shadow.current.scale.setScalar(layout.s * 3.6 * spread);
      shadow.current.material.opacity = 0.55 * spread * Math.max(clamp01(1 - c), clamp01(c - 4), 0.35);
    }
  });

  return (
    <>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
      <group ref={group}>
        <mesh ref={refs.bottom} geometry={parts.bread.bottom} material={parts.bread.materials} castShadow receiveShadow />
        <mesh ref={refs.butter} geometry={parts.butter.geo} material={parts.butter.material} castShadow receiveShadow />
        <group ref={refs.jelly}>
          <mesh geometry={parts.jelly.geo} material={parts.jelly.material} castShadow receiveShadow />
        </group>
        <mesh ref={refs.top} geometry={parts.bread.top} material={parts.bread.materials} castShadow receiveShadow />
      </group>
    </>
  );
}

// Compact: the sandwich fills its own small box (phones), centred and sized to the box's aspect.
function useLayout(compact) {
  const { size } = useThree();
  if (compact) return { x: 0, y: 0.25, s: Math.min(1.45, (size.width / size.height) * 1.2) };
  // Story: sit right of the copy; on narrower landscape screens, shrink and move further right to clear it.
  const k = Math.min(1, size.width / size.height / 1.6);
  return { x: 1.35 + (1 - k) * 0.7, y: -0.15, s: 0.95 * Math.max(0.72, k * k) };
}

function Scene({ compact, ...props }) {
  const layout = useLayout(compact);
  return (
    <>
      <Environment />
      <hemisphereLight args={['#eaf6ff', '#b47634', 0.55]} />
      <directionalLight
        position={[-3.5, 6, 4.5]}
        intensity={2.4}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[4, 2, -4]} intensity={1.1} color="#9ad8f2" />
      <pointLight position={[2.5, -1, 3]} intensity={6} distance={10} color="#ffd9b0" />
      <Sandwich {...props} layout={layout} />
    </>
  );
}

// `compact` renders the whole sandwich, slowly turning, in its own box instead of the scroll story.
// `active={false}` stops rendering frames (e.g. while the box is scrolled off-screen).
export default function Stage({ progressRef, reduced, compact = false, active = true, className = 'stage-canvas' }) {
  const lite = typeof window !== 'undefined' && (compact || window.matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4);
  return (
    <Canvas
      className={className}
      frameloop={active ? 'always' : 'never'}
      shadows
      dpr={[1, lite ? 1.5 : 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ position: [0, 1.4, 7.2], fov: 35, near: 0.1, far: 50 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}
      aria-hidden="true"
    >
      <Scene progressRef={progressRef} reduced={reduced} lite={lite} compact={compact} />
    </Canvas>
  );
}
