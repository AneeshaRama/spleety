'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface ExpenseSidebarProps {
  onOpenChange?: (isOpen: boolean) => void;
}

export default function ExpenseSidebar({ onOpenChange }: ExpenseSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { publicKey } = useWallet();

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const handleNavigate = (path: string) => {
    window.location.href = path;
  };

  return (
    <>
      {/* Hamburger Menu Button - Only show when closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-6 left-6 z-50 text-4xl text-[#ff00ff] hover:text-[#ff33ff] transition-colors hover:scale-110 transform cursor-pointer"
          title="Menu"
        >
          ☰
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-[#0f0f1e] border-r-4 border-[#ff00ff] z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          boxShadow: isOpen ? '8px 0 0 0 rgba(255, 0, 255, 0.5)' : 'none',
        }}
      >
        {/* Close Button - Top right of sidebar */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-6 right-6 z-50 text-3xl text-[#ff00ff] hover:text-[#ff33ff] transition-colors hover:scale-110 transform cursor-pointer"
          title="Close"
        >
          ✕
        </button>

        <div className="p-6 h-full">
          {/* Header */}
          <div className="mb-8 pb-4 border-b-4 border-[#ff00ff]">
            <h2 className="text-xl text-[#ffff00]" style={{ fontFamily: 'Press Start 2P' }}>
              MENU
            </h2>
          </div>

          {/* Navigation Menu */}
          {publicKey ? (
            <div className="space-y-4">
              <button
                onClick={() => handleNavigate('/expenses')}
                className="w-full bg-[#ff00ff] text-white px-6 py-4 border-4 border-[#ff00ff] hover:bg-[#ff33ff] hover:border-[#ff33ff] transition-colors text-left shadow-[4px_4px_0px_0px_rgba(255,0,255,0.5)]"
                style={{ fontFamily: 'Press Start 2P', fontSize: '0.875rem' }}
              >
                MY EXPENSES
              </button>

              <button
                onClick={() => handleNavigate('/')}
                className="w-full bg-[#00ffff] text-black px-6 py-4 border-4 border-[#00ffff] hover:bg-[#33ffff] hover:border-[#33ffff] transition-colors text-left shadow-[4px_4px_0px_0px_rgba(0,255,255,0.5)]"
                style={{ fontFamily: 'Press Start 2P', fontSize: '0.875rem' }}
              >
                CREATE NEW
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">
                CONNECT WALLET TO VIEW MENU
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Overlay - transparent clickable area */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          style={{ background: 'transparent' }}
        />
      )}
    </>
  );
}
