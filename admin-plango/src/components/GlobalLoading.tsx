import React, { useState, useEffect } from 'react';
import { subscribeToLoading } from '../lib/api';

const GlobalLoading: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Subscribe to global loading state from API client
    return subscribeToLoading((loading) => {
      setIsLoading(loading);
    });
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Top progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 z-50 overflow-hidden bg-primary/20">
        <div className="h-full bg-primary animate-[loading_1.5s_infinite_linear] origin-left w-full"></div>
      </div>

      {/* Subtle backdrop slightly blocking interaction if appropriate, 
          but usually for mutations we want a subtle spinner too */}
      <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[1px] pointer-events-auto flex items-center justify-center">
        <div className="bg-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-100">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-700">Đang xử lý...</span>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default GlobalLoading;
