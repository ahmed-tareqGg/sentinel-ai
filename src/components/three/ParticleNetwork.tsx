import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTheme } from '@/hooks/useTheme';

// ─── Particles ───────────────────────────────────────────────────────────────
function Particles({ count = 120, isDark }: { count?: number; isDark: boolean }) {
  const mesh = useRef<THREE.Points>(null!);
  const mouse = useRef({ x: 0, y: 0 });
  const { size } = useThree();

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      spd[i] = 0.002 + Math.random() * 0.003;
    }
    return [pos, spd];
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  const material = useMemo(() => new THREE.PointsMaterial({
    size: 0.06,
    color: isDark ? '#3b82f6' : '#1d4ed8',
    transparent: true,
    opacity: isDark ? 0.75 : 0.55,
    sizeAttenuation: true,
  }), [isDark]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    const pos = mesh.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += Math.sin(t * speeds[i] + i) * 0.002;
      pos[i * 3 + 0] += Math.cos(t * speeds[i] * 0.7 + i) * 0.001;
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
    mesh.current.rotation.y = t * 0.012 + mouse.current.x * 0.05;
    mesh.current.rotation.x = mouse.current.y * 0.03;
  });

  return <points ref={mesh} geometry={geometry} material={material} />;
}

// ─── Floating Grid ────────────────────────────────────────────────────────────
function HexGrid({ isDark }: { isDark: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);

  const rings = useMemo(() => {
    const items: { pos: [number, number, number]; scale: number; speed: number; phase: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 4 + Math.random() * 4;
      items.push({
        pos: [Math.cos(angle) * r, (Math.random() - 0.5) * 3, (Math.sin(angle) * r) * 0.4],
        scale: 0.4 + Math.random() * 0.5,
        speed: 0.3 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return items;
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.z = t * 0.015;
    groupRef.current.children.forEach((child, i) => {
      const r = rings[i];
      child.position.y = r.pos[1] + Math.sin(t * r.speed + r.phase) * 0.3;
      (child as THREE.Mesh).rotation.z = t * r.speed * 0.5;
    });
  });

  return (
    <group ref={groupRef}>
      {rings.map((r, i) => (
        <mesh key={i} position={r.pos} scale={r.scale}>
          <torusGeometry args={[1, 0.02, 6, 6]} />
          <meshBasicMaterial
            color={isDark ? (i % 2 === 0 ? '#3b82f6' : '#06b6d4') : (i % 2 === 0 ? '#2563eb' : '#0891b2')}
            transparent
            opacity={isDark ? 0.18 : 0.12}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Data Streams ─────────────────────────────────────────────────────────────
function DataStreams({ isDark }: { isDark: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);

  const streams = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => ({
      x: -8 + i * 4,
      speed: 0.8 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      height: 3 + Math.random() * 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    groupRef.current?.children.forEach((child, i) => {
      const s = streams[i];
      child.position.y = Math.sin(t * s.speed + s.phase) * s.height;
      child.scale.y = 0.5 + Math.abs(Math.sin(t * s.speed * 0.5 + s.phase)) * 1.5;
    });
  });

  return (
    <group ref={groupRef}>
      {streams.map((s, i) => (
        <mesh key={i} position={[s.x, 0, -3]}>
          <cylinderGeometry args={[0.008, 0.008, 2, 4]} />
          <meshBasicMaterial
            color={isDark ? '#22d3ee' : '#0e7490'}
            transparent
            opacity={isDark ? 0.3 : 0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Glowing Core ─────────────────────────────────────────────────────────────
function GlowCore({ isDark }: { isDark: boolean }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const innerMesh = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (mesh.current) {
      mesh.current.rotation.y = t * 0.2;
      mesh.current.rotation.x = t * 0.1;
      mesh.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.04);
    }
    if (innerMesh.current) {
      innerMesh.current.rotation.y = -t * 0.4;
      innerMesh.current.rotation.z = t * 0.15;
    }
  });

  return (
    <group position={[0, 0, -2]}>
      {/* Outer glow shell */}
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshBasicMaterial
          color={isDark ? '#3b82f6' : '#2563eb'}
          wireframe
          transparent
          opacity={isDark ? 0.06 : 0.04}
        />
      </mesh>
      {/* Inner core */}
      <mesh ref={innerMesh}>
        <icosahedronGeometry args={[0.6, 0]} />
        <meshBasicMaterial
          color={isDark ? '#06b6d4' : '#0891b2'}
          wireframe
          transparent
          opacity={isDark ? 0.12 : 0.08}
        />
      </mesh>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ isDark }: { isDark: boolean }) {
  return (
    <>
      <GlowCore isDark={isDark} />
      <Particles count={100} isDark={isDark} />
      <HexGrid isDark={isDark} />
      <DataStreams isDark={isDark} />
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function ParticleNetwork() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 55 }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      >
        <Scene isDark={isDark} />
      </Canvas>
    </div>
  );
}
