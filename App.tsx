import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Button } from './components/Button';
import { FeatureModal } from './components/FeatureModal';
import { QRCodeModal } from './components/QRCodeModal';
import { FormatType } from './types';
import { 
  Copy, 
  Share, 
  Eraser, 
  List, 
  AlignLeft, 
  Type, 
  ArrowUpAZ,
  QrCode
} from 'lucide-react';

const App: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showQR, setShowQR] = useState<boolean>(false);

  // Load from local storage or URL Hash on mount
  useEffect(() => {
    // 1. Check for incoming data from QR Code (URL Hash)
    const hash = window.location.hash;
    if (hash.startsWith('#note=')) {
      try {
        const encodedContent = hash.substring(6); // remove '#note='
        const decodedContent = decodeURIComponent(encodedContent);
        setContent(decodedContent);
        setStatusMessage('Note imported from QR Code!');
        // Clear hash so it doesn't persist on reload
        window.history.replaceState(null, '', window.location.pathname);
        return; // Skip loading local storage if we imported data
      } catch (e) {
        console.error("Failed to decode note from URL", e);
      }
    }

    // 2. Fallback to Local Storage
    const savedContent = localStorage.getItem('bridgeNoteContent');
    if (savedContent) {
      setContent(savedContent);
    }

    // Show info modal on first visit
    const hasSeenInfo = localStorage.getItem('hasSeenInfo_offline');
    if (!hasSeenInfo) {
      setShowInfo(true);
      localStorage.setItem('hasSeenInfo_offline', 'true');
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('bridgeNoteContent', content);
  }, [content]);

  const handleFormat = (type: FormatType) => {
    if (!content) return;
    
    let newContent = content;

    switch (type) {
      case FormatType.CLEANUP:
        // Remove extra spaces and trim lines
        newContent = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n\n');
        setStatusMessage('Cleaned up whitespace');
        break;
      case FormatType.BULLETS:
        // Add dashes to lines that don't have them
        newContent = content
          .split('\n')
          .map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            return trimmed.startsWith('-') || trimmed.startsWith('•') 
              ? trimmed 
              : `- ${trimmed}`;
          })
          .filter(Boolean)
          .join('\n');
        setStatusMessage('Converted to list');
        break;
      case FormatType.UPPERCASE:
        newContent = content.toUpperCase();
        setStatusMessage('Uppercased');
        break;
      case FormatType.LOWERCASE:
        newContent = content.toLowerCase();
        setStatusMessage('Lowercased');
        break;
    }

    setContent(newContent);
    setTimeout(() => setStatusMessage(''), 2000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setStatusMessage('Copied to clipboard!');
      setTimeout(() => setStatusMessage(''), 2000);
    } catch (err) {
      setStatusMessage('Failed to copy');
    }
  };

  const handleShare = async () => {
    if (!content.trim()) {
      setStatusMessage('Nothing to share');
      return;
    }

    // Detect if we are likely on a desktop (no navigator.share usually, or we want to prioritize QR)
    // However, some desktops have share. Let's rely on user intent. 
    // If share fails or isn't available, we fallback to copy.
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Note from BridgeNote',
          text: content,
        });
        setStatusMessage('Shared successfully');
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      // Fallback for desktop
      handleCopy();
      setStatusMessage('Copied! Use "Mobile Sync" to transfer.');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the note?')) {
      setContent('');
      localStorage.removeItem('bridgeNoteContent');
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <TopBar />
      <FeatureModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
      <QRCodeModal isOpen={showQR} onClose={() => setShowQR(false)} content={content} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6">
        
        {/* Editor Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {statusMessage || 'Editor'}
            </span>
            <button 
              onClick={() => setShowInfo(true)} 
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              How does syncing work?
            </button>
          </div>
          
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste web content here..."
            className="w-full h-[50vh] sm:h-[400px] p-4 resize-none outline-none text-gray-800 text-lg leading-relaxed placeholder:text-gray-300"
            spellCheck={false}
          />
          
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
             <span>{content.length} characters</span>
             <button onClick={handleClear} className="flex items-center gap-1 hover:text-red-500 transition-colors">
               <Eraser size={12} /> Clear
             </button>
          </div>
        </div>

        {/* Local Tools Section */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1 uppercase tracking-wider flex items-center gap-2">
            <Type size={14} className="text-gray-500" />
            Formatting Tools
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button 
              variant="secondary" 
              onClick={() => handleFormat(FormatType.CLEANUP)}
              icon={<AlignLeft size={16} className="text-blue-500" />}
            >
              Trim
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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 sm:static sm:bg-transparent sm:border-0 sm:p-0">
          <div className="max-w-3xl mx-auto grid grid-cols-2 gap-4">
             {/* Desktop: Show QR Sync Button. Mobile: Show Copy */}
             <div className="hidden sm:block">
               <Button 
                variant="secondary" 
                onClick={() => setShowQR(true)}
                className="w-full"
                icon={<QrCode size={18} />}
                disabled={!content.trim()}
              >
                Mobile Sync
              </Button>
             </div>
             <div className="block sm:hidden">
               <Button 
                variant="secondary" 
                onClick={handleCopy}
                className="w-full"
                icon={<Copy size={18} />}
              >
                Copy
              </Button>
             </div>

            <Button 
              variant="primary" 
              onClick={handleShare}
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