'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Sphere } from '@react-three/drei';
import * as THREE from 'three';

// 3D CT Scanner Model
const CTScannerModel: React.FC = () => {
  const [rotation, setRotation] = useState(0);
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => prev + 0.01);
    }, 16);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <group>
      {/* Gantry */}
      <mesh rotation={[0, 0, rotation]}>
        <torusGeometry args={[3, 0.5, 8, 32]} />
        <meshStandardMaterial color="#4A90E2" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* X-ray source */}
      <mesh position={[3, 0, 0]} rotation={[0, 0, rotation]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Detector */}
      <mesh position={[-3, 0, 0]} rotation={[0, 0, rotation]}>
        <boxGeometry args={[0.3, 2, 0.3]} />
        <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Patient table */}
      <Box args={[2, 0.2, 4]} position={[0, -1.5, 0]}>
        <meshStandardMaterial color="#333333" />
      </Box>
    </group>
  );
};

// Feature card component
interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  delay?: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ 
  title, 
  description, 
  icon, 
  href, 
  color,
  delay = 0 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
    >
      <Link href={href}>
        <div className="h-full bg-bg-100 rounded-xl border border-border-100 p-6 hover:border-primary-100 hover:shadow-lg transition-all duration-300 group cursor-pointer">
          <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-text-100 mb-2 group-hover:text-primary-100 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-text-200 mb-4">
            {description}
          </p>
          <div className="flex items-center text-primary-100 text-sm font-medium">
            <span>Learn more</span>
            <svg className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default function HomePage() {
  const features = [
    {
      title: 'CT Reconstruction',
      description: 'Explore backprojection algorithms, filtered backprojection, and helical CT scanning techniques with interactive visualizations.',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      href: '/reconstruction',
      color: 'bg-blue-500'
    },
    {
      title: 'Dose Measurement',
      description: 'Understand CTDI, DLP, and effective dose calculations. Learn about dose optimization strategies and patient safety.',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      href: '/dose',
      color: 'bg-yellow-500'
    },
    {
      title: 'Cardiac CT',
      description: 'Master ECG gating techniques, temporal resolution concepts, and cardiac-specific imaging protocols.',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      href: '/cardiac',
      color: 'bg-red-500'
    },
    {
      title: 'Dual Energy CT',
      description: 'Discover material decomposition, virtual monoenergetic imaging, and clinical applications of spectral CT.',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
      href: '/dual-energy',
      color: 'bg-purple-500'
    },
    {
      title: 'Review Questions',
      description: 'Test your knowledge with interactive quizzes covering all aspects of CT physics and clinical applications.',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: '/questions',
      color: 'bg-green-500'
    }
  ];
  
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-100 via-primary-200 to-accent-100 p-8 md:p-12"
      >
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl md:text-5xl font-bold text-white mb-4"
            >
              Master CT Physics Through
              <span className="block text-yellow-300">Interactive Learning</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg md:text-xl text-white/90 mb-8"
            >
              Explore advanced simulations, visualizations, and interactive tools designed to deepen your understanding of computed tomography physics.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/reconstruction">
                <button className="px-6 py-3 bg-white text-primary-100 font-semibold rounded-lg hover:bg-yellow-300 transition-colors duration-300">
                  Start Learning
                </button>
              </Link>
              <button className="px-6 py-3 bg-white/20 backdrop-blur text-white font-semibold rounded-lg border border-white/30 hover:bg-white/30 transition-colors duration-300">
                Watch Demo
              </button>
            </motion.div>
          </div>
          
          <div className="hidden lg:block h-96">
            <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} intensity={1} />
              <CTScannerModel />
              <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
            </Canvas>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-300 rounded-full opacity-10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-300 rounded-full opacity-10 blur-3xl" />
      </motion.section>
      
      {/* Features Grid */}
      <section>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-text-100 mb-3">
            Interactive Learning Modules
          </h2>
          <p className="text-lg text-text-200 max-w-2xl mx-auto">
            Each module features hands-on simulations, real-time visualizations, and comprehensive explanations.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              {...feature}
              delay={0.6 + index * 0.1}
            />
          ))}
        </div>
      </section>
      
      {/* Stats Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="bg-bg-100 rounded-xl p-8 border border-border-100"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-primary-100">15+</div>
            <div className="text-sm text-text-200 mt-1">Interactive Simulations</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary-100">50+</div>
            <div className="text-sm text-text-200 mt-1">Learning Topics</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary-100">100+</div>
            <div className="text-sm text-text-200 mt-1">Practice Questions</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary-100">24/7</div>
            <div className="text-sm text-text-200 mt-1">Available Access</div>
          </div>
        </div>
      </motion.section>
      
      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="text-center"
      >
        <h3 className="text-xl font-semibold text-text-100 mb-4">
          Ready to enhance your CT physics knowledge?
        </h3>
        <p className="text-text-200 mb-6">
          Join thousands of radiologists and technologists improving their understanding of CT imaging.
        </p>
        <Link href="/reconstruction">
          <button className="px-8 py-3 bg-primary-100 text-white font-semibold rounded-lg hover:bg-primary-200 transform hover:scale-105 transition-all duration-300">
            Get Started Free
          </button>
        </Link>
      </motion.section>
    </div>
  );
}