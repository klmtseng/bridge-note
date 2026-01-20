import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { Button } from './components/Button';
import { FeatureModal } from './components/FeatureModal';
import { QRCodeModal } from './components/QRCodeModal';
import { FormatType } from './types';
import LZString from 'lz-string';
import { 
  Copy, 
  Share, 
  Eraser, 
  List, 
  AlignLeft, 
  Type, 
  ArrowUpAZ,
  QrCode,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';

interface SyncData {
  t: string; // text
  i?: string[]; // images (base64)
}

const App: React.FC = () => {
  const [editorHtml, setEditorHtml] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showQR, setShowQR] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [syncData, setSyncData] = useState<SyncData>({ t: '', i: [] });

  const editorRef = useRef<HTMLDivElement>(null);

  // Helper: Convert URL to Base64 (for external images caught in paste)
  const toBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('no ctx'); return; }
        ctx.drawImage(img, 0, 0);
        try {
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
        } catch (e) {
          reject(e); // Tainted canvas
        }
      };
      img.onerror = reject;
    });
  };

  // 1. Initialization Logic
  useEffect(() => {
    const hash = window.location.hash;
    
    const initContent = async () => {
      // A. QR Code Load (New Format)
      if (hash.startsWith('#data=')) {
        try {
          const compressed = hash.substring(6);
          const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
          if (decompressed) {
            const data: SyncData = JSON.parse(decompressed);
            // Construct HTML from Text + Images (Separate visual, but unified in editor)
            let html = `<div>${data.t.replace(/\n/g, '<br/>')}</div>`;
            if (data.i && data.i.length > 0) {
              html += '<div class="mt-4 grid gap-2">';
              data.i.forEach(img => {
                html += `<img src="${img}" class="max-w-full rounded-lg border border-gray-200" /><br/>`;
              });
              html += '</div>';
            }
            setEditorHtml(html);
            if (editorRef.current) editorRef.current.innerHTML = html;
            setStatusMessage('Synced via QR!');
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }
        } catch (e) { console.error(e); }
      }
      
      // B. Local Storage
      const savedHtml = localStorage.getItem('bridgeNoteHtml');
      if (savedHtml) {
        setEditorHtml(savedHtml);
        if (editorRef.current) editorRef.current.innerHTML = savedHtml;
      } else {
        // Fallback: Check legacy separate storage
        const legacyContent = localStorage.getItem('bridgeNoteContent');
        const legacyImagesStr = localStorage.getItem('bridgeNoteImages');
        if (legacyContent || legacyImagesStr) {
          let html = `<div>${(legacyContent || '').replace(/\n/g, '<br/>')}</div>`;
          if (legacyImagesStr) {
            try {
              const imgs: string[] = JSON.parse(legacyImagesStr);
              imgs.forEach(img => {
                html += `<img src="${img}" class="max-w-full rounded-lg border border-gray-200" /><br/>`;
              });
            } catch(e) {}
          }
          setEditorHtml(html);
          if (editorRef.current) editorRef.current.innerHTML = html;
          // Clear legacy
          localStorage.removeItem('bridgeNoteContent');
          localStorage.removeItem('bridgeNoteImages');
        }
      }
    };

    initContent();

    const hasSeenInfo = localStorage.getItem('hasSeenInfo_offline');
    if (!hasSeenInfo) {
      setShowInfo(true);
      localStorage.setItem('hasSeenInfo_offline', 'true');
    }
  }, []);

  // 2. Persist State
  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setEditorHtml(html);
      localStorage.setItem('bridgeNoteHtml', html);
    }
  };

  // 3. Paste Handling
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    // A. Handle Files (Images copied from OS or Screenshots)
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      const items = e.clipboardData.items;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                // Insert Image at Cursor
                const imgTag = `<img src="${event.target!.result}" class="max-w-full my-2 rounded-lg" /><br/>`;
                document.execCommand('insertHTML', false, imgTag);
                handleInput(); // Trigger save
                setStatusMessage('Image pasted!');
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
      return;
    }
    
    // B. Handle Mixed Content (Web Selections) - Default Browser Behavior
    // We let the browser insert the HTML.
    // However, we want to strip dangerous tags if possible, but for MVP local app, 
    // we trust the user's clipboard. 
    // We hook into onInput to save.
    setTimeout(() => {
        handleInput();
        // Scanning for external images could happen here to warn user, 
        // but let's do it on Sync.
    }, 0);

  }, []);

  // 4. Extraction Logic (The "Bridge" part)
  const extractData = async (): Promise<SyncData> => {
    if (!editorRef.current) return { t: '', i: [] };
    
    // Use a clone to parse clean text
    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    
    // Extract Text (innerText gives us cleaner newlines than textContent)
    const text = clone.innerText;

    // Extract Images
    const imgTags = Array.from(clone.querySelectorAll('img'));
    const images: string[] = [];

    for (const img of imgTags) {
      const src = img.getAttribute('src');
      if (!src) continue;

      if (src.startsWith('data:')) {
        images.push(src);
      } else {
        // External URL: Try to convert to Base64
        try {
          const base64 = await toBase64(src);
          images.push(base64);
        } catch (e) {
          console.warn('CORS prevented image export:', src);
          // If we can't export it, we skip it for the "Offline Sync".
          // The user still sees it in the editor, but it won't cross the bridge.
        }
      }
    }

    return { t: text, i: images };
  };

  // 5. Actions
  const handleFormat = (type: FormatType) => {
    document.execCommand('styleWithCSS', false, 'true');
    switch (type) {
      case FormatType.BULLETS:
        document.execCommand('insertUnorderedList');
        break;
      case FormatType.CLEANUP:
        // Basic cleanup: remove double spaces? 
        // Hard to do in contentEditable without resetting cursor.
        // Let's just strip styles.
        document.execCommand('removeFormat');
        setStatusMessage('Styles removed');
        break;
      case FormatType.UPPERCASE:
        // Applies to selection
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            const text = selection.toString().toUpperCase();
            document.execCommand('insertText', false, text);
        } else {
            setStatusMessage('Select text first');
        }
        break;
      case FormatType.LOWERCASE:
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
            const text = sel.toString().toLowerCase();
            document.execCommand('insertText', false, text);
        } else {
            setStatusMessage('Select text first');
        }
        break;
    }
    handleInput();
  };

  const prepareQR = async () => {
    setIsProcessing(true);
    setStatusMessage('Preparing data...');
    try {
      const data = await extractData();
      setSyncData(data);
      setShowQR(true);
    } catch (e) {
      setStatusMessage('Error preparing data');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  const handleCopyText = async () => {
     if (!editorRef.current) return;
     try {
       await navigator.clipboard.writeText(editorRef.current.innerText);
       setStatusMessage('Text copied!');
       setTimeout(() => setStatusMessage(''), 2000);
     } catch (e) {
       setStatusMessage('Copy failed');
     }
  };

  const handleShare = async () => {
    setIsProcessing(true);
    try {
      const data = await extractData();
      
      if (!data.t && data.i?.length === 0) {
        setStatusMessage('Nothing to share');
        return;
      }

      if (navigator.share) {
        const shareData: ShareData = {
          title: 'BridgeNote',
          text: data.t,
        };

        if (data.i && data.i.length > 0) {
           const files = data.i.map((base64, idx) => {
             const arr = base64.split(',');
             const mime = arr[0].match(/:(.*?);/)![1];
             const bstr = atob(arr[1]);
             let n = bstr.length;
             const u8arr = new Uint8Array(n);
             while(n--){
               u8arr[n] = bstr.charCodeAt(n);
             }
             const ext = mime.split('/')[1] || 'png';
             return new File([u8arr], `image-${idx}.${ext}`, { type: mime });
           });
           
           if (navigator.canShare && navigator.canShare({ files })) {
             shareData.files = files;
           }
        }
        
        await navigator.share(shareData);
        setStatusMessage('Shared!');
      } else {
        await navigator.clipboard.writeText(data.t);
        setStatusMessage('Copied (Share API unsupported)');
      }
    } catch (e) {
      console.log(e);
      setStatusMessage('Share cancelled');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear all content?')) {
      setEditorHtml('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      localStorage.removeItem('bridgeNoteHtml');
      // Also clear legacy
      localStorage.removeItem('bridgeNoteContent');
      localStorage.removeItem('bridgeNoteImages');
    }
  };

  return (
    <div className="min-h-screen pb-24 sm:pb-20">
      <TopBar />
      <FeatureModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
      {/* Pass calculated syncData to Modal */}
      <QRCodeModal isOpen={showQR} onClose={() => setShowQR(false)} data={syncData} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6">
        
        {/* Editor Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6 flex flex-col h-[50vh] sm:h-[450px]">
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex justify-between items-center flex-shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {statusMessage || 'Editor'}
            </span>
            <button 
              onClick={() => setShowInfo(true)} 
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              How it works?
            </button>
          </div>
          
          <div 
            className="flex-grow overflow-y-auto p-4 cursor-text"
            onClick={() => editorRef.current?.focus()}
          >
             <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onPaste={handlePaste}
                className="outline-none text-gray-800 text-lg leading-relaxed min-h-full empty:before:content-[attr(placeholder)] empty:before:text-gray-300"
                placeholder="Paste text or images here..."
                spellCheck={false}
             />
          </div>

          <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 flex-shrink-0">
             <div className="flex gap-3">
               <span>Rich Text Mode</span>
             </div>
             <button onClick={handleClear} className="flex items-center gap-1 hover:text-red-500 transition-colors">
               <Eraser size={12} /> Clear
             </button>
          </div>
        </div>

        {/* Local Tools Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3 px-1">
             <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Type size={14} className="text-gray-500" />
                Formatting
             </h2>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button 
              variant="secondary" 
              onClick={() => handleFormat(FormatType.CLEANUP)}
              icon={<AlignLeft size={16} className="text-blue-500" />}
            >
              Clean
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => handleFormat(FormatType.BULLETS)}
              icon={<List size={16} className="text-purple-500" />}
            >
              List
            </Button>
             <Button 
              variant="secondary" 
              onClick={() => handleFormat(FormatType.UPPERCASE)}
              icon={<ArrowUpAZ size={16} className="text-orange-500" />}
            >
              UPPER
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => handleFormat(FormatType.LOWERCASE)}
              icon={<Type size={16} className="text-green-500" />}
            >
              lower
            </Button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 sm:static sm:bg-transparent sm:border-0 sm:p-0 z-20">
          <div className="max-w-3xl mx-auto grid grid-cols-2 gap-4">
             {/* Desktop: Show QR Sync. Mobile: Show Copy Text */}
             <div className="hidden sm:block">
               <Button 
                variant="secondary" 
                onClick={prepareQR}
                isLoading={isProcessing}
                className="w-full"
                icon={<QrCode size={18} />}
              >
                Mobile Sync
              </Button>
             </div>
             <div className="block sm:hidden">
               <Button 
                variant="secondary" 
                onClick={handleCopyText}
                className="w-full"
                icon={<Copy size={18} />}
              >
                Copy Text
              </Button>
             </div>

            <Button 
              variant="primary" 
              onClick={handleShare}
              isLoading={isProcessing}
              className="w-full shadow-blue-200 shadow-lg"
              icon={<Share size={18} />}
            >
              Send to iPhone
            </Button>
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;