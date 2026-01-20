import React, { useMemo } from 'react';
import QRCode from 'react-qr-code';
import LZString from 'lz-string';
import { X, Smartphone, AlertTriangle } from 'lucide-react';

interface SyncData {
  t: string;
  i?: string[];
}

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SyncData;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  const { syncUrl, isTooLong, errorMsg } = useMemo(() => {
    const baseUrl = window.location.href.split('#')[0];
    
    // 1. Compress
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
    const url = `${baseUrl}#data=${compressed}`;

    // 2. Check length (Approx 2300 is a safe upper bound for Version 40 QR + reader capability)
    if (url.length < 2300) {
      return { syncUrl: url, isTooLong: false, errorMsg: '' };
    }

    // 3. Fallback: If too long, try stripping images from the HTML string?
    // This logic is complex because images are now embedded in `t`.
    // For now, we return error.
    return { 
      syncUrl: '', 
      isTooLong: true, 
      errorMsg: 'Content is still too large even after compression. Please delete some images or text.' 
    };
    
  }, [data]);


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
          <div className="h-64 flex flex-col items-center justify-center text-center text-red-500 px-4 space-y-2">
            <AlertTriangle size={32} />
            <p className="font-medium">Limit Exceeded</p>
            <p className="text-xs text-gray-500">
              {errorMsg}
            </p>
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