'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';

interface LiquidGlassProps {
    children: React.ReactNode;
    className?: string;
    intensity?: 'low' | 'medium' | 'high';
    color?: string; // Hex or Tailwind color class
    interactive?: boolean;
}

const LiquidGlass: React.FC<LiquidGlassProps> = ({
    children,
    className = '',
    intensity = 'medium',
    color = 'rgba(255, 255, 255, 0.1)',
    interactive = true,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    // Mouse position for spotlight/liquid effect
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth spring animation for the liquid center
    const springConfig = { damping: 25, stiffness: 150 };
    const springX = useSpring(mouseX, springConfig);
    const springY = useSpring(mouseY, springConfig);

    // Dynamic background gradient based on mouse position
    const background = useMotionTemplate`radial-gradient(
    circle at ${springX}px ${springY}px,
    ${color},
    transparent 80%
  )`;

    // Blur intensity map
    const blurMap = {
        low: 'backdrop-blur-sm',
        medium: 'backdrop-blur-md',
        high: 'backdrop-blur-lg',
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current || !interactive) return;
        const rect = ref.current.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
    };

    return (
        <div
            ref={ref}
            className={`relative overflow-hidden rounded-xl border border-white/20 shadow-xl ${className}`}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: 'rgba(255, 255, 255, 0.05)', // Base translucency
            }}
        >
            {/* Liquid Distortion SVG Filter */}
            <svg className="absolute inset-0 pointer-events-none opacity-0">
                <defs>
                    <filter id="liquid-filter">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.01"
                            numOctaves="3"
                            result="noise"
                        />
                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="noise"
                            scale="20"
                            xChannelSelector="R"
                            yChannelSelector="G"
                        />
                    </filter>
                </defs>
            </svg>

            {/* Animated Spotlight/Liquid Layer */}
            <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background,
                    opacity: isHovered ? 1 : 0,
                }}
                transition={{ duration: 0.5 }}
            />

            {/* Glass Surface */}
            <div
                className={`relative z-10 h-full w-full ${blurMap[intensity]} transition-all duration-500`}
            >
                {children}
            </div>

            {/* Shimmer Border Effect */}
            <div className="absolute inset-0 rounded-xl border border-white/10 pointer-events-none" />

            {/* Highlight Reflection */}
            <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none rounded-t-xl" />
        </div>
    );
};

export default LiquidGlass;
