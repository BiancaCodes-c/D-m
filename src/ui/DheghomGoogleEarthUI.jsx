import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Stars,
  Float,
  Sphere,
  MeshDistortMaterial,
  Html,
} from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { CloudRain, Globe2, Waves, Wind, Activity } from 'lucide-react';

function FingerprintCursor() {
  const [pos, setPos] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  });

  useEffect(() => {
    function onMove(e) {
      setPos({ x: e.clientX - 40, y: e.clientY - 40 });
    }

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <motion.div className="fixed z-50 pointer-events-none" animate={{ x: pos.x, y: pos.y }}>
      <div className="w-20 h-20 rounded-full border border-cyan-300/60 backdrop-blur-md bg-cyan-300/10 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.6)]">
        <div className="w-10 h-10 rounded-full border border-cyan-200 animate-pulse" />
      </div>
    </motion.div>
  );
}

function Earth() {
  const earthRef = useRef(null);

  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.0015;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[2.2, 128, 128]} />
        <meshStandardMaterial
          color="#87CEEB"
          emissive="#0ea5e9"
          emissiveIntensity={0.6}
          metalness={0.7}
          roughness={0.2}
          wireframe={false}
        />
      </mesh>

      <mesh rotation={[0.4, 0.5, 0]}>
        <torusGeometry args={[3.2, 0.02, 16, 200]} />
        <meshStandardMaterial color="#ffffff" emissive="#67e8f9" emissiveIntensity={4} />
      </mesh>

      <Sphere args={[2.55, 64, 64]}>
        <MeshDistortMaterial color="#67e8f9" transparent opacity={0.12} distort={0.35} speed={2} />
      </Sphere>

      <Html position={[0, -3.7, 0]} center>
        <div className="bg-black/40 border border-cyan-400/40 backdrop-blur-xl rounded-3xl px-6 py-4 text-center shadow-2xl shadow-cyan-500/20 min-w-[260px]">
          <h2 className="text-cyan-200 text-xl font-light tracking-[0.4em] uppercase">Wilmington</h2>
          <p className="text-white/70 mt-2 text-sm tracking-widest">Delaware, USA</p>
          <div className="grid grid-cols-3 gap-4 mt-5 text-xs text-cyan-100">
            <div>
              <CloudRain className="mx-auto mb-2" size={18} />
              <p>Rain</p>
              <p className="text-white">72%</p>
            </div>
            <div>
              <Wind className="mx-auto mb-2" size={18} />
              <p>Wind</p>
              <p className="text-white">12mph</p>
            </div>
            <div>
              <Waves className="mx-auto mb-2" size={18} />
              <p>Ocean</p>
              <p className="text-white">19°C</p>
            </div>
          </div>
        </div>
      </Html>
    </Float>
  );
}

function FloatingParticles() {
  const particles = useMemo(() => {
    const temp = [];

    for (let i = 0; i < 200; i++) {
      temp.push({
        position: [
          (Math.random() - 0.5) * 25,
          (Math.random() - 0.5) * 25,
          (Math.random() - 0.5) * 25,
        ],
      });
    }

    return temp;
  }, []);

  return (
    <>
      {particles.map((particle, index) => (
        <mesh key={index} position={particle.position}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#67e8f9" />
        </mesh>
      ))}
    </>
  );
}

function RainField() {
  const rainRef = useRef(null);

  const rainGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = [];

    for (let i = 0; i < 10000; i++) {
      vertices.push((Math.random() - 0.5) * 60, Math.random() * 50, (Math.random() - 0.5) * 60);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geo;
  }, []);

  useFrame(() => {
    if (!rainRef.current) return;
    rainRef.current.rotation.y += 0.0005;
  });

  return (
    <points ref={rainRef} geometry={rainGeo}>
      <pointsMaterial color="#93c5fd" size={0.05} transparent opacity={0.8} />
    </points>
  );
}

