'use client';

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen relative">
            {/* Global hero background for main pages */}
            <div
                className="fixed inset-0 -z-10"
                style={{
                    backgroundImage: 'url(/images/ct-hero.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}
            />
            <div className="fixed inset-0 -z-10 bg-black/70" />
            <Sidebar />

            <div className="flex-1 md:ml-64 flex flex-col">
                <Header />

                <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>

                <footer className="mt-auto border-t border-white/10 bg-black/40 backdrop-blur-md">
                    <div className="px-4 py-6 md:px-6 lg:px-8">
                        <div className="mx-auto max-w-7xl">
                            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                                <div className="text-sm text-text-200">
                                    © {new Date().getFullYear()} CT物理原理交互式学习平台 (CT Physics Platform)
                                </div>
                                <div className="flex items-center space-x-6 text-sm">
                                    <a href="/privacy" className="text-text-200 hover:text-primary-100 transition-colors">
                                        隐私政策 (Privacy)
                                    </a>
                                    <a href="/terms" className="text-text-200 hover:text-primary-100 transition-colors">
                                        使用条款 (Terms)
                                    </a>
                                    <a href="/about" className="text-text-200 hover:text-primary-100 transition-colors">
                                        关于 (About)
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
