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
  Loader2
} from 'lucide-react';

interface SyncData {
  t: string; // text (now contains simplified HTML)
  i?: string[]; // legacy support
}

const App: React.FC = () => {
  const [editorHtml, setEditorHtml] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showQR, setShowQR] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [syncData, setSyncData] = useState<SyncData>({ t: '', i: [] });

  const editorRef = useRef<HTMLDivElement>(null);

  // Helper: Convert URL to Base64
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
          // Use JPEG with quality 0.7 to reduce size significantly for QR codes
          const dataURL = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataURL);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
    });
  };

  // Helper: Aggressively clean HTML to reduce size
  const cleanHTML = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Recursive function to strip attributes
    const stripAttributes = (node: Node) => {
      if (node.nodeType === 1) { // Element
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        
        // Keep only semantic tags
        if (!['div', 'p', 'br', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'img'].includes(tagName)) {
           // Unwrap other tags (like spans) but keep content
           // Note: simple implementation here, usually we'd unwrap. 
           // For now, we just strip attributes from everything.
        }

        // Remove ALL attributes except 'src' for images
        while (el.attributes.length > 0) {
          const attr = el.attributes[0];
          if (tagName === 'img' && attr.name === 'src') {
             // Keep src, but maybe process it later
             // skip removal
             break; // Since we are iterating 0, we need to handle specific logic
          }
          el.removeAttribute(attr.name);
        }
        
        // Re-add src if it was an image (the loop above is tricky)
        // Better approach:
        const src = el.getAttribute('src');
        // Clear all
        while (el.attributes.length > 0) {
          el.removeAttribute(el.attributes[0].name);
        }
        // Restore src
        if (tagName === 'img' && src) {
          el.setAttribute('src', src);
          el.style.maxWidth = '100%'; // Add back minimal styling for editor view
          el.style.borderRadius = '8px';
        }
      }
      
      node.childNodes.forEach(stripAttributes);
    };

    doc.body.childNodes.forEach(stripAttributes);
    return doc.body.innerHTML;
  };

  // 1. Initialization
  useEffect(() => {
    const hash = window.location.hash;
    
    const initContent = async () => {
      if (hash.startsWith('#data=')) {
        try {
          const compressed = hash.substring(6);
          const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
          if (decompressed) {
            const data: SyncData = JSON.parse(decompressed);
            // Data t is now the full HTML content
            setEditorHtml(data.t);
            if (editorRef.current) editorRef.current.innerHTML = data.t;
            setStatusMessage('Synced via QR!');
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }
        } catch (e) { console.error(e); }
      }
      
      const savedHtml = localStorage.getItem('bridgeNoteHtml');
      if (savedHtml) {
        setEditorHtml(savedHtml);
        if (editorRef.current) editorRef.current.innerHTML = savedHtml;
      }
    };

    initContent();

    const hasSeenInfo = localStorage.getItem('hasSeenInfo_offline');
    if (!hasSeenInfo) {
      setShowInfo(true);
      localStorage.setItem('hasSeenInfo_offline', 'true');
    }
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setEditorHtml(html);
      localStorage.setItem('bridgeNoteHtml', html);
    }
  };

  // 2. Improved Paste Handling
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    e.preventDefault();
    setStatusMessage('Processing paste...');

    // A. Handle Images (Files) directly
    if (e.clipboardData.files.length > 0) {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                const imgTag = `<br/><img src="${event.target!.result}" style="max-width:100%; border-radius:8px;" /><br/>`;
                document.execCommand('insertHTML', false, imgTag);
                handleInput();
                setStatusMessage('Image pasted!');
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
      return;
    }

    // B. Handle Rich Text (Web Paste)
    const pastedHtml = e.clipboardData.getData('text/html');
    const pastedText = e.clipboardData.getData('text/plain');

    if (pastedHtml) {
      // Clean the HTML immediately to remove bloat
      const cleaned = cleanHTML(pastedHtml);
      document.execCommand('insertHTML', false, cleaned);
    } else {
      // Fallback to text
      document.execCommand('insertText', false, pastedText);
    }
    
    handleInput();
    setStatusMessage('Pasted');
  }, []);

  // 3. Extraction with Optimization
  const extractData = async (): Promise<SyncData> => {
    if (!editorRef.current) return { t: '' };
    
    // Clone and finalize HTML for export
    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    
    // Process images
    const imgTags = Array.from(clone.querySelectorAll('img'));
    
    // We try to convert all images to Base64 in-place within the HTML string
    // This makes the 't' property self-contained
    for (const img of imgTags) {
      const src = img.getAttribute('src');
      if (!src) continue;

      // Remove styles for export to save space
      img.removeAttribute('style');
      img.removeAttribute('class');
      // Set width attribute for email/notes compatibility
      img.setAttribute('width', '100%');

      if (!src.startsWith('data:')) {
        try {
          const base64 = await toBase64(src);
          img.setAttribute('src', base64);
        } catch (e) {
          console.warn('Cannot convert image', src);
          // If we can't convert it, we leave the URL. 
          // It might not render on phone if private, but it's better than nothing.
        }
      }
    }

    // Final clean pass to ensure no junk attributes exist in the export
    let finalHtml = clone.innerHTML;
    
    // Very basic minification: remove comments and excessive whitespace
    finalHtml = finalHtml.replace(/<!--[\s\S]*?-->/g, "");
    finalHtml = finalHtml.replace(/>\s+</g, "><");

    return { t: finalHtml };
  };

  const handleFormat = (type: FormatType) => {
    document.execCommand('styleWithCSS', false, 'true');
    switch (type) {
      case FormatType.BULLETS:
        document.execCommand('insertUnorderedList');
        break;
      case FormatType.CLEANUP:
        // Aggressive cleanup button
        if (editorRef.current) {
            const clean = cleanHTML(editorRef.current.innerHTML);
            editorRef.current.innerHTML = clean;
            handleInput();
            setStatusMessage('Content cleaned');
        }
        break;
      case FormatType.UPPERCASE:
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            const text = selection.toString().toUpperCase();
            document.execCommand('insertText', false, text);
        }
        break;
      case FormatType.LOWERCASE:
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
            const text = sel.toString().toLowerCase();
            document.execCommand('insertText', false, text);
        }
        break;
    }
    editorRef.current?.focus();
  };

  const prepareQR = async () => {
    setIsProcessing(true);
    setStatusMessage('Compressing...');
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
      if (!editorRef.current?.innerText.trim() && !editorRef.current?.querySelector('img')) {
        setStatusMessage('Nothing to share');
        return;
      }

      const text = editorRef.current.innerText;
      
      // Share API primarily supports text or files. 
      // Sharing rich HTML via Web Share API is not well supported.
      // We share the plain text, and if there are images, we try to attach them.
      
      const images: File[] = [];
      const imgTags = Array.from(editorRef.current.querySelectorAll('img')) as HTMLImageElement[];
      
      for (let i = 0; i < imgTags.length; i++) {
         const src = imgTags[i].src;
         if (src.startsWith('data:')) {
            const arr = src.split(',');
            const mime = arr[0].match(/:(.*?);/)![1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while(n--){
              u8arr[n] = bstr.charCodeAt(n);
            }
            const ext = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
            images.push(new File([u8arr], `image-${i}.${ext}`, { type: mime }));
         }
      }

      if (navigator.share) {
        const shareData: ShareData = {
          title: 'BridgeNote',
          text: text,
        };

        if (images.length > 0 && navigator.canShare && navigator.canShare({ files: images })) {
             shareData.files = images;
        }
        
        await navigator.share(shareData);
        setStatusMessage('Shared!');
      } else {
        await navigator.clipboard.writeText(text);
        setStatusMessage('Copied Text (Share unsupported)');
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
    }
  };

  return (
    <div className="min-h-screen pb-24 sm:pb-20">
      <TopBar />
      <FeatureModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
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
              Smart Clean
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