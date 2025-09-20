'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Cylinder, Line } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import Select from '../ui/Select';
import Slider from '../ui/Slider';
import Button from '../ui/Button';
import { HelicalCTOptions } from '@/types';
import { helicalInterpolation } from '@/utils/physics-calculations';

interface Props {
  options?: HelicalCTOptions;
}

// 3D Helical Path Component
const HelicalPath: React.FC<{
  pitch: number;
  rotations: number;
  isAnimating: boolean;
  currentPosition: number;
}> = ({ pitch, rotations, isAnimating, currentPosition }) => {
  const lineRef = useRef<THREE.BufferGeometry>(null);
  
  useEffect(() => {
    if (!lineRef.current) return;
    
    const points: THREE.Vector3[] = [];
    const segments = 200;
    
    for (let i = 0; i <= segments * rotations; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 2;
      const x = Math.cos(angle) * 2;
      const y = Math.sin(angle) * 2;
      const z = t * pitch * 0.5 - rotations * pitch * 0.25;
      points.push(new THREE.Vector3(x, y, z));
    }
    
    lineRef.current.setFromPoints(points);
  }, [pitch, rotations]);
  
  return (
    <>
      <Line
        ref={lineRef}
        color="#FF7A00"
        lineWidth={3}
        dashed={false}
      />
      {isAnimating && (
        <mesh position={[
          Math.cos(currentPosition * Math.PI * 2) * 2,
          Math.sin(currentPosition * Math.PI * 2) * 2,
          currentPosition * pitch * 0.5 - rotations * pitch * 0.25
        ]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#FF7A00" emissive="#FF7A00" emissiveIntensity={0.5} />
        </mesh>
      )}
    </>
  );
};

// Patient Table Component
const PatientTable: React.FC<{ position: number }> = ({ position }) => {
  return (
    <group position={[0, -3, position]}>
      <Box args={[3, 0.2, 8]}>
        <meshStandardMaterial color="#333333" />
      </Box>
      {/* Patient representation */}
      <Cylinder args={[0.8, 0.8, 5]} position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#FFE4C4" opacity={0.8} transparent />
      </Cylinder>
    </group>
  );
};

// CT Gantry Component
const CTGantry: React.FC<{ rotation: number }> = ({ rotation }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.z = rotation;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Gantry ring */}
      <mesh>
        <torusGeometry args={[3, 0.5, 8, 32]} />
        <meshStandardMaterial color="#4A90E2" />
      </mesh>
      
      {/* X-ray source */}
      <mesh position={[3, 0, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.3} />
      </mesh>
      
      {/* Detector array */}
      <mesh position={[-3, 0, 0]}>
        <boxGeometry args={[0.3, 2, 0.3]} />
        <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={0.3} />
      </mesh>
      
      {/* X-ray beam */}
      <mesh position={[0, 0, 0]}>
        <coneGeometry args={[2, 6, 4]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial 
          color="#FFFF00" 
          opacity={0.2} 
          transparent 
          emissive="#FFFF00" 
          emissiveIntensity={0.1}
        />
      </mesh>
    </group>
  );
};

const HelicalCTSimulator: React.FC<Props> = ({ options }) => {
  const defaultPitchValues = [
    { value: 0.5, name: '0.5', description: 'Overlapping helices - High quality, high dose' },
    { value: 1.0, name: '1.0', description: 'Contiguous helices - Standard quality and dose' },
    { value: 1.5, name: '1.5', description: 'Small gaps - Faster scan, potential gaps' },
    { value: 2.0, name: '2.0', description: 'Large gaps - Very fast, may miss details' }
  ];
  
  const pitchValues = options?.pitchValues || defaultPitchValues;
  
  const [pitch, setPitch] = useState(1.0);
  const [rotationTime, setRotationTime] = useState(0.5);
  const [scanLength, setScanLength] = useState(20);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [gantryRotation, setGantryRotation] = useState(0);
  const [tablePosition, setTablePosition] = useState(0);
  
  // Animation loop
  useEffect(() => {
    let animationId: number;
    
    if (isScanning) {
      const startTime = Date.now();
      const totalRotations = scanLength / (pitch * 10); // Assuming 10mm collimation
      const totalTime = totalRotations * rotationTime * 1000; // Convert to ms
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / totalTime, 1);
        
        setScanProgress(progress);
        setGantryRotation(progress * totalRotations * Math.PI * 2);
        setTablePosition(progress * scanLength * 0.1);
        
        if (progress < 1) {
          animationId = requestAnimationFrame(animate);
        } else {
          setIsScanning(false);
        }
      };
      
      animationId = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isScanning, scanLength, pitch, rotationTime]);
  
  const startScan = () => {
    if (isScanning) {
      setIsScanning(false);
    } else {
      setScanProgress(0);
      setGantryRotation(0);
      setTablePosition(0);
      setIsScanning(true);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Pitch"
          options={pitchValues.map(p => ({
            id: p.value.toString(),
            name: `${p.name} - ${p.description}`
          }))}
          value={pitch.toString()}
          onChange={(value) => setPitch(parseFloat(value))}
        />
        
        <Slider
          label="Rotation Time"
          min={0.3}
          max={2.0}
          value={rotationTime}
          onChange={setRotationTime}
          step={0.1}
          unit="s"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Slider
          label="Scan Length"
          min={10}
          max={50}
          value={scanLength}
          onChange={setScanLength}
          step={5}
          unit="cm"
        />
        
        <div className="flex items-end">
          <Button onClick={startScan} variant="primary" className="w-full">
            {isScanning ? 'Stop Scan' : 'Start Helical Scan'}
          </Button>
        </div>
      </div>
      
      {/* 3D Visualization */}
      <div className="relative h-96 bg-black rounded-lg overflow-hidden">
        <Canvas camera={{ position: [8, 8, 8], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
          
          {/* CT Scanner Components */}
          <CTGantry rotation={gantryRotation} />
          <PatientTable position={-tablePosition} />
          
          {/* Helical path visualization */}
          <HelicalPath
            pitch={pitch * 2}
            rotations={scanLength / (pitch * 10)}
            isAnimating={isScanning}
            currentPosition={scanProgress * scanLength / (pitch * 10)}
          />
          
          {/* Grid for reference */}
          <gridHelper args={[20, 20]} position={[0, -3.1, 0]} />
        </Canvas>
        
        {/* Scan progress overlay */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 left-4 bg-bg-100 rounded-lg p-3 shadow-lg"
            >
              <div className="text-sm font-medium text-text-100 mb-2">
                Scan Progress: {Math.round(scanProgress * 100)}%
              </div>
              <div className="w-48 h-2 bg-bg-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary-100"
                  style={{ width: `${scanProgress * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-text-200">
                Table position: {(tablePosition * 10).toFixed(1)}mm
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Information panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-bg-200 rounded-lg p-4"
        >
          <h4 className="font-medium text-text-100 mb-2">Scan Parameters</h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-200">Pitch:</dt>
              <dd className="font-medium text-text-100">{pitch}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-200">Table Speed:</dt>
              <dd className="font-medium text-text-100">
                {(pitch * 10 / rotationTime).toFixed(1)} mm/s
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-200">Total Rotations:</dt>
              <dd className="font-medium text-text-100">
                {(scanLength / (pitch * 10)).toFixed(1)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-200">Scan Time:</dt>
              <dd className="font-medium text-text-100">
                {(scanLength / (pitch * 10) * rotationTime).toFixed(1)}s
              </dd>
            </div>
          </dl>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-bg-200 rounded-lg p-4"
        >
          <h4 className="font-medium text-text-100 mb-2">Pitch Effects</h4>
          <div className="space-y-2 text-sm text-text-200">
            {pitch < 1 && (
              <p className="text-green-600">
                ✓ Overlapping data improves image quality
                <br />✗ Increased radiation dose
              </p>
            )}
            {pitch === 1 && (
              <p className="text-blue-600">
                ✓ Optimal balance of quality and dose
                <br />✓ No gaps or overlaps in coverage
              </p>
            )}
            {pitch > 1 && (
              <p className="text-orange-600">
                ✓ Faster scan time
                <br />✗ Potential gaps in z-axis coverage
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HelicalCTSimulator;