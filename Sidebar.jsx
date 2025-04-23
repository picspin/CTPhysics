import React from 'react';
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

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 overflow-y-auto border-r border-border/20 bg-bg-100/90 backdrop-blur-sm md:block">
      <div className="flex h-16 items-center border-b border-border/20 px-6">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-primary-100">CT Physics</span>
        </Link>
      </div>
      <nav className="p-6">
        <ul className="space-y-3">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
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
  );
};

export default Sidebar;