export default function DheghomGoogleEarthUI() {
  return (
    <div className="h-screen w-full bg-[#020617] text-white overflow-hidden relative">
      <FingerprintCursor />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),transparent_60%)]" />

      <motion.div
        animate={{ x: [0, 120, 0] }}
        transition={{ duration: 40, repeat: Infinity }}
        className="absolute top-10 left-0 w-[600px] h-[300px] rounded-full bg-cyan-100/5 blur-3xl"
      />

      <motion.div
        animate={{ x: [0, -120, 0] }}
        transition={{ duration: 55, repeat: Infinity }}
        className="absolute bottom-10 right-0 w-[700px] h-[320px] rounded-full bg-blue-200/5 blur-3xl"
      />

      <div className="absolute z-20 top-0 left-0 w-full flex justify-between items-center px-10 py-6 backdrop-blur-sm">
        <div>
          <h1 className="text-4xl font-thin tracking-[0.5em] text-cyan-100 uppercase">Dheghom</h1>
          <p className="text-white/50 text-sm tracking-[0.3em] mt-2">Planetary Intelligence Interface</p>
        </div>

        <div className="flex gap-4">
          {['Climate', 'Atmosphere', 'Oceanics', 'Pulse'].map((item) => (
            <div
              key={item}
              className="px-5 py-2 rounded-full border border-cyan-400/30 bg-white/5 backdrop-blur-xl text-cyan-100 text-sm tracking-widest"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="absolute z-20 left-10 top-36 w-[320px] rounded-[2rem] border border-cyan-400/20 bg-white/5 backdrop-blur-2xl p-6 shadow-[0_0_50px_rgba(34,211,238,0.12)]"
      >
        <div className="flex items-center gap-3 mb-6">
          <Activity className="text-cyan-300" />
          <h2 className="tracking-[0.3em] uppercase text-cyan-100 text-sm">Earth Pulse</h2>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Atmosphere</span>
              <span className="text-cyan-200">Stable</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                animate={{ width: ['20%', '84%', '68%'] }}
                transition={{ duration: 8, repeat: Infinity }}
                className="h-full bg-cyan-300"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Oceanic Stress</span>
              <span className="text-cyan-200">Moderate</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                animate={{ width: ['50%', '70%', '42%'] }}
                transition={{ duration: 6, repeat: Infinity }}
                className="h-full bg-blue-300"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Air Quality</span>
              <span className="text-cyan-200">Good</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                animate={{ width: ['75%', '92%', '66%'] }}
                transition={{ duration: 10, repeat: Infinity }}
                className="h-full bg-emerald-300"
              />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="absolute z-20 right-10 top-40 w-[360px] rounded-[2rem] border border-cyan-400/20 bg-white/5 backdrop-blur-2xl p-7 shadow-[0_0_50px_rgba(34,211,238,0.12)]"
      >
        <div className="flex items-center gap-3 mb-8">
          <Globe2 className="text-cyan-300" />
          <h2 className="tracking-[0.3em] uppercase text-cyan-100 text-sm">Neural Climate Grid</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            ['Temp', '22°C'],
            ['Humidity', '68%'],
            ['Pressure', '1008'],
            ['Visibility', '14km'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-black/20 border border-white/10 p-5">
              <p className="text-white/50 text-xs tracking-widest uppercase">{label}</p>
              <h3 className="text-2xl text-cyan-100 mt-3 font-light">{value}</h3>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl overflow-hidden border border-cyan-400/20 h-[160px] bg-gradient-to-br from-cyan-500/10 to-transparent relative">
          <motion.div
            animate={{ y: [0, 20, 0] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.15),transparent_60%)]"
          />

          <div className="absolute inset-0 flex items-center justify-center text-cyan-100 tracking-[0.4em] uppercase text-sm">
            Live Weather Tracking
          </div>
        </div>
      </motion.div>

      <div className="absolute inset-0 z-10">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 5, 5]} intensity={3} />
          <pointLight position={[-5, -5, -5]} intensity={2} color="#67e8f9" />

          <Stars radius={100} depth={50} count={5000} factor={4} fade />

          <FloatingParticles />
          <RainField />
          <Earth />

          <OrbitControls enableZoom autoRotate autoRotateSpeed={0.35} />
        </Canvas>
      </div>

      <div className="absolute bottom-0 left-0 w-full z-20 px-10 pb-8">
        <div className="rounded-[2rem] border border-cyan-400/20 bg-black/30 backdrop-blur-2xl p-6 flex justify-between items-center shadow-[0_0_50px_rgba(34,211,238,0.1)]">
          <div>
            <p className="text-cyan-100 tracking-[0.3em] uppercase text-xs">Dheghom Neural Weather Engine</p>
            <h2 className="text-3xl font-thin mt-3">Planetary Climate Visualization System</h2>
          </div>

          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="px-8 py-4 rounded-full bg-cyan-300 text-black font-semibold shadow-[0_0_30px_rgba(103,232,249,0.5)]"
            >
              Launch Earth
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              className="px-8 py-4 rounded-full border border-cyan-300/40 text-cyan-100 backdrop-blur-xl"
            >
              Open Climate Grid
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
