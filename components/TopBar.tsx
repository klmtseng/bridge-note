import React from 'react';
import { Share2, Smartphone } from 'lucide-react';

export const TopBar: React.FC = () => {
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 sm:px-6 mb-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-yellow-400 rounded-lg text-white shadow-sm">
            <Share2 size={20} className="text-black" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">BridgeNote</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Offline Web to iPhone Staging</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
          <Smartphone size={14} />
          <span>iOS Ready</span>
        </div>
      </div>
    </header>
  );
};