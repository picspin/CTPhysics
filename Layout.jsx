import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-bg-200">
      <Sidebar />
      <div className="flex w-full flex-col md:pl-64">
        <Header />
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
        <footer className="border-t border-border/20 bg-bg-100/80 p-6 text-center text-sm text-text-200 backdrop-blur-sm">
          <p>© {new Date().getFullYear()} CT Physics Web App</p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
