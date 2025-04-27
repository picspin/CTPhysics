'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { path: '/reconstruction', label: 'CT重建和螺旋CT' },
  { path: '/dose', label: 'CT剂量测量' },
  { path: '/cardiac', label: '心脏CT' },
  { path: '/dual-energy', label: '束硬化和双能CT' },
  { path: '/questions', label: 'CT物理复习题' },
];

const Sidebar = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  
  // 关闭侧边栏当路由变化时
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);
  
  // 当侧边栏打开时禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* 移动端菜单按钮 */}
      <button
        className="fixed right-4 top-4 z-50 rounded-full bg-primary-100 p-2 text-white shadow-md md:hidden focus-ring"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? '关闭菜单' : '打开菜单'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-6 w-6"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          )}
        </svg>
      </button>

      {/* 移动端背景遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-text-100/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto border-r border-border-100 bg-bg-100/95 backdrop-blur-md transition-transform duration-300 ease-in-out md:translate-x-0 md:shadow-none ${isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center border-b border-border-100 px-6">
          <Link href="/" className="flex items-center space-x-2 focus-ring">
            <span className="text-xl font-bold text-primary-100">CT Physics</span>
          </Link>
        </div>
        <nav className="p-6">
          <ul className="space-y-3">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 focus-ring ${
                    pathname === item.path
                      ? 'bg-primary-100/10 text-primary-100 shadow-sm'
                      : 'hover:bg-bg-200/70 text-text-100 hover:text-primary-100'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
