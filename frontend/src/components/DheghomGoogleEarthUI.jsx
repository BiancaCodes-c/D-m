import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
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

const MODES = ['Climate', 'Atmosphere', 'Oceanics', 'Pulse'];

const MODE_CONFIG = {
  Climate: {
    position: new THREE.Vector3(0.8, 1.2, 6.6),
    target: new THREE.Vector3(0.2, 0.3, 0),
    subtitle: 'Regional heat and air chemistry map',
  },
  Atmosphere: {
    position: new THREE.Vector3(0, 0.5, 8.2),
    target: new THREE.Vector3(0, 0.1, 0),
    subtitle: '3D gases and cloud envelope',
  },
  Oceanics: {
    position: new THREE.Vector3(-1.6, -0.5, 6.4),
    target: new THREE.Vector3(-0.3, -0.4, 0),
    subtitle: 'Current, sea temp, and ocean stress',
  },
  Pulse: {
    position: new THREE.Vector3(0.2, 2.4, 6.8),
    target: new THREE.Vector3(0, 1.2, 0),
    subtitle: 'Schumann resonance and aurora field',
  },
};

const MODE_METRICS = {
  Climate: [
    ['PM2.5', '9 ug/m3'],
    ['NO2', '16 ppb'],
    ['O3', '31 ppb'],
    ['Heat Index', '79F'],
  ],
  Atmosphere: [
    ['Humidity', '68%'],
    ['Pressure', '1008'],
    ['Wind Shear', '13kt'],
    ['Cloud Base', '1.3km'],
  ],
  Oceanics: [
    ['Sea Temp', '19C'],
    ['Wave H', '1.2m'],
    ['Current', '0.8kt'],
    ['Salinity', '34.7 PSU'],
  ],
  Pulse: [
    ['Schumann', '7.83 Hz'],
    ['Aurora Kp', '3.1'],
    ['Geomag', 'Quiet'],
    ['Ion Flux', 'Moderate'],
  ],
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

function formatMetric(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(Number.isInteger(value) ? 0 : 1)}${suffix}`;
}

function buildModeMetrics(snapshot, mode) {
  const weather = snapshot?.weather?.current ?? {};
  const air = snapshot?.air_quality ?? {};
  const water = snapshot?.water ?? {};

  if (mode === 'Climate') {
    const airStatus = air.status === 'ok' ? 'Live' : air.status === 'empty' ? 'No stations' : 'OpenAQ auth needed';
    return [
      ['PM2.5', `${formatMetric(air.pm25, ' ug/m3')}`],
      ['NO2', `${formatMetric(air.no2, ' ppb')}`],
      ['O3', `${formatMetric(air.o3, ' ppb')}`],
      ['Heat Index', `${formatMetric(weather.apparent_temperature_c ?? weather.apparent_temperature, 'F')}`],
      ['Air Status', airStatus],
    ];
  }

  if (mode === 'Atmosphere') {
    return [
      ['Humidity', `${formatMetric(weather.humidity_pct ?? weather.relative_humidity_2m, '%')}`],
      ['Pressure', `${formatMetric(weather.pressure_msl_hpa ?? weather.pressure_msl, '')}`],
      ['Wind', `${formatMetric(weather.wind_speed_10m_kmh ?? weather.wind_speed_10m, ' km/h')}`],
      ['Cloud Base', `${formatMetric(weather.cloud_cover_pct ?? weather.cloud_cover, '%')}`],
    ];
  }

  if (mode === 'Oceanics') {
    return [
      ['Sea Temp', `${formatMetric(water.water_temp_c, 'C')}`],
      ['Wave H', '1.2m'],
      ['Current', '0.8kt'],
      ['Salinity', '34.7 PSU'],
    ];
  }

  return [
    ['Schumann', '7.83 Hz'],
    ['Aurora Kp', '3.1'],
    ['Geomag', 'Quiet'],
    ['Ion Flux', 'Moderate'],
  ];
}

function getModeSubtitle(snapshot, mode) {
  const weather = snapshot?.weather?.current ?? {};
  const water = snapshot?.water ?? {};

  if (mode === 'Climate') {
    const airStatus = snapshot?.air_quality?.status === 'ok' ? 'live air data' : 'OpenAQ authorization required';
    return `Air mix: PM2.5 ${formatMetric(snapshot?.air_quality?.pm25, ' ug/m3')} | Wind ${formatMetric(weather.wind_speed_10m_kmh ?? weather.wind_speed_10m, ' km/h')} | ${airStatus}`;
  }

  if (mode === 'Atmosphere') {
    return `Humidity ${formatMetric(weather.humidity_pct ?? weather.relative_humidity_2m, '%')} | Pressure ${formatMetric(weather.pressure_msl_hpa ?? weather.pressure_msl, '')}`;
  }

  if (mode === 'Oceanics') {
    return `Water temp ${formatMetric(water.water_temp_c, 'C')} at station ${water.station_id ?? 'n/a'}`;
  }

  return 'Schumann resonance bands with aurora pulse visualization';
}

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

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

function Earth({ mode }) {
  const earthRef = useRef(null);
  const cloudsRef = useRef(null);

  const [dayMap, normalMap, specularMap, cloudMap] = useLoader(THREE.TextureLoader, [
    '/textures/earth_day.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.png',
  ]);

  dayMap.colorSpace = THREE.SRGBColorSpace;

  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.0015;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += 0.0018;
    }
  });

  const glowOpacity = mode === 'Atmosphere' ? 0.2 : 0.12;

  return (
    <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[2.2, 128, 128]} />
        <meshPhongMaterial
          map={dayMap}
          normalMap={normalMap}
          specularMap={specularMap}
          specular={new THREE.Color('#6ec6ff')}
          shininess={16}
          emissive="#0b1f32"
          emissiveIntensity={0.18}
        />
      </mesh>

      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.24, 96, 96]} />
        <meshPhongMaterial
          map={cloudMap}
          transparent
          opacity={0.34}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[0.4, 0.5, 0]}>
        <torusGeometry args={[3.2, 0.02, 16, 200]} />
        <meshStandardMaterial color="#ffffff" emissive="#67e8f9" emissiveIntensity={4} />
      </mesh>

      <Sphere args={[2.55, 64, 64]}>
        <MeshDistortMaterial color="#67e8f9" transparent opacity={glowOpacity} distort={0.35} speed={2} />
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

function CameraDirector({ mode, controlsRef }) {
  const { camera } = useThree();

  useFrame(() => {
    const cfg = MODE_CONFIG[mode];
    camera.position.lerp(cfg.position, 0.03);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(cfg.target, 0.04);
      controlsRef.current.update();
    }
  });

  return null;
}

function AtmosphereLayer({ active }) {
  if (!active) return null;

  return (
    <>
      <Sphere args={[2.85, 64, 64]}>
        <MeshDistortMaterial color="#8be9ff" transparent opacity={0.18} distort={0.2} speed={1.3} />
      </Sphere>
      <Sphere args={[3.1, 40, 40]}>
        <MeshDistortMaterial color="#c7fdff" transparent opacity={0.08} distort={0.35} speed={1.8} />
      </Sphere>
    </>
  );
}

function ClimateHeatLayer({ active, snapshot }) {
  const air = snapshot?.air_quality ?? {};
  const severity = Math.min(
    1,
    ((Number(air.pm25) || 0) / 35) + ((Number(air.no2) || 0) / 80) + ((Number(air.o3) || 0) / 70)
  );

  const heatPoints = useMemo(() => {
    const points = [];
    const totalPoints = Math.round(140 + severity * 220);
    for (let i = 0; i < totalPoints; i++) {
      const lat = (Math.random() - 0.5) * 140;
      const lon = (Math.random() - 0.5) * 360;
      const intensity = Math.random();
      const hotspot = Math.min(1, severity + intensity * 0.5);
      points.push({
        position: latLonToVector3(lat, lon, 2.3),
        color: new THREE.Color().setHSL((1 - hotspot) * 0.38, 0.95, 0.45 + hotspot * 0.2),
        scale: 0.015 + hotspot * 0.05,
      });
    }
    return points;
  }, [severity]);

  if (!active) return null;

  return (
    <group>
      {heatPoints.map((point, index) => (
        <mesh key={`heat-${index}`} position={point.position}>
          <sphereGeometry args={[point.scale, 8, 8]} />
          <meshBasicMaterial color={point.color} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function OceanicsLayer({ active }) {
  const groupRef = useRef(null);
  const streamsRef = useRef(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
    if (streamsRef.current) {
      streamsRef.current.rotation.y = -state.clock.elapsedTime * 0.16;
    }
  });

  if (!active) return null;

  return (
    <>
      <group ref={groupRef}>
        <mesh rotation={[Math.PI / 2.1, 0, 0]}>
          <torusGeometry args={[2.45, 0.03, 12, 240]} />
          <meshBasicMaterial color="#57d7ff" transparent opacity={0.36} />
        </mesh>
        <mesh rotation={[Math.PI / 2.35, 0.5, 0]}>
          <torusGeometry args={[2.6, 0.022, 12, 220]} />
          <meshBasicMaterial color="#58b8ff" transparent opacity={0.28} />
        </mesh>
      </group>
      <group ref={streamsRef}>
        <mesh rotation={[0.35, 0, 0]}>
          <torusGeometry args={[2.36, 0.014, 10, 200]} />
          <meshBasicMaterial color="#88f1ff" transparent opacity={0.45} />
        </mesh>
      </group>
    </>
  );
}

function PulseLayer({ active }) {
  const ringARef = useRef(null);
  const ringBRef = useRef(null);
  const auroraRef = useRef(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringARef.current) {
      ringARef.current.scale.setScalar(1 + Math.sin(t * 1.8) * 0.06);
    }
    if (ringBRef.current) {
      ringBRef.current.scale.setScalar(1 + Math.sin(t * 2.4 + 1.4) * 0.08);
    }
    if (auroraRef.current) {
      auroraRef.current.rotation.y = t * 0.12;
    }
  });

  if (!active) return null;

  return (
    <>
      <group ref={ringARef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.3, 0.018, 12, 220]} />
          <meshBasicMaterial color="#7dffef" transparent opacity={0.8} />
        </mesh>
      </group>
      <group ref={ringBRef}>
        <mesh rotation={[Math.PI / 2, 0.6, 0.2]}>
          <torusGeometry args={[3.6, 0.012, 10, 220]} />
          <meshBasicMaterial color="#8dfda8" transparent opacity={0.65} />
        </mesh>
      </group>

      <group ref={auroraRef} position={[0, 2.2, 0]}>
        {[0, 0.7, 1.4, 2.1, 2.8].map((rot) => (
          <mesh key={rot} rotation={[0, rot, 0]}>
            <planeGeometry args={[0.42, 1.5]} />
            <meshBasicMaterial color="#74ffbb" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </>
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

function RainField({ snapshot }) {
  const rainRef = useRef(null);
  const rainStrength = Math.min(1, Number(snapshot?.weather?.current?.precipitation_mm ?? snapshot?.weather?.current?.rain_mm ?? 0) / 8);

  const rainGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = [];

    const dropCount = Math.round(3500 + rainStrength * 7000);
    for (let i = 0; i < dropCount; i++) {
      vertices.push((Math.random() - 0.5) * 60, Math.random() * 50, (Math.random() - 0.5) * 60);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geo;
  }, [rainStrength]);

  useFrame(() => {
    if (!rainRef.current) return;
    rainRef.current.rotation.y += 0.0005;
  });

  return (
    <points ref={rainRef} geometry={rainGeo}>
      <pointsMaterial color="#93c5fd" size={0.04 + rainStrength * 0.03} transparent opacity={0.35 + rainStrength * 0.45} />
    </points>
  );
}

export default function DheghomGoogleEarthUI() {
  const [activeMode, setActiveMode] = useState('Climate');
  const controlsRef = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' });

  useEffect(() => {
    let cancelled = false;

    async function loadLatest() {
      try {
        setLoadState({ status: 'loading', error: '' });
        const response = await fetch(`${API_BASE_URL}/latest`);
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled) {
          setSnapshot(data);
          setLoadState({ status: 'ready', error: '' });
        }
      } catch (error) {
        if (!cancelled) {
          setLoadState({ status: 'error', error: error.message || 'Failed to load live data' });
        }
      }
    }

    loadLatest();
    const interval = window.setInterval(loadLatest, 300000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const activeMetrics = buildModeMetrics(snapshot, activeMode);
  const activeSubtitle = snapshot ? getModeSubtitle(snapshot, activeMode) : MODE_CONFIG[activeMode].subtitle;

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
          {MODES.map((item) => (
            <button
              key={item}
              onClick={() => setActiveMode(item)}
              className={`px-5 py-2 rounded-full border backdrop-blur-xl text-cyan-100 text-sm tracking-widest transition ${
                activeMode === item
                  ? 'border-cyan-200/90 bg-cyan-200/20 shadow-[0_0_24px_rgba(34,211,238,0.45)]'
                  : 'border-cyan-400/30 bg-white/5'
              }`}
            >
              {item}
            </button>
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
          <h2 className="tracking-[0.3em] uppercase text-cyan-100 text-sm">{activeMode} Endpoint</h2>
        </div>

        <p className="text-cyan-100/70 text-[11px] uppercase tracking-[0.25em] mb-4">
          {loadState.status === 'ready' ? 'Live snapshot connected' : loadState.status === 'error' ? 'Offline fallback active' : 'Loading live snapshot'}
        </p>

        <div className="space-y-5">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Toxic Gas Spread</span>
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
              <span className="text-white/60">Good Gas Balance</span>
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
              <span className="text-white/60">Weather Activity</span>
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
          <h2 className="tracking-[0.3em] uppercase text-cyan-100 text-sm">{activeMode} Intelligence Grid</h2>
        </div>

        <p className="text-cyan-100/70 text-xs uppercase tracking-[0.25em] mb-4">{activeSubtitle}</p>

        <div className="grid grid-cols-2 gap-4">
          {activeMetrics.map(([label, value]) => (
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

          <div className="absolute inset-0 flex flex-col items-center justify-center text-cyan-100 tracking-[0.4em] uppercase text-sm">
            <span>{activeMode} Tracking</span>
            <span className="mt-3 text-[10px] tracking-[0.55em] text-cyan-100/70">
              {loadState.status === 'ready' ? 'Realtime snapshot' : 'Fallback visualization'}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="absolute inset-0 z-10">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <CameraDirector mode={activeMode} controlsRef={controlsRef} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 5, 5]} intensity={3} />
          <pointLight position={[-5, -5, -5]} intensity={2} color="#67e8f9" />

          <Stars radius={100} depth={50} count={5000} factor={4} fade />

          <FloatingParticles />
          <RainField snapshot={snapshot} />
          <Earth mode={activeMode} />
          <AtmosphereLayer active={activeMode === 'Atmosphere'} />
          <ClimateHeatLayer active={activeMode === 'Climate'} snapshot={snapshot} />
          <OceanicsLayer active={activeMode === 'Oceanics'} />
          <PulseLayer active={activeMode === 'Pulse'} />

          <OrbitControls ref={controlsRef} enableZoom autoRotate autoRotateSpeed={0.35} />
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
              onClick={() => setActiveMode('Atmosphere')}
              whileHover={{ scale: 1.05 }}
              className="px-8 py-4 rounded-full bg-cyan-300 text-black font-semibold shadow-[0_0_30px_rgba(103,232,249,0.5)]"
            >
              Open Atmosphere
            </motion.button>

            <motion.button
              onClick={() => setActiveMode('Pulse')}
              whileHover={{ scale: 1.05 }}
              className="px-8 py-4 rounded-full border border-cyan-300/40 text-cyan-100 backdrop-blur-xl"
            >
              Open Pulse
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
