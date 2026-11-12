import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useStore } from '@nanostores/react';
import * as THREE from 'three';
import { $channel, $weather } from '../../stores/signal';
import type { ChannelId } from '../../data/profile';
import type { WeatherMood } from '../../lib/weather';

/* ---------- Paleta ---------- */

const CHANNEL_TINT: Record<ChannelId, { primary: string; secondary: string }> = {
  0: { primary: '#d946ef', secondary: '#8b5cf6' },
  1: { primary: '#f0abfc', secondary: '#d946ef' },
  2: { primary: '#a78bfa', secondary: '#22d3ee' },
  3: { primary: '#22d3ee', secondary: '#8b5cf6' },
};

const WEATHER_TINT: Record<WeatherMood, string> = {
  clear: '#8b5cf6',
  cloud: '#6366f1',
  fog: '#94a3b8',
  rain: '#38bdf8',
  snow: '#e0e7ff',
  storm: '#fb7185',
};

const WEATHER_SPEED: Record<WeatherMood, number> = {
  clear: 1,
  cloud: 0.8,
  fog: 0.45,
  rain: 1.55,
  snow: 0.3,
  storm: 2.6,
};

/* ---------- Geometría de partículas ---------- */

interface RingData {
  positions: Float32Array;
  colors: Float32Array;
}

function buildRing(count: number, radius: number, spread: number, from: THREE.Color, to: THREE.Color): RingData {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.12;
    const r = radius + (Math.random() - 0.5) * 0.55;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * spread;
    const color = from.clone().lerp(to, Math.random());
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return { positions, colors };
}

/* ---------- Escena ---------- */

function SceneContent() {
  const channel = useStore($channel);
  const weather = useStore($weather);
  const isMobile = useThree((state) => state.size.width < 768);

  const groupRef = useRef<THREE.Group>(null);
  const ringARef = useRef<THREE.Group>(null);
  const ringBRef = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isMobile || reducedMotion) return;
    const onPointerMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [isMobile, reducedMotion]);

  const mood = weather?.mood ?? 'clear';
  const tint = CHANNEL_TINT[channel];
  const primary = tint.primary;
  const secondary = WEATHER_TINT[mood];
  const speed = WEATHER_SPEED[mood];

  const particles = useMemo(() => {
    const from = new THREE.Color(primary);
    const to = new THREE.Color(secondary);
    return {
      outer: buildRing(isMobile ? 46 : 140, 3.15, 0.7, from, to),
      inner: buildRing(isMobile ? 24 : 76, 1.85, 0.35, to, from),
    };
  }, [isMobile, primary, secondary]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const t = performance.now() / 1000;

    if (groupRef.current) {
      if (!reducedMotion) {
        groupRef.current.rotation.y += d * 0.16 * speed;
        groupRef.current.rotation.x = THREE.MathUtils.lerp(
          groupRef.current.rotation.x,
          pointer.current.y * 0.22 + (isMobile ? 0 : Math.sin(t * 0.35) * 0.05),
          0.04,
        );
        groupRef.current.rotation.z = THREE.MathUtils.lerp(
          groupRef.current.rotation.z,
          pointer.current.x * 0.24,
          0.04,
        );
      }
    }

    if (ringARef.current && !reducedMotion) {
      ringARef.current.rotation.y = t * 0.055 * speed;
      ringARef.current.rotation.x = Math.sin(t * 0.14) * 0.09;
    }

    if (ringBRef.current && !reducedMotion) {
      ringBRef.current.rotation.y = t * -0.08 * speed;
      ringBRef.current.rotation.x = Math.sin(t * 0.19 + 1) * 0.12;
    }
  });

  const shape = useMemo(() => {
    switch (channel) {
      case 1:
        return <icosahedronGeometry args={[2.15, isMobile ? 0 : 1]} />;
      case 2:
        return <torusGeometry args={[2.05, 0.52, isMobile ? 8 : 14, isMobile ? 48 : 96]} />;
      case 3:
        return <octahedronGeometry args={[2.35, 1]} />;
      default:
        return (
          <torusKnotGeometry
            args={[1.8, 0.48, isMobile ? 72 : 160, isMobile ? 8 : 16]}
          />
        );
    }
  }, [channel, isMobile]);

  return (
    <group ref={groupRef} scale={isMobile ? 0.78 : 1}>
      <mesh key={`shape-${channel}`} rotation={[0.35, 0, 0.2]}>
        {shape}
        <meshBasicMaterial
          wireframe
          color={primary}
          transparent
          opacity={isMobile ? 0.16 : 0.22}
          depthWrite={false}
        />
      </mesh>

      <mesh scale={0.58} rotation={[-0.4, 0.8, 0]}>
        {shape}
        <meshBasicMaterial
          wireframe
          color={secondary}
          transparent
          opacity={isMobile ? 0.08 : 0.11}
          depthWrite={false}
        />
      </mesh>

      <group ref={ringARef} rotation={[0.5, 0, 0]}>
        <points key={`outer-${channel}-${mood}-${isMobile}`}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[particles.outer.positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[particles.outer.colors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={isMobile ? 0.035 : 0.055}
            vertexColors
            transparent
            opacity={isMobile ? 0.35 : 0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      </group>

      <group ref={ringBRef} rotation={[-0.35, 0.4, 0]}>
        <points key={`inner-${channel}-${mood}-${isMobile}`}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[particles.inner.positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[particles.inner.colors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={isMobile ? 0.025 : 0.04}
            vertexColors
            transparent
            opacity={isMobile ? 0.28 : 0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      </group>
    </group>
  );
}

/* ---------- Fallback / límites ---------- */

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SceneFallback() {
  return (
    <div className="signal-scene__fallback">
      <span />
      <span />
      <span />
    </div>
  );
}

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    if (window.WebGL2RenderingContext && canvas.getContext('webgl2')) return true;
    return Boolean(canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/* ---------- Isla ---------- */

export default function SignalScene() {
  const [mode, setMode] = useState<'checking' | 'webgl' | 'fallback'>('checking');
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setMode(canUseWebGL() ? 'webgl' : 'fallback');

    const media = window.matchMedia('(max-width: 768px), (pointer: coarse)');
    const syncMobile = () => setIsMobile(media.matches);
    syncMobile();
    media.addEventListener('change', syncMobile);

    const syncVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', syncVisibility);

    return () => {
      media.removeEventListener('change', syncMobile);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  return (
    <div className="signal-scene" aria-hidden="true">
      {mode === 'webgl' && (
        <SceneBoundary fallback={<SceneFallback />}>
          <Canvas
            camera={{ position: [0, 0, 9], fov: 45 }}
            dpr={isMobile ? [1, 1] : [1, 1.75]}
            gl={{ alpha: true, antialias: !isMobile, powerPreference: 'high-performance' }}
            frameloop={isVisible ? 'always' : 'never'}
            style={{ background: 'transparent' }}
          >
            <SceneContent />
          </Canvas>
        </SceneBoundary>
      )}
      {mode === 'fallback' && <SceneFallback />}
    </div>
  );
}
