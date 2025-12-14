'use client';

import React from 'react';
import CTHeroScene from '@/components/hero/CTHeroScene';
import LandingNav from '@/components/hero/LandingNav';
import SatelliteButtons from '@/components/hero/SatelliteButtons';
import { motion } from 'framer-motion';

export default function LandingPage() {
    return (
        <main className="relative min-h-screen w-full overflow-hidden text-white bg-black">
            <LandingNav />

            {/* 3D Scene Background */}
            <CTHeroScene />

            {/* Central Hero Text if needed, or just let the scene speak? 
          User said: "Refractor the hero section... image have suitable crops and fusioned with same background."
          The SatelliteButtons are "surrounding the lightbeam flow".
          Let's add a subtle central title or rely on the Nav title + visual impact.
          I'll add a central intro text that fades out or sits behind/above.
      */}
            <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 text-center pointer-events-none z-0">
                <motion.h1
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1 }}
                    className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10"
                >
                    CT PHYSICS
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="mt-2 text-sm md:text-lg text-blue-200 font-light tracking-widest uppercase"
                >
                    Next Gen Imaging Simulation
                </motion.p>
            </div>

            {/* Floating Buttons */}
            <SatelliteButtons />
        </main>
    );
}
