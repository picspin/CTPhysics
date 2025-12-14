'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';

const navItems = [
    { label: 'CT Reconst', href: '/reconstruction' },
    { label: 'Dose Safe', href: '/dose' },
    { label: 'Cardiac CT', href: '/cardiac' },
    { label: 'Spectral', href: '/dual-energy' },
    { label: 'Practice', href: '/questions' },
];

export default function LandingNav() {
    const navRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (navRef.current) {
                const rect = navRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                navRef.current.style.setProperty('--x', `${x}px`);
                navRef.current.style.setProperty('--y', `${y}px`);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <nav
            ref={navRef}
            className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-md border-b border-white/10 group"
            style={
                {
                    '--x': '0px',
                    '--y': '0px',
                } as React.CSSProperties
            }
        >
            <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400 tracking-wider z-10">
                CT PHYSICS
            </div>

            {/* Spotlight Effect */}
            <div
                className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                    background: `radial-gradient(600px circle at var(--x) var(--y), rgba(64, 224, 208, 0.1), transparent 40%)`
                }}
            />

            <div className="hidden md:flex items-center space-x-1 z-10">
                {navItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                        <div className="relative px-5 py-2 rounded-full overflow-hidden transition-all duration-300 hover:bg-white/10 text-gray-300 hover:text-white group/btn">
                            <span className="relative z-10 flex items-center gap-2 text-sm font-medium">
                                {item.label}
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300"
                                >
                                    <path d="M5 12h14" />
                                    <path d="M12 5l7 7-7 7" />
                                </svg>
                            </span>

                            {/* Button Specific Glow (Simple Hover) */}
                            <div
                                className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"
                                style={{
                                    background: `linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(64, 224, 208, 0.1))`
                                }}
                            />
                        </div>
                    </Link>
                ))}
            </div>

            {/* Mobile Menu Icon (Placeholder) */}
            <div className="md:hidden text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </div>
        </nav>
    );
}
