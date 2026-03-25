import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, 
  Play, 
  Download, 
  Settings, 
  Trash2, 
  Plus, 
  Sparkles, 
  Layers, 
  Gamepad2,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Minimize2,
  RefreshCw,
  Zap,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Rect, Sprite, PackedSprite, PackerSettings, AtlasResult } from './types';
import { processSprite, nextPowerOfTwo, removeBackground, stabilizeFrames } from './utils/spriteProcessor';
import { MaxRectsPacker } from './utils/packer';

// --- Components ---

const SpriteFrame: React.FC<{ 
  sprite: Sprite; 
  zoom?: number; 
  offset?: { x: number; y: number };
  className?: string;
}> = ({ sprite, zoom = 1, offset = { x: 0, y: 0 }, className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = sprite.canvas.width * zoom;
    canvas.height = sprite.canvas.height * zoom;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sprite.canvas, 
      0, 0, sprite.canvas.width, sprite.canvas.height,
      offset.x * zoom, offset.y * zoom, canvas.width, canvas.height
    );
  }, [sprite, zoom, offset]);

  return <canvas ref={canvasRef} className={`max-w-full h-auto ${className}`} />;
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'generator' | 'library' | 'playground'>('generator');
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('A pixel art knight character, idle animation, side view, white background');
  const [generatedSheet, setGeneratedSheet] = useState<string | null>(null);
  const [selectedAnim, setSelectedAnim] = useState<string | null>(null);
  
  // Processing Settings
  const [autoCenter, setAutoCenter] = useState(true);
  const [removeBG, setRemoveBG] = useState(false);

  // Packer Settings
  const [settings, setSettings] = useState<PackerSettings>({
    padding: 2,
    allowRotation: false,
    pot: true,
    square: true,
    trim: true,
    maxWidth: 2048,
    maxHeight: 2048
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newSprites: Sprite[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        let sprite = await processSprite(files[i], { trim: settings.trim });
        if (removeBG) {
          sprite.canvas = removeBackground(sprite.canvas);
        }
        newSprites.push(sprite);
      } catch (err) {
        console.error("Error processing sprite:", err);
      }
    }

    const finalSprites = autoCenter ? stabilizeFrames(newSprites) : newSprites;
    setSprites(prev => [...prev, ...finalSprites]);
  };

  const generateWithAI = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setGeneratedSheet(null);

    try {
      const response = await fetch('/api/generate-sprite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate image with OpenAI");
      }

      const data = await response.json();
      setGeneratedSheet(data.image);
    } catch (err: any) {
      console.error("Error generating with OpenAI:", err);
      alert(err.message || "Failed to generate image with OpenAI. Please check your API key in the server environment.");
    } finally {
      setIsGenerating(false);
    }
  };

  const packSprites = (): AtlasResult | null => {
    if (sprites.length === 0) return null;

    // Simple packing logic for now, can be improved with MaxRectsPacker
    let currentWidth = 256;
    let currentHeight = 256;
    
    // Find required size
    const packer = new MaxRectsPacker(currentWidth, currentHeight);
    let packed: PackedSprite[] = [];
    
    const tryPack = (w: number, h: number) => {
      packer.init(w, h);
      const results: PackedSprite[] = [];
      for (const s of sprites) {
        const rect = packer.pack(s.canvas.width, s.canvas.height, settings.padding);
        if (!rect) return null;
        results.push({ ...s, frame: rect });
      }
      return results;
    };

    let results = tryPack(currentWidth, currentHeight);
    while (!results && currentWidth <= settings.maxWidth && currentHeight <= settings.maxHeight) {
      if (currentWidth <= currentHeight) currentWidth *= 2;
      else currentHeight *= 2;
      results = tryPack(currentWidth, currentHeight);
    }

    if (!results) return null;

    return {
      sprites: results,
      width: currentWidth,
      height: currentHeight,
      json: JSON.stringify(results.map(s => ({ name: s.name, frame: s.frame })), null, 2)
    };
  };

  const atlasResult = useMemo(() => packSprites(), [sprites, settings]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 h-full w-20 bg-[#141414] border-right border-white/5 flex flex-col items-center py-8 gap-8 z-50">
        <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Sparkles className="text-white" size={24} />
        </div>
        
        <div className="flex flex-col gap-4">
          <NavButton active={activeTab === 'generator'} onClick={() => setActiveTab('generator')} icon={<Zap size={20} />} label="Gen" />
          <NavButton active={activeTab === 'library'} onClick={() => setActiveTab('library')} icon={<Layers size={20} />} label="Lib" />
          <NavButton active={activeTab === 'playground'} onClick={() => setActiveTab('playground')} icon={<Gamepad2 size={20} />} label="Play" />
        </div>

        <div className="mt-auto">
          <NavButton active={false} onClick={() => {}} icon={<Settings size={20} />} label="Set" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="pl-20 min-h-screen">
        <AnimatePresence mode="wait">
          {activeTab === 'generator' && (
            <motion.div 
              key="generator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-8 max-w-6xl mx-auto"
            >
              <header className="mb-12">
                <h1 className="text-5xl font-bold tracking-tighter mb-2">AnimForge</h1>
                <p className="text-white/50 text-lg">AI-Powered Sprite Sheet Generation</p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Prompt Section */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-[#141414] p-6 rounded-2xl border border-white/5">
                    <label className="block text-xs uppercase tracking-widest text-white/30 font-bold mb-4">Generation Prompt</label>
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-4 h-32 focus:outline-none focus:border-orange-500/50 transition-colors resize-none text-lg"
                      placeholder="Describe your character and animation..."
                    />
                    <div className="mt-4 flex justify-between items-center">
                      <div className="flex gap-2">
                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] uppercase font-bold tracking-wider text-white/40">Pixel Art</span>
                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] uppercase font-bold tracking-wider text-white/40">Side View</span>
                      </div>
                      <button 
                        onClick={generateWithAI}
                        disabled={isGenerating}
                        className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all transform active:scale-95"
                      >
                        {isGenerating ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
                        {isGenerating ? 'Forging...' : 'Generate Sprite'}
                      </button>
                    </div>
                  </div>

                  {/* Preview Area */}
                  <div className="aspect-square bg-[#141414] rounded-2xl border border-white/5 flex items-center justify-center overflow-hidden relative group">
                    {generatedSheet ? (
                      <img src={generatedSheet} alt="Generated" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-center space-y-4 opacity-20 group-hover:opacity-40 transition-opacity">
                        <Sparkles size={64} className="mx-auto" />
                        <p className="font-mono text-sm">Awaiting generation...</p>
                      </div>
                    )}
                    {generatedSheet && (
                      <div className="absolute bottom-6 right-6 flex gap-2">
                        <button className="p-3 bg-black/60 backdrop-blur-md rounded-xl hover:bg-orange-500 hover:text-black transition-all">
                          <Download size={20} />
                        </button>
                        <button className="p-3 bg-black/60 backdrop-blur-md rounded-xl hover:bg-orange-500 hover:text-black transition-all">
                          <Plus size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sidebar Controls */}
                <div className="space-y-6">
                  <div className="bg-[#141414] p-6 rounded-2xl border border-white/5">
                    <label className="block text-xs uppercase tracking-widest text-white/30 font-bold mb-6">Manual Upload</label>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-12 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center gap-4 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group"
                    >
                      <Upload className="text-white/20 group-hover:text-orange-500 transition-colors" size={32} />
                      <span className="text-sm text-white/40 group-hover:text-white/60">Drop frames or click to upload</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" accept="image/*" />
                  </div>

                  <div className="bg-[#141414] p-6 rounded-2xl border border-white/5">
                    <label className="block text-xs uppercase tracking-widest text-white/30 font-bold mb-6">Processing Settings</label>
                    <div className="space-y-4">
                      <SettingToggle label="Auto-Center (Stabilize)" active={autoCenter} onClick={() => setAutoCenter(!autoCenter)} />
                      <SettingToggle label="Remove Background" active={removeBG} onClick={() => setRemoveBG(!removeBG)} />
                    </div>
                  </div>

                  <div className="bg-[#141414] p-6 rounded-2xl border border-white/5">
                    <label className="block text-xs uppercase tracking-widest text-white/30 font-bold mb-6">Packer Settings</label>
                    <div className="space-y-4">
                      <SettingItem label="Padding" value={settings.padding} onChange={(v) => setSettings({...settings, padding: Number(v)})} type="number" />
                      <SettingToggle label="Power of Two" active={settings.pot} onClick={() => setSettings({...settings, pot: !settings.pot})} />
                      <SettingToggle label="Square Atlas" active={settings.square} onClick={() => setSettings({...settings, square: !settings.square})} />
                      <SettingToggle label="Trim Alpha" active={settings.trim} onClick={() => setSettings({...settings, trim: !settings.trim})} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="text-4xl font-bold tracking-tighter">Sprite Library</h2>
                  <p className="text-white/40 mt-2">Manage and preview your animation frames</p>
                </div>
                <div className="flex gap-4">
                  <button className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold transition-colors">Clear All</button>
                  <button className="px-6 py-2 bg-orange-500 text-black rounded-lg text-sm font-bold transition-colors">Export Atlas</button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {sprites.map((sprite) => (
                  <div key={sprite.id} className="bg-[#141414] rounded-xl border border-white/5 p-4 group relative">
                    <div className="aspect-square flex items-center justify-center bg-black/20 rounded-lg mb-3">
                      <SpriteFrame sprite={sprite} />
                    </div>
                    <p className="text-[10px] font-mono text-white/40 truncate">{sprite.name}</p>
                    <button 
                      onClick={() => setSprites(sprites.filter(s => s.id !== sprite.id))}
                      className="absolute top-2 right-2 p-2 bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {sprites.length === 0 && (
                  <div className="col-span-full py-32 text-center opacity-20">
                    <Layers size={48} className="mx-auto mb-4" />
                    <p>No sprites in library yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'playground' && (
            <motion.div 
              key="playground"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="p-8 h-screen flex flex-col"
            >
              <div className="bg-[#141414] flex-1 rounded-3xl border border-white/5 relative overflow-hidden">
                {/* Game Canvas Placeholder */}
                <div className="absolute inset-0 flex items-center justify-center text-center">
                  <div className="space-y-6 max-w-md px-8">
                    <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto text-orange-500">
                      <Gamepad2 size={40} />
                    </div>
                    <h3 className="text-2xl font-bold">Animation Playground</h3>
                    <p className="text-white/40">Test your sprites in a real-time physics environment. Coming soon in the next update!</p>
                    <button className="px-8 py-3 bg-white/5 rounded-xl font-bold hover:bg-white/10 transition-all">
                      Configure Physics
                    </button>
                  </div>
                </div>
                
                {/* HUD Overlay */}
                <div className="absolute top-8 left-8 flex gap-4">
                  <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-mono uppercase tracking-widest text-white/60">Engine Ready</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Helper Components ---

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => {
  return (
    <button 
      onClick={onClick}
      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative group ${active ? 'bg-orange-500/10 text-orange-500' : 'text-white/30 hover:text-white/60'}`}
    >
      {icon}
      <span className="text-[8px] font-bold uppercase tracking-tighter">{label}</span>
      {active && <motion.div layoutId="nav-active" className="absolute -right-2 w-1 h-8 bg-orange-500 rounded-full" />}
    </button>
  );
};

const SettingItem: React.FC<{ label: string; value: any; onChange: (v: any) => void; type: string }> = ({ label, value, onChange, type }) => (
  <div className="flex justify-between items-center">
    <span className="text-xs text-white/40 font-medium">{label}</span>
    <input 
      type={type} 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-xs w-16 text-right focus:outline-none focus:border-orange-500/50"
    />
  </div>
);

const SettingToggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <div className="flex justify-between items-center">
    <span className="text-xs text-white/40 font-medium">{label}</span>
    <button 
      onClick={onClick}
      className={`w-10 h-5 rounded-full transition-all relative ${active ? 'bg-orange-500' : 'bg-white/10'}`}
    >
      <motion.div 
        animate={{ x: active ? 20 : 2 }}
        className="absolute top-1 left-0 w-3 h-3 bg-white rounded-full shadow-sm"
      />
    </button>
  </div>
);
