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

  const { syncUrl, isTooLong, hasImagesError } = useMemo(() => {
    const baseUrl = window.location.href.split('#')[0];
    
    // 1. Try to compress everything (Text + Images)
    const compressedFull = LZString.compressToEncodedURIComponent(JSON.stringify(data));
    const fullUrl = `${baseUrl}#data=${compressedFull}`;

    // Practical QR limit
    if (fullUrl.length < 2200) {
      return { syncUrl: fullUrl, isTooLong: false, hasImagesError: false };
    }

    // 2. If too long and we have images, try compressing ONLY text
    if (data.i && data.i.length > 0) {
      const textData = { t: data.t }; 
      const compressedText = LZString.compressToEncodedURIComponent(JSON.stringify(textData));
      const textUrl = `${baseUrl}#data=${compressedText}`;
      
      if (textUrl.length < 2200) {
        return { syncUrl: textUrl, isTooLong: false, hasImagesError: true };
      }
    }

    return { syncUrl: '', isTooLong: true, hasImagesError: false };
    
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
            <p className="font-medium">Content Too Large</p>
            <p className="text-xs text-gray-500">
              The QR code capacity is exceeded. <br/>
              Please shorten text or remove images to sync.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white p-2 rounded-lg shadow-inner border border-gray-100">
              <QRCode 
                value={syncUrl} 
                size={200}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox={`0 0 256 256`}
              />
            </div>
            
            {hasImagesError && (
              <div className="mt-4 flex items-start gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded-lg">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Images skipped.</strong> Images are too large for the QR code, but text will sync.
                </span>
              </div>
            )}
          </>
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