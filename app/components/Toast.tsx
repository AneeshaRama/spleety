'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    success: 'border-[#00ff00] bg-[#001a00] text-[#00ff00]',
    error: 'border-[#ff0066] bg-[#1a0010] text-[#ff0066]',
    info: 'border-[#00ffff] bg-[#001a1a] text-[#00ffff]',
  };

  const icons = {
    success: '✓',
    error: '✗',
    info: 'ℹ',
  };

  return (
    <div
      className={`fixed bottom-8 right-8 z-50 min-w-[300px] max-w-[500px] pixel-card ${typeStyles[type]} animate-slide-in`}
      style={{
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <div className="flex items-start gap-4">
        <div className="text-3xl flex-shrink-0">{icons[type]}</div>
        <div className="flex-1">
          <p className="text-sm leading-relaxed break-words">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-xl hover:scale-110 transition-transform flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
