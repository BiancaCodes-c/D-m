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
import { CloudRain, Globe2, Waves, Wind } from 'lucide-react';

const MODES = ['Climate', 'Atmosphere', 'Oceanics', 'Pulse'];

const VIEW_EXTENSIONS = ['Map View', 'Data Grid', 'Combined', 'Heat Map'];

const MODE_LABELS = {
  Climate: 'Climate',
  Atmosphere: 'Atmosphere',
  Oceanics: 'Ocean',
  Pulse: 'Aurora',
};

const MODE_CONFIG = {
  Climate: {
    position: new THREE.Vector3(0.45, 0.7, 6.05),
    target: new THREE.Vector3(0.08, 0.08, 0),
    subtitle: 'Regional heat and air chemistry map',
  },
  Atmosphere: {
    position: new THREE.Vector3(-0.25, 0.55, 6.35),
    target: new THREE.Vector3(0, 0.06, 0),
    subtitle: '3D gases and cloud envelope',
  },
  Oceanics: {
    position: new THREE.Vector3(-0.95, -0.25, 6.1),
    target: new THREE.Vector3(-0.12, -0.08, 0),
    subtitle: 'Current, sea temp, and ocean stress',
  },
  Pulse: {
    position: new THREE.Vector3(0.15, 1.25, 6.2),
    target: new THREE.Vector3(0, 0.28, 0),
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
    ['Aurora', 'Loading'],
    ['Geomag', 'Quiet'],
    ['Ion Flux', 'Moderate'],
  ],
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

function vectorFromArray(value, fallback) {
  if (!Array.isArray(value) || value.length !== 3) return fallback;
  return new THREE.Vector3(value[0], value[1], value[2]);
}

const WORLD_LABELS = {
  Climate: { city: 'Wilmington', state: 'Delaware', caption: 'Air chemistry over your local grid' },
  Atmosphere: { city: 'Wilmington', state: 'Delaware', caption: 'Atmospheric shell and cloud envelope' },
  Oceanics: { city: 'Wilmington', state: 'Delaware', caption: 'Coastal water layer and shoreline signal' },
  Pulse: { city: 'Wilmington', state: 'Delaware', caption: 'Schumann resonance and auroral pulse' },
};

const ENDPOINT_LOCATIONS = {
  Climate: { city: 'Wilmington', state: 'Delaware', lat: 39.7391, lon: -75.5398 },
  Atmosphere: { city: 'Miami', state: 'Florida', lat: 25.7617, lon: -80.1918 },
  Oceanics: { city: 'San Diego', state: 'California', lat: 32.7157, lon: -117.1611 },
  Pulse: { city: 'Anchorage', state: 'Alaska', lat: 61.2181, lon: -149.9003 },
};
const FEATURE_SECTIONS = [
  {
    mode: 'Climate',
    title: 'Climate Grid',
    summary: 'Live air chemistry, weather, and heat pressure over the local map.',
    api: 'Open-Meteo + OpenAQ',
    detail: 'Feeds PM2.5, NO2, O3, wind, and heat index into the climate panels.',
  },
  {
    mode: 'Atmosphere',
    title: 'Atmosphere Layer',
    summary: 'Cloud shell, humidity, pressure, and upper-air motion.',
    api: 'Open-Meteo',
    detail: 'Maps humidity, pressure, wind, and cloud cover into the sky view.',
  },
  {
    mode: 'Oceanics',
    title: 'Ocean Layer',
    summary: 'Water temperature and coastal state with the shoreline pulse.',
    api: 'NOAA CO-OPS',
    detail: 'Pulls water temperature and station metadata into the ocean card stack.',
  },
  {
    mode: 'Pulse',
    title: 'Aurora Layer',
    summary: 'NOAA SWPC aurora forecast and geomagnetic pulse over the globe.',
    api: 'NOAA SWPC + pulse model',
    detail: 'Combines aurora forecast points with the derived environmental pulse.',
  },
];

function formatMetric(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(Number.isInteger(value) ? 0 : 1)}${suffix}`;
}

function buildModeMetrics(snapshot, mode) {
  const weather = snapshot?.weather ?? snapshot?.weather?.current ?? {};
  const air = snapshot?.air_quality ?? {};
  const water = snapshot?.ocean ?? snapshot?.water ?? {};
  const aurora = snapshot?.aurora ?? {};

  if (mode === 'Climate') {
    const airStatus = air.status === 'ok' ? 'Live' : air.status === 'empty' ? 'No stations' : 'OpenAQ auth needed';
    return [
      ['PM2.5', `${formatMetric(air.pm25, ' ug/m3')}`],
      ['NO2', `${formatMetric(air.no2, ' ppb')}`],
      ['O3', `${formatMetric(air.o3, ' ppb')}`],
      ['Heat Index', `${formatMetric(weather.current?.apparent_temperature_c ?? weather.current?.apparent_temperature ?? weather.apparent_temperature, 'F')}`],
      ['Air Status', airStatus],
    ];
  }

  if (mode === 'Atmosphere') {
    return [
      ['Humidity', `${formatMetric(weather.current?.humidity_pct ?? weather.current?.relative_humidity_2m, '%')}`],
      ['Pressure', `${formatMetric(weather.current?.pressure_msl_hpa ?? weather.current?.pressure_msl, '')}`],
      ['Wind', `${formatMetric(weather.current?.wind_speed_10m_kmh ?? weather.current?.wind_speed_10m, ' km/h')}`],
      ['Cloud Base', `${formatMetric(weather.current?.cloud_cover_pct ?? weather.current?.cloud_cover, '%')}`],
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
    ['Aurora Max', `${formatMetric(aurora.max_probability, '%')}`],
    ['Forecast Points', formatMetric(aurora.point_count, '')],
    ['Ion Flux', 'Moderate'],
  ];
}

function getModeSubtitle(snapshot, mode) {
  const weather = snapshot?.weather ?? snapshot?.weather?.current ?? {};
  const water = snapshot?.ocean ?? snapshot?.water ?? {};

  if (mode === 'Climate') {
    const airStatus = snapshot?.air_quality?.status === 'ok' ? 'live air data' : 'OpenAQ authorization required';
    return `Air mix: PM2.5 ${formatMetric(snapshot?.air_quality?.pm25, ' ug/m3')} | Wind ${formatMetric(weather.current?.wind_speed_10m_kmh ?? weather.current?.wind_speed_10m, ' km/h')} | ${airStatus}`;
  }

  if (mode === 'Atmosphere') {
    return `Humidity ${formatMetric(weather.current?.humidity_pct ?? weather.current?.relative_humidity_2m, '%')} | Pressure ${formatMetric(weather.current?.pressure_msl_hpa ?? weather.current?.pressure_msl, '')}`;
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

function Earth({ mode, scale = 1.18, onFocusArea }) {
  const groupRef = useRef(null);
  const earthRef = useRef(null);
  const cloudsRef = useRef(null);

  const [dayMap, normalMap, specularMap, cloudMap] = useLoader(THREE.TextureLoader, [
    '/textures/earth_day.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.png',
  ]);

  dayMap.colorSpace = THREE.SRGBColorSpace;

  useFrame((stateFrame) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(stateFrame.clock.elapsedTime * 0.45) * 0.08;
    }
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.0022;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += 0.0028;
    }
  });

  const glowOpacity = mode === 'Atmosphere' ? 0.2 : 0.12;
  const modeTilt = {
    Climate: [0, 0.2, 0],
    Atmosphere: [0.22, 0.05, 0],
    Oceanics: [0.05, -0.15, 0],
    Pulse: [-0.2, 0.35, 0],
  }[mode];

  return (
    <Float speed={1.1} rotationIntensity={0.45} floatIntensity={0.8}>
      <group ref={groupRef} scale={scale}>
      <mesh
        ref={earthRef}
        rotation={modeTilt}
        onClick={(event) => {
          event.stopPropagation();
          onFocusArea?.(mode);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'zoom-in';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[2.38, 128, 128]} />
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

      <mesh ref={cloudsRef} rotation={modeTilt}>
        <sphereGeometry args={[2.44, 96, 96]} />
        <meshPhongMaterial
          map={cloudMap}
          transparent
          opacity={0.34}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[0.4 + modeTilt[0], 0.5 + modeTilt[1], 0]}>
        <torusGeometry args={[3.42, 0.02, 16, 200]} />
        <meshStandardMaterial color="#ffffff" emissive="#67e8f9" emissiveIntensity={4} />
      </mesh>

      <Sphere args={[2.75, 64, 64]}>
        <MeshDistortMaterial color="#67e8f9" transparent opacity={glowOpacity} distort={0.35} speed={2} />
      </Sphere>

      <Html position={[0, -3.7, 0]} center>
        <div className="bg-black/40 border border-cyan-400/40 backdrop-blur-xl rounded-3xl px-6 py-4 text-center shadow-2xl shadow-cyan-500/20 min-w-65">
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
      </group>
    </Float>
  );
}

function WorldGridLayer({ active, city, state, intensity = 1, onFocusArea }) {
  const gridRef = useRef(null);

  const cityPin = useMemo(() => latLonToVector3(39.7391, -75.5398, 2.38), []);

  useFrame((stateFrame) => {
    if (!gridRef.current) return;
    gridRef.current.rotation.y = stateFrame.clock.elapsedTime * 0.04;
  });

  if (!active) return null;

  return (
    <group ref={gridRef}>
      {[
        [2.36, [Math.PI / 2, 0, 0], '#a5f3fc'],
        [2.38, [0, 0, 0], '#67e8f9'],
        [2.4, [0, Math.PI / 2, 0], '#d9f99d'],
        [2.42, [Math.PI / 2, 0.7, 0], '#c7fdff'],
        [2.44, [Math.PI / 2, -0.7, 0], '#8dfda8'],
      ].map(([radius, rotation, color]) => (
        <mesh key={`${radius}-${rotation.join('-')}`} rotation={rotation}>
          <torusGeometry args={[radius, 0.006, 10, 240]} />
          <meshBasicMaterial color={color} transparent opacity={0.16 * intensity} />
        </mesh>
      ))}

      <mesh
        position={cityPin}
        onClick={(event) => {
          event.stopPropagation();
          onFocusArea?.('Climate');
        }}
      >
        <sphereGeometry args={[0.07, 18, 18]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85 * intensity} />
      </mesh>

      <mesh position={cityPin}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.24 * intensity} />
      </mesh>

      <Html position={cityPin.toArray()} center>
        <div className="pointer-events-none rounded-2xl border border-cyan-200/30 bg-black/55 backdrop-blur-md px-4 py-2 text-center shadow-[0_0_24px_rgba(103,232,249,0.22)]">
          <p className="text-cyan-100 text-xs tracking-[0.5em] uppercase">{city}</p>
          <p className="text-white/80 text-[10px] tracking-[0.45em] uppercase mt-1">{state}</p>
        </div>
      </Html>
    </group>
  );
}

function EndpointLinkLayer({ active, focusedMode, intensity = 1, onFocusArea }) {
  const linkGroupRef = useRef(null);

  useFrame((stateFrame) => {
    if (!linkGroupRef.current) return;
    linkGroupRef.current.rotation.y = stateFrame.clock.elapsedTime * 0.02;
  });

  if (!active) return null;

  return (
    <group ref={linkGroupRef}>
      {MODES.map((mode, index) => {
        const endpoint = ENDPOINT_LOCATIONS[mode];
        const pinPosition = latLonToVector3(endpoint.lat, endpoint.lon, 2.42);
        const isFocused = mode === focusedMode;
        const labelPosition = pinPosition.clone().multiplyScalar(1.1);

        return (
          <group key={mode}>
            <mesh
              position={pinPosition}
              onClick={(event) => {
                event.stopPropagation();
                onFocusArea?.(mode);
              }}
            >
              <sphereGeometry args={[isFocused ? 0.1 : 0.07, 18, 18]} />
              <meshBasicMaterial color={isFocused ? '#ffffff' : '#67e8f9'} transparent opacity={(isFocused ? 0.95 : 0.55) * intensity} />
            </mesh>

            <mesh position={pinPosition}>
              <sphereGeometry args={[isFocused ? 0.22 : 0.16, 20, 20]} />
              <meshBasicMaterial color="#67e8f9" transparent opacity={(isFocused ? 0.36 : 0.18) * intensity} />
            </mesh>

            <mesh position={pinPosition} rotation={[Math.PI / 2, 0.4 * index, 0]}>
              <torusGeometry args={[isFocused ? 0.26 : 0.2, 0.007, 10, 160]} />
              <meshBasicMaterial color="#c7fdff" transparent opacity={(isFocused ? 0.22 : 0.1) * intensity} />
            </mesh>

            <Html position={labelPosition.toArray()} center>
              <div className={`pointer-events-none rounded-2xl border backdrop-blur-md px-3 py-2 text-center shadow-[0_0_18px_rgba(103,232,249,0.16)] ${
                isFocused ? 'border-cyan-200/40 bg-black/60' : 'border-cyan-400/15 bg-black/35'
              }`}>
                <p className={`text-xs tracking-[0.45em] uppercase ${isFocused ? 'text-cyan-100' : 'text-cyan-100/75'}`}>
                  {endpoint.city}
                </p>
                <p className="text-[10px] tracking-[0.4em] uppercase mt-1 text-white/70">{endpoint.state}</p>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function CameraDirector({ mode, controlsRef, focusMode, mapViewConfig, activeView, zoomedArea }) {
  const { camera } = useThree();
  const glideRef = useRef({
    position: camera.position.clone(),
    target: new THREE.Vector3(),
  });

  const focusTarget = useMemo(() => {
    if (!focusMode) return null;
    const endpoint = ENDPOINT_LOCATIONS[focusMode];
    if (!endpoint) return null;

    const targetPoint = latLonToVector3(endpoint.lat, endpoint.lon, 2.38).multiplyScalar(zoomedArea ? 0.62 : 0.34);
    const cameraPoint = targetPoint.clone().normalize().multiplyScalar(zoomedArea ? 4.45 : 6.25);
    cameraPoint.y += zoomedArea ? 0.22 : 0.45;
    return { targetPoint, cameraPoint };
  }, [focusMode, zoomedArea]);

  useFrame((_, delta) => {
    const cfg = MODE_CONFIG[mode];
    const mapCamera = activeView === 'Map View' ? mapViewConfig?.camera : null;
    const mapPosition = vectorFromArray(mapCamera?.position, null);
    const mapTarget = vectorFromArray(mapCamera?.target, null);
    const nextCameraPosition = zoomedArea ? focusTarget?.cameraPoint ?? mapPosition ?? cfg.position : mapPosition ?? focusTarget?.cameraPoint ?? cfg.position;
    const nextTarget = zoomedArea ? focusTarget?.targetPoint ?? mapTarget ?? cfg.target : mapTarget ?? focusTarget?.targetPoint ?? cfg.target;
    const cameraEase = 1 - Math.exp(-delta * 1.65);
    const targetEase = 1 - Math.exp(-delta * 1.95);

    glideRef.current.position.lerp(nextCameraPosition, cameraEase);
    glideRef.current.target.lerp(nextTarget, targetEase);
    camera.position.copy(glideRef.current.position);
    if (controlsRef.current) {
      controlsRef.current.target.copy(glideRef.current.target);
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

function HeatSignatureLayer({ active, signatures = [], snapshot, onFocusArea }) {
  const groupRef = useRef(null);
  const fallbackHeat = useMemo(() => {
    if (signatures.length > 0) return [];

    const air = snapshot?.air_quality ?? {};
    const weather = snapshot?.weather?.current ?? {};
    const severity = Math.min(
      1,
      ((Number(air.pm25) || 0) / 35) + ((Number(air.no2) || 0) / 80) + ((Number(air.o3) || 0) / 70) + ((Number(weather.cloud_cover_pct ?? weather.cloud_cover) || 0) / 400)
    );
    const count = Math.max(18, Math.round(24 + severity * 26));

    return Array.from({ length: count }, (_, index) => {
      const orbit = index / count;
      const lat = 39.7391 + Math.sin(orbit * Math.PI * 4) * (1.8 + severity * 2.2);
      const lon = -75.5398 + Math.cos(orbit * Math.PI * 6) * (2.6 + severity * 3.4);
      const intensity = Math.min(1, severity * 0.6 + (index % 7) * 0.08);

      return {
        id: `fallback-${index}`,
        label: 'Heat',
        source: 'Open-Meteo + OpenAQ',
        value: Math.round(intensity * 100),
        unit: '%',
        intensity,
        color: intensity > 0.75 ? '#fb7185' : intensity > 0.45 ? '#f59e0b' : '#67e8f9',
        position: latLonToVector3(lat, lon, 2.32).toArray(),
        radius: 0.04 + intensity * 0.065,
      };
    });
  }, [signatures.length, snapshot]);
  const heatSignatures = signatures.length > 0 ? signatures : fallbackHeat;

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.06;
  });

  if (!active || heatSignatures.length === 0) return null;

  return (
    <group ref={groupRef}>
      {heatSignatures.map((signature, index) => {
        const position = Array.isArray(signature.position) ? signature.position : latLonToVector3(signature.lat ?? 39.7391, signature.lon ?? -75.5398, 2.32).toArray();
        const radius = Number(signature.radius) || 0.05;
        const intensity = Number(signature.intensity) || 0;
        return (
          <group key={signature.id ?? index} position={position}>
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onFocusArea?.(
                  signature.id === 'water_temp'
                    ? 'Oceanics'
                    : signature.id === 'aurora'
                      ? 'Pulse'
                      : signature.id === 'humidity' || signature.id === 'wind'
                        ? 'Atmosphere'
                        : 'Climate'
                );
              }}
            >
              <sphereGeometry args={[radius, 16, 16]} />
              <meshBasicMaterial color={signature.color ?? '#67e8f9'} transparent opacity={0.45 + intensity * 0.45} />
            </mesh>
            <mesh scale={[1, 1, 1 + intensity * 2.4]}>
              <sphereGeometry args={[radius * 1.9, 16, 16]} />
              <meshBasicMaterial color={signature.color ?? '#67e8f9'} transparent opacity={0.08 + intensity * 0.18} />
            </mesh>
          </group>
        );
      })}
    </group>
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

function AuroraBorealisLayer({ active, aurora }) {
  const groupRef = useRef(null);
  const points = aurora?.points ?? [];

  const auroraPoints = useMemo(() => {
    return points.slice(0, 260).map((point) => ({
      position: latLonToVector3(point.lat, point.lon, 2.96),
      probability: Number(point.probability) || 0,
    }));
  }, [points]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.28) * 0.18;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.04;
  });

  if (!active || auroraPoints.length === 0) return null;

  return (
    <group ref={groupRef}>
      {auroraPoints.map((point, index) => {
        const scale = 0.012 + Math.min(point.probability, 100) / 1400;
        const opacity = 0.28 + Math.min(point.probability, 100) / 180;
        return (
          <mesh key={`aurora-${index}`} position={point.position}>
            <sphereGeometry args={[scale, 8, 8]} />
            <meshBasicMaterial color={point.probability > 45 ? '#d9f99d' : '#74ffbb'} transparent opacity={Math.min(0.92, opacity)} />
          </mesh>
        );
      })}
    </group>
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
  const [activeView, setActiveView] = useState('Map View');
  const controlsRef = useRef(null);
  const [focusMode, setFocusMode] = useState('Climate');
  const [zoomedArea, setZoomedArea] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [mapViewConfig, setMapViewConfig] = useState(null);
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' });
  const isMapView = activeView === 'Map View';

  useEffect(() => {
    let cancelled = false;

    async function loadLatest() {
      try {
        setLoadState({ status: 'loading', error: '' });
        const endpoint = activeView === 'Combined'
          ? 'combined-feed'
          : activeView === 'Data Grid'
            ? 'data-grid'
            : activeView === 'Heat Map'
              ? 'map-heat'
              : 'feed';
        const response = await fetch(`${API_BASE_URL}/${endpoint}`);
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
    const interval = window.setInterval(loadLatest, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeView]);

  useEffect(() => {
    if (activeView === 'Data Grid' || activeView === 'Combined') {
      setFocusMode(activeMode);
    }
  }, [activeMode, activeView]);

  useEffect(() => {
    let cancelled = false;

    async function loadMapView() {
      try {
        const response = await fetch(`${API_BASE_URL}/map-view?mode=${encodeURIComponent(activeMode)}`);
        if (!response.ok) {
          throw new Error(`Map view returned ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled) {
          setMapViewConfig(data);
        }
      } catch {
        if (!cancelled) {
          setMapViewConfig(null);
        }
      }
    }

    loadMapView();

    return () => {
      cancelled = true;
    };
  }, [activeMode]);

  const activeMetrics = buildModeMetrics(snapshot, activeMode);
  const activeSubtitle = snapshot ? getModeSubtitle(snapshot, activeMode) : MODE_CONFIG[activeMode].subtitle;
  const worldLabel = {
    ...WORLD_LABELS[activeMode],
    city: snapshot?.city ?? WORLD_LABELS[activeMode].city,
    state: snapshot?.state ?? WORLD_LABELS[activeMode].state,
  };
  const liveWeather = snapshot?.weather?.current ?? {};
  const liveAir = snapshot?.air_quality ?? {};
  const liveOcean = snapshot?.ocean ?? {};
  const liveAurora = snapshot?.aurora ?? {};
  const mapLayerData = snapshot?.map_layers ?? {};
  const heatSignatures = mapLayerData.heat_signatures ?? [];
  const dataPanels = mapLayerData.panels ?? [];
  const gridExtensions = snapshot?.grid_extensions ?? [];
  const anomalyForecast = snapshot?.anomaly_forecast ?? {};
  const feedStatus = loadState.status === 'ready' ? 'Realtime feed connected' : loadState.status === 'error' ? 'Feed offline' : 'Connecting to feed';
  const earthVisible = !isMapView && (activeView !== 'Data Grid' || activeMode === 'Pulse');
  const gridVisible = !isMapView;
  const gridIntensity = activeView === 'Combined' ? 1 : activeView === 'Heat Map' ? 1.45 : 1.35;
  const showAllEndpoints = !isMapView;
  const earthScale = isMapView ? mapViewConfig?.earth?.scale ?? 1.22 : 1.18;
  const extensionLinks = mapViewConfig?.extensions ?? snapshot?.extensions ?? [];
  const showAuroraLayer = activeMode === 'Pulse' || activeView === 'Combined';
  const mapFocusActive = isMapView && Boolean(zoomedArea);
  const mapFrameUrl = `${API_BASE_URL}/folium-map`;
  const quickStats = [
    ['Weather', `${formatMetric(liveWeather.temperature_c, '°C')} / ${formatMetric(liveWeather.wind_speed_10m_kmh, ' km/h')}`],
    ['Air', `PM2.5 ${formatMetric(liveAir.pm25, ' ug/m3')}`],
    ['Ocean', `${formatMetric(liveOcean.water_temp_c, '°C')}`],
    ['Aurora', `${formatMetric(liveAurora.max_probability, '%')}`],
  ];
  const selectedPanel = dataPanels.find((panel) => {
    const modeToPanel = {
      Climate: 'air-quality',
      Atmosphere: 'atmosphere',
      Oceanics: 'ocean',
      Pulse: 'aurora',
    };
    return panel.id === modeToPanel[activeMode];
  });
  const renderedMetrics = selectedPanel?.metrics?.length
    ? selectedPanel.metrics.map((metric) => [
        metric.label,
        metric.unit ? `${formatMetric(metric.value, ` ${metric.unit}`)}` : `${metric.value ?? '—'}`,
      ])
    : activeMetrics;
  const gridPanels = activeView === 'Data Grid' ? dataPanels : [];
  const atmosphereTicker = [
    ['Humidity', formatMetric(liveWeather.humidity_pct, '%')],
    ['Pressure', formatMetric(liveWeather.pressure_msl_hpa, ' hPa')],
    ['Clouds', formatMetric(liveWeather.cloud_cover_pct, '%')],
    ['Wind', formatMetric(liveWeather.wind_speed_10m_kmh, ' km/h')],
    ['Gusts', formatMetric(liveWeather.wind_gusts_10m_kmh, ' km/h')],
    ['Direction', formatMetric(liveWeather.wind_direction_10m_deg, '°')],
  ];
  const heatMapSignals = [
    {
      id: 'weather',
      label: 'Weather',
      value: `${formatMetric(liveWeather.temperature_c, '°C')} / ${formatMetric(liveWeather.wind_speed_10m_kmh, ' km/h')}`,
      endpoint: '/atmosphere',
    },
    {
      id: 'pressure',
      label: 'Pressure',
      value: `${formatMetric(liveWeather.pressure_msl_hpa, ' hPa')}`,
      endpoint: '/atmosphere',
    },
    {
      id: 'clouds',
      label: 'Cloud Cover',
      value: `${formatMetric(liveWeather.cloud_cover_pct, '%')}`,
      endpoint: '/atmosphere',
    },
    {
      id: 'wind',
      label: 'Wind',
      value: `${formatMetric(liveWeather.wind_speed_10m_kmh, ' km/h')}`,
      endpoint: '/atmosphere',
    },
    {
      id: 'aurora',
      label: 'Aurora',
      value: `${formatMetric(liveAurora.max_probability, '%')}`,
      endpoint: '/aurora',
    },
    {
      id: 'heat',
      label: 'Heat Map',
      value: `${heatSignatures.length} nodes`,
      endpoint: '/map-heat',
    },
    {
      id: 'folium',
      label: 'Folium Map',
      value: 'Bootstrap view',
      endpoint: '/folium-map',
    },
  ];

  function focusEarth(mode) {
    setActiveMode(mode);
    setActiveView('Combined');
    setFocusMode(mode);
    setZoomedArea(mode);
  }

  function focusMapArea(mode = activeMode) {
    setActiveMode(mode);
    setActiveView('Combined');
    setFocusMode(mode);
    setZoomedArea(mode);
  }

  function openExtension(extension) {
    const extensionMode = {
      weather: 'Atmosphere',
      pressure: 'Atmosphere',
      clouds: 'Atmosphere',
      wind: 'Atmosphere',
      'air-quality': 'Climate',
      ocean: 'Oceanics',
      aurora: 'Pulse',
      heat: 'Atmosphere',
      folium: 'Atmosphere',
    }[extension.id];

    if (extensionMode) {
      setActiveMode(extensionMode);
      setFocusMode(extensionMode);
    }
    if (extension.id === 'folium') {
      setActiveView('Map View');
      setActiveMode('Climate');
      setFocusMode('Climate');
      return;
    }

    setActiveView(extension.id === 'heat' || extension.id === 'pressure' || extension.id === 'clouds' || extension.id === 'wind' || extension.id === 'weather' ? 'Heat Map' : extension.view);
  }

  return (
    <div className="h-screen w-full bg-[#020617] text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),transparent_60%)]" />
      <div className="absolute inset-x-0 top-0 z-30 px-6 py-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-light tracking-[0.45em] text-cyan-100 uppercase">Dheghom</h1>
            <p className="mt-2 text-[11px] uppercase tracking-[0.32em] text-white/45">{worldLabel.city}, {worldLabel.state}</p>
          </div>

          <div className="flex gap-2">
            {VIEW_EXTENSIONS.map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`h-10 px-3 rounded-full border text-[10px] tracking-[0.24em] uppercase backdrop-blur-xl transition ${
                  activeView === view
                    ? 'border-cyan-200/80 bg-cyan-200/18 text-cyan-50'
                    : 'border-cyan-400/20 bg-black/25 text-cyan-100/60 hover:text-cyan-50'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 top-24 z-30 flex w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap justify-center gap-2 px-2">
        {MODES.map((item) => (
          <button
            key={item}
            onClick={() => setActiveMode(item)}
            className={`h-10 px-4 rounded-full border backdrop-blur-xl text-[11px] tracking-[0.22em] uppercase transition ${
              activeMode === item
                ? 'border-cyan-200/80 bg-cyan-200/18 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)]'
                : 'border-cyan-400/20 bg-black/25 text-cyan-100/65 hover:border-cyan-200/50 hover:text-cyan-50'
            }`}
          >
            {MODE_LABELS[item]}
          </button>
        ))}
      </div>

      {mapFocusActive && (
        <button
          type="button"
          onClick={() => setZoomedArea(null)}
          className="absolute left-1/2 top-38 z-30 -translate-x-1/2 rounded-full border border-cyan-300/30 bg-black/35 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-cyan-100/80 backdrop-blur-xl transition hover:border-cyan-200/70 hover:text-cyan-50"
        >
          Reset View
        </button>
      )}

      <motion.aside
        animate={{ x: mapFocusActive ? -360 : 0, opacity: mapFocusActive ? 0.18 : 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="absolute left-4 top-40 bottom-28 z-20 w-[min(18rem,calc(100vw-2rem))] overflow-y-auto pr-1 lg:left-6 lg:w-72"
        style={{ pointerEvents: mapFocusActive ? 'none' : 'auto' }}
      >
        <div className="mb-4 rounded-2xl border border-cyan-400/15 bg-black/28 px-4 py-3 backdrop-blur-xl">
          <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-100/55">{feedStatus}</p>
          <h2 className="mt-2 text-lg font-light tracking-[0.14em] text-cyan-50">{MODE_LABELS[activeMode]}</h2>
        </div>
        {FEATURE_SECTIONS.map((feature) => {
          const isActive = activeMode === feature.mode;
          return (
            <button
              key={feature.mode}
              onClick={() => focusEarth(feature.mode)}
              className={`mb-3 w-full text-left rounded-2xl border p-3 backdrop-blur-xl transition ${
                isActive
                  ? 'border-cyan-200/60 bg-cyan-200/14 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                  : 'border-cyan-400/12 bg-black/22 hover:border-cyan-200/35 hover:bg-black/34'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.26em] text-cyan-100/50">{feature.api}</p>
                  <h3 className="mt-2 text-sm tracking-[0.12em] uppercase text-cyan-50">{feature.title}</h3>
                </div>
                <span className={`text-[9px] uppercase tracking-[0.22em] ${isActive ? 'text-cyan-100' : 'text-cyan-100/45'}`}>
                  {MODE_LABELS[feature.mode]}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/62">{feature.summary}</p>
            </button>
          );
        })}
        {extensionLinks.length > 0 && (
          <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-black/24 p-3 backdrop-blur-xl">
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-cyan-100/52">Endpoint Extensions</p>
            {(activeView === 'Heat Map' || activeMode === 'Atmosphere') && (
              <div className="mb-3 rounded-xl border border-cyan-300/12 bg-cyan-200/6 p-3">
                <p className="mb-2 text-[9px] uppercase tracking-[0.3em] text-cyan-100/48">Live Atmospheric Signals</p>
                <div className="grid grid-cols-2 gap-2">
                  {heatMapSignals.map((signal) => (
                    <button
                      key={signal.id}
                      onClick={() => openExtension({ id: signal.id, view: 'Heat Map' })}
                      className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-left transition hover:border-cyan-200/35 hover:bg-cyan-200/10"
                    >
                      <p className="text-[9px] uppercase tracking-[0.22em] text-cyan-100/45">{signal.label}</p>
                      <p className="mt-1 text-xs text-cyan-50">{signal.value}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/36">{signal.endpoint}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {extensionLinks.map((extension) => (
                <button
                  key={extension.id}
                  onClick={() => openExtension(extension)}
                  className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-left text-[10px] uppercase tracking-[0.18em] text-cyan-100/72 transition hover:border-cyan-200/40 hover:text-cyan-50"
                >
                  {extension.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.aside>

      <motion.aside
        animate={{ x: mapFocusActive ? 380 : 0, opacity: mapFocusActive ? 0.18 : 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="absolute right-4 top-36 bottom-28 z-20 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto lg:right-6 lg:w-78"
        style={{ pointerEvents: mapFocusActive ? 'none' : 'auto' }}
      >
        <div className="rounded-2xl border border-cyan-400/15 bg-black/28 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
          <Globe2 className="text-cyan-300" />
            <h2 className="text-sm uppercase tracking-[0.24em] text-cyan-100">{MODE_LABELS[activeMode]} Metrics</h2>
          </div>
          <p className="mt-3 text-xs leading-5 text-cyan-100/62">{activeSubtitle}</p>
          {activeView === 'Data Grid' && gridExtensions.length > 0 && (
            <div className="mt-4 rounded-xl border border-cyan-300/12 bg-cyan-200/6 p-3">
              <p className="mb-2 text-[9px] uppercase tracking-[0.3em] text-cyan-100/48">Grid Metric Extensions</p>
              <div className="space-y-2">
                {gridExtensions.map((extension) => (
                  <div key={extension.id} className="rounded-lg border border-white/8 bg-white/5 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/55">{extension.label}</p>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-white/36">{extension.endpoint}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {extension.metrics.map((metric) => (
                        <div key={metric.label} className="rounded-md border border-white/8 bg-black/20 px-2 py-1">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-white/42">{metric.label}</p>
                          <p className="text-xs text-cyan-50">{metric.unit ? formatMetric(metric.value, ` ${metric.unit}`) : `${metric.value ?? '—'}`}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeView === 'Data Grid' && (anomalyForecast.predictions?.length > 0 || anomalyForecast.summary) && (
            <div className="mt-4 rounded-xl border border-fuchsia-300/15 bg-fuchsia-200/6 p-3">
              <p className="text-[9px] uppercase tracking-[0.3em] text-fuchsia-100/50">AI Weather Anomaly Forecast</p>
              <p className="mt-2 text-xs leading-5 text-fuchsia-50/85">{anomalyForecast.summary ?? 'Predicting near-term shifts from the live observation stream.'}</p>
              <div className="mt-3 grid gap-2">
                {(anomalyForecast.predictions ?? []).map((prediction) => (
                  <div key={prediction.variable} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-fuchsia-100/70">{prediction.label}</p>
                        <p className="mt-1 text-xs text-white/70">{prediction.source}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Risk {Math.round((prediction.risk ?? 0) * 100)}%</p>
                        <p className="mt-1 text-xs text-fuchsia-50">{prediction.direction}</p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-cyan-50">
                      <div className="rounded-md border border-white/8 bg-white/5 px-2 py-1">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-white/42">Forecast</p>
                        <p>{formatMetric(prediction.predicted_value, prediction.unit ? ` ${prediction.unit}` : '')}</p>
                      </div>
                      <div className="rounded-md border border-white/8 bg-white/5 px-2 py-1">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-white/42">Delta</p>
                        <p>{formatMetric(prediction.delta, prediction.unit ? ` ${prediction.unit}` : '')}</p>
                      </div>
                      <div className="rounded-md border border-white/8 bg-white/5 px-2 py-1">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-white/42">ETA</p>
                        <p>{prediction.eta_hours}h</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeMode === 'Atmosphere' && (
            <div className="mt-4 h-28 overflow-hidden rounded-xl border border-cyan-300/12 bg-black/24">
              <motion.div
                animate={{ y: ['0%', '-50%'] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                className="space-y-2 p-3"
              >
                {[...atmosphereTicker, ...atmosphereTicker].map(([label, value], index) => (
                  <div key={`${label}-${index}`} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/5 px-3 py-2">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-white/44">{label}</span>
                    <span className="text-sm text-cyan-100">{value}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {activeView === 'Data Grid' ? (
              gridPanels.map((panel) => (
                <div key={panel.id} className="rounded-xl border border-white/8 bg-black/22 px-3 py-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/55">{panel.title}</p>
                    <p className="text-[9px] uppercase tracking-[0.18em] text-white/36">{panel.endpoint}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {panel.metrics.map((metric) => (
                      <div key={`${panel.id}-${metric.label}`} className="rounded-lg border border-white/8 bg-white/5 px-2 py-1">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-white/42">{metric.label}</p>
                        <p className="text-xs text-cyan-100">{metric.unit ? formatMetric(metric.value, ` ${metric.unit}`) : `${metric.value ?? '—'}`}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              renderedMetrics.map(([label, value]) => (
                <div key={label} className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/22 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{label}</p>
                  <p className="text-right text-sm font-light text-cyan-100">{value}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.aside>

      <div className="absolute inset-0 z-10">
        {isMapView ? (
          <div className="absolute inset-0 px-4 pb-28 pt-36 lg:px-6">
            <div className="h-full overflow-hidden border border-cyan-300/15 bg-[#04101c]/90 shadow-[0_0_60px_rgba(8,145,178,0.18)] backdrop-blur-xl" style={{ borderRadius: '2rem' }}>
              <iframe
                title="Dheghom map"
                src={`${API_BASE_URL}/folium-map`}
                className="h-full w-full"
                loading="lazy"
              />
            </div>
          </div>
        ) : (
          <Canvas camera={{ position: [0.45, 0.7, 6.05], fov: 34 }} dpr={[1, 2]}>
            <CameraDirector
              mode={activeMode}
              controlsRef={controlsRef}
              focusMode={focusMode}
              mapViewConfig={mapViewConfig}
              activeView={activeView}
              zoomedArea={zoomedArea}
            />
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 5, 5]} intensity={3} />
            <pointLight position={[-5, -5, -5]} intensity={2} color="#67e8f9" />

            <Stars radius={100} depth={50} count={5000} factor={4} fade />

            <FloatingParticles />
            <RainField snapshot={snapshot} />
            {earthVisible && <Earth mode={activeMode} scale={earthScale} onFocusArea={focusMapArea} />}
            <EndpointLinkLayer active={showAllEndpoints} focusedMode={activeMode} intensity={gridIntensity} onFocusArea={focusMapArea} />
            <WorldGridLayer active={gridVisible} intensity={gridIntensity} city={worldLabel.city} state={worldLabel.state} onFocusArea={focusMapArea} />
            <AtmosphereLayer active={activeMode === 'Atmosphere'} />
            <HeatSignatureLayer active={activeView === 'Combined' || activeMode === 'Climate' || activeView === 'Heat Map'} signatures={heatSignatures} snapshot={snapshot} onFocusArea={focusMapArea} />
            <OceanicsLayer active={activeMode === 'Oceanics'} />
            <PulseLayer active={activeMode === 'Pulse'} />
            <AuroraBorealisLayer active={showAuroraLayer} aurora={liveAurora} />

            <OrbitControls
              ref={controlsRef}
              enableZoom={mapViewConfig?.controls?.zoom ?? true}
              enablePan={mapViewConfig?.controls?.pan ?? false}
              enableDamping={mapViewConfig?.controls?.damping ?? true}
              autoRotate
              autoRotateSpeed={activeView === 'Map View' ? mapViewConfig?.earth?.auto_rotate_speed ?? 0.18 : 0.22}
              dampingFactor={0.08}
            />
          </Canvas>
        )}
      </div>

      <motion.div
        animate={{ y: mapFocusActive ? 90 : 0, opacity: mapFocusActive ? 0.2 : 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="absolute inset-x-4 bottom-4 z-20 lg:inset-x-6 lg:bottom-5"
        style={{ pointerEvents: mapFocusActive ? 'none' : 'auto' }}
      >
        <button
          type="button"
          onClick={() => focusMapArea(activeMode)}
          className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 rounded-2xl border border-cyan-400/15 bg-black/34 px-4 py-3 text-left backdrop-blur-xl transition hover:border-cyan-200/45 hover:bg-black/44"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/48">Planetary Climate Visualization System</p>
            <p className="mt-1 truncate text-sm text-cyan-50/82">{mapViewConfig?.caption ?? worldLabel.caption}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            {quickStats.map(([label, value]) => (
              <div key={label} className="min-w-24 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-center">
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/42">{label}</p>
                <p className="mt-1 text-xs text-cyan-100">{value}</p>
              </div>
            ))}
          </div>
        </button>
      </motion.div>
    </div>
  );
}
