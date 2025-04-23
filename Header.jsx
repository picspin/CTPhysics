import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const navItems = [
  { path: '/reconstruction', label: 'CT重建和螺旋CT' },
  { path: '/dose', label: 'CT剂量测量' },
  { path: '/cardiac', label: '心脏CT' },
  { path: '/dual-energy', label: '束硬化和双能CT' },
  { path: '/questions', label: 'CT物理复习题' },
];

const Header = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // 处理点击事件，在移动设备上点击导航链接后关闭菜单
  const handleNavClick = () => {
    setIsMenuOpen(false);
  };

  // 处理点击外部区域关闭菜单
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest('nav') && !event.target.closest('button')) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-border/20 bg-bg-100/90 backdrop-blur-sm md:hidden">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-primary-100">CT Physics</span>
        </Link>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl p-2 text-text-100 transition-colors hover:bg-bg-200/70 hover:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100/50"
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-6 w-6"
          >
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            )}
          </svg>
        </button>
      </div>
      {isMenuOpen && (
        <nav className="animate-slide-up border-t border-border/20 bg-bg-100/95 px-4 py-3 backdrop-blur-sm">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`block rounded-xl px-4 py-3 text-base font-medium transition-all duration-300 ${
                    pathname === item.path
                      ? 'bg-primary-100/10 text-primary-100 shadow-sm'
                      : 'hover:bg-bg-200/70 text-text-100 hover:text-primary-100'
                  }`}
                  onClick={handleNavClick}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
};

export default Header;
