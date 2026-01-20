import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface FeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeatureModal: React.FC<FeatureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl scale-100 transform transition-all">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 text-green-600">
            <ShieldCheck size={24} />
            <h3 className="text-lg font-bold text-gray-900">Private & Offline</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-4 text-gray-600 text-sm">
          <p>
            This app is now running in <strong>Offline Mode</strong>. No API keys are required, and no data leaves your device until you choose to share it.
          </p>
          <p className="font-medium text-gray-800">
            How to save to iPhone Notes?
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Edit your text using the format tools.</li>
            <li>Tap <strong>"Send to iPhone"</strong>.</li>
            <li>Select <strong>"Notes"</strong> from the iOS Share Sheet.</li>
          </ul>
          <p className="text-xs text-gray-400 mt-2">
            *Direct background sync is restricted by Apple security policies, so the Share Sheet is the most secure bridge available.
          </p>
        </div>

        <button 
          onClick={onClose}
          className="mt-6 w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};