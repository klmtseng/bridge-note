import React from 'react';
import QRCode from 'react-qr-code';
import { X, Smartphone } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, content }) => {
  if (!isOpen) return null;

  // Generate the URL with the content in the hash
  // We use hash so the data isn't sent to the server (if there was one), it stays client-side
  const getSyncUrl = () => {
    const baseUrl = window.location.href.split('#')[0];
    const encodedContent = encodeURIComponent(content);
    return `${baseUrl}#note=${encodedContent}`;
  };

  const syncUrl = getSyncUrl();
  const isTooLong = syncUrl.length > 2000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-2 text-blue-600 mb-4">
          <Smartphone size={24} />
          <h3 className="text-lg font-bold text-gray-900">Scan with iPhone</h3>
        </div>

        {isTooLong ? (
          <div className="h-64 flex items-center justify-center text-center text-red-500 px-4">
            <p>This note is too long for a QR code.<br/>Please shorten it to sync.</p>
          </div>
        ) : (
          <div className="bg-white p-2 rounded-lg shadow-inner border border-gray-100">
            <QRCode 
              value={syncUrl} 
              size={200}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              viewBox={`0 0 256 256`}
            />
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6 leading-relaxed">
          1. Open <strong>Camera</strong> on iPhone<br/>
          2. Tap the link to open this note<br/>
          3. Tap <strong>"Send to iPhone"</strong> on your phone
        </p>
      </div>
    </div>
  );
};