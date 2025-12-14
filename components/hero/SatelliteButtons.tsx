'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const modules = [
    { title: 'Reconstruction', href: '/reconstruction', desc: 'FBP, Helical & Kernels', color: 'shadow-cyan-500/50 border-cyan-400/30' },
    { title: 'Dose & Safety', href: '/dose', desc: 'CTDI, DLP & ALARA', color: 'shadow-red-500/50 border-red-400/30' },
    { title: 'Cardiac CT', href: '/cardiac', desc: 'ECG Gating & 4D', color: 'shadow-pink-500/50 border-pink-400/30' },
    { title: 'Dual Energy', href: '/dual-energy', desc: 'Spectral Analysis', color: 'shadow-purple-500/50 border-purple-400/30' },
    { title: 'Quiz Base', href: '/questions', desc: 'Test Knowledge', color: 'shadow-emerald-500/50 border-emerald-400/30' },
    { title: 'Architecture', href: '/', desc: 'System Design', color: 'shadow-blue-500/50 border-blue-400/30' },
];

const SatelliteButtons = () => {
    // Rotation State driven by center hover
    const [isHoveringCenter, setIsHoveringCenter] = useState(false);

    // Config
    const radius = 350;
    const total = modules.length;

    // Animation Variants
    // Container rotates clockwise
    const orbitVariants = {
        animate: (isHovering: boolean) => ({
            rotate: 360,
            transition: {
                duration: isHovering ? 20 : 60, // 20s/circle on hover (fast), 60s normal
                ease: "linear",
                repeat: Infinity,
            }
        })
    };

    // Buttons must counter-rotate to stay upright
    const counterRotateVariants = {
        animate: (isHovering: boolean) => ({
            rotate: -360,
            transition: {
                duration: isHovering ? 20 : 60,
                ease: "linear",
                repeat: Infinity,
            }
        })
    };

    return (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">

            {/* Invisible Center Hover Trigger */}
            <div
                className="absolute w-80 h-80 rounded-full z-20 pointer-events-auto cursor-crosshair"
                onMouseEnter={() => setIsHoveringCenter(true)}
                onMouseLeave={() => setIsHoveringCenter(false)}
                title="Hover to accelerate orbit"
            />

            {/* Orbiting Container */}
            <motion.div
                className="relative w-full h-full flex items-center justify-center pointer-events-none"
                variants={orbitVariants}
                animate="animate"
                custom={isHoveringCenter}
            >
                {modules.map((mod, i) => {
                    const angle = (i / total) * Math.PI * 2 - (Math.PI / 2); // Start top
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;

                    return (
                        <div
                            key={i}
                            className="absolute pointer-events-auto"
                            style={{ transform: `translate(${x}px, ${y}px)` }}
                        >
                            {/* Counter-Rotation Wrapper */}
                            <motion.div
                                variants={counterRotateVariants}
                                animate="animate"
                                custom={isHoveringCenter}
                            >
                                <Link href={mod.href}>
                                    <motion.div
                                        className={`
                                          relative w-32 h-32 md:w-36 md:h-36 rounded-full 
                                          backdrop-blur-xl bg-black/60 
                                          border border-white/10 hover:border-white/80
                                          flex flex-col items-center justify-center text-center p-4
                                          transition-all duration-300 group cursor-pointer
                                          shadow-[0_0_20px_rgba(0,0,0,0.5)]
                                          ${mod.color}
                                        `}
                                        whileHover={{
                                            scale: 1.2,
                                            boxShadow: `0 0 40px var(--tw-shadow-color)`,
                                            zIndex: 50
                                        }}
                                    >
                                        <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-300 bg-gradient-to-t from-current to-transparent`} />
                                        <h3 className="text-sm font-bold text-white mb-1 tracking-wider uppercase group-hover:text-cyan-300 transition-colors">{mod.title}</h3>
                                        <p className="text-[10px] text-gray-400 font-light leading-tight px-1 hidden md:block">{mod.desc}</p>
                                        <div className="absolute -inset-1 rounded-full border border-white/5 group-hover:border-white/20 transition-colors duration-500 scale-110" />
                                    </motion.div>
                                </Link>
                            </motion.div>
                        </div>
                    );
                })}
            </motion.div>
        </div>
    );
};

export default SatelliteButtons;
