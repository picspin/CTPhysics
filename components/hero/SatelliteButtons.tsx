'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLanguage, type MessageKey } from '@/context/LanguageContext';

const modules: { titleKey: MessageKey; descKey: MessageKey; href: string; color: string }[] = [
    { titleKey: 'land_mod_recon', href: '/reconstruction', descKey: 'land_mod_recon_desc', color: 'shadow-cyan-500/50 border-cyan-400/30' },
    { titleKey: 'land_mod_cbct', href: '/reconstruction', descKey: 'land_mod_cbct_desc', color: 'shadow-sky-500/50 border-sky-400/30' },
    { titleKey: 'land_mod_pcct', href: '/pcct', descKey: 'land_mod_pcct_desc', color: 'shadow-emerald-500/50 border-emerald-400/30' },
    { titleKey: 'land_mod_dose', href: '/dose', descKey: 'land_mod_dose_desc', color: 'shadow-red-500/50 border-red-400/30' },
    { titleKey: 'land_mod_cardiac', href: '/cardiac', descKey: 'land_mod_cardiac_desc', color: 'shadow-pink-500/50 border-pink-400/30' },
    { titleKey: 'land_mod_dual', href: '/dual-energy', descKey: 'land_mod_dual_desc', color: 'shadow-purple-500/50 border-purple-400/30' },
    { titleKey: 'land_mod_quiz', href: '/questions', descKey: 'land_mod_quiz_desc', color: 'shadow-emerald-500/50 border-emerald-400/30' },
];

const SatelliteButtons = () => {
    const { t } = useLanguage();
    // Rotation State driven by center hover
    const [isHoveringCenter, setIsHoveringCenter] = useState(false);

    useEffect(() => {
        type WithHook = Window & { __setCenterHover?: (val: boolean) => void };
        const w = window as WithHook;
        w.__setCenterHover = (val: boolean) => setIsHoveringCenter(val);
        return () => {
            delete w.__setCenterHover;
        };
    }, []);

    // Config
    const radius = 350;
    const total = modules.length;

    // Animation Variants
    // Container rotates clockwise
    const orbitVariants = {
        idle: { rotate: 0 },
        orbit: {
            rotate: 360,
            transition: { duration: 1.2, ease: 'easeInOut', repeat: Infinity }
        }
    };

    // Buttons must counter-rotate to stay upright
    const counterRotateVariants = {
        idle: { rotate: 0 },
        orbit: {
            rotate: -360,
            transition: { duration: 1.2, ease: 'easeInOut', repeat: Infinity }
        }
    };

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">

            {/* Invisible Center Hover Trigger */}
            <div
                data-testid="center-hover-trigger"
                className="absolute w-80 h-80 rounded-full z-50 pointer-events-auto cursor-crosshair left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                onMouseOver={() => setIsHoveringCenter(true)}
                onMouseOut={() => setIsHoveringCenter(false)}
                onClick={() => setIsHoveringCenter(true)}
                title={t('land_hover_hint')}
            />

            {/* Orbiting Container */}
            <motion.div
                data-testid="orbit-container"
                data-state={isHoveringCenter ? 'orbiting' : 'stopped'}
                className="relative w-full h-full flex items-center justify-center pointer-events-none"
                variants={orbitVariants}
                animate={isHoveringCenter ? 'orbit' : 'idle'}
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
                                animate={isHoveringCenter ? 'orbit' : 'idle'}
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
                                        <h3 className="text-sm font-bold text-white mb-1 tracking-wider uppercase group-hover:text-cyan-300 transition-colors">{t(mod.titleKey)}</h3>
                                        <p className="text-[10px] text-gray-400 font-light leading-tight px-1 hidden md:block">{t(mod.descKey)}</p>
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
