import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, RefreshCw, Eye, Code, Search, Palette, Sliders, Copy, Check } from 'lucide-react';
import { parseCssVariables, patchCss, type CssVariable } from './utils/cssParser';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

function App() {
  const [originalCss, setOriginalCss] = useState<string>('');
  const [variables, setVariables] = useState<CssVariable[]>([]);
  const [modifiedValues, setModifiedValues] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Ref for the preview iframe
  const previewRef = useRef<HTMLIFrameElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setOriginalCss(text);
      const parsed = parseCssVariables(text);
      setVariables(parsed);
      
      // Initialize modified values with original raw values
      const initialValues: Record<string, string> = {};
      parsed.forEach(v => {
        initialValues[v.id] = v.value;
      });
      setModifiedValues(initialValues);
      
      if (parsed.length > 0) {
        setSelectedVarId(parsed[0].id);
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    const initialValues: Record<string, string> = {};
    variables.forEach(v => {
      initialValues[v.id] = v.value;
    });
    setModifiedValues(initialValues);
  };

  const handleDownload = () => {
    const patched = patchCss(originalCss, variables, modifiedValues);
    const blob = new Blob([patched], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.css';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    const patched = patchCss(originalCss, variables, modifiedValues);
    navigator.clipboard.writeText(patched).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const updateValue = (id: string, newValue: string) => {
    setModifiedValues(prev => ({
      ...prev,
      [id]: newValue
    }));
  };

  // Update preview when CSS changes
  useEffect(() => {
    if (!previewRef.current || !originalCss) return;
    
    const patched = patchCss(originalCss, variables, modifiedValues);
    const doc = previewRef.current.contentDocument;
    
    if (doc) {
      // Basic HTML structure for preview
      if (!doc.body.innerHTML) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <style id="preview-style"></style>
            </head>
            <body>
              <div class="preview-content">
                <h1>Preview Sandbox</h1>
                <p>Elements here will reflect your CSS changes.</p>
                
                <div class="card">
                  <h2>Card Component</h2>
                  <p>This is a sample card to test variables.</p>
                  <button class="btn">Action Button</button>
                  <button class="btn btn-secondary">Secondary</button>
                </div>
                
                <div class="grid">
                  <div class="box box-1">Box 1</div>
                  <div class="box box-2">Box 2</div>
                  <div class="box box-3">Box 3</div>
                </div>

                <form>
                   <input type="text" placeholder="Input field" />
                   <div class="checkbox-wrapper">
                     <input type="checkbox" checked /> Checkbox
                   </div>
                </form>
              </div>
              
              <!-- Inject some base styles to make the preview usable if the uploaded CSS is partial -->
              <style>
                body { font-family: system-ui, sans-serif; padding: 20px; color: #333; background: #f9f9f9; }
                .card { padding: 20px; border-radius: 8px; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 20px; border: 1px solid #eee; }
                .btn { padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; background: #ddd; }
                .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
                .box { padding: 20px; background: #eee; border-radius: 4px; text-align: center; }
                input[type="text"] { padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
              </style>
            </body>
          </html>
        `);
        doc.close();
      }
      
      const styleEl = doc.getElementById('preview-style');
      if (styleEl) {
        styleEl.textContent = patched;
      }
    }
  }, [originalCss, variables, modifiedValues]);

  const filteredVariables = variables.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.selector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedVar = variables.find(v => v.id === selectedVarId);
  const selectedValue = selectedVar ? modifiedValues[selectedVar.id] : '';

  // Determine input type helper
  const isColor = (val: string) => {
    const v = val.trim();
    return v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl') || ['red', 'blue', 'green', 'white', 'black'].includes(v);
  };
  
  const isNumeric = (val: string) => {
    return /^-?\d*\.?\d+(px|rem|em|%|vh|vw|deg|s|ms)?$/.test(val.trim());
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50 text-neutral-900 font-sans overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 border-b border-neutral-200 bg-white flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white">
            <Sliders size={18} />
          </div>
          <h1 className="font-semibold text-sm tracking-tight">CSS Variable Editor</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="file"
            id="css-upload"
            accept=".css"
            className="hidden"
            onChange={handleFileUpload}
          />
          {!originalCss && (
            <label 
              htmlFor="css-upload"
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-md hover:bg-neutral-800 cursor-pointer transition-colors"
            >
              <Upload size={14} />
              Upload CSS
            </label>
          )}
          
          {originalCss && (
            <>
              <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 text-xs font-medium rounded-md transition-colors"
              >
                <RefreshCw size={14} />
                Reset
              </button>
              <button 
                onClick={() => setShowDiff(!showDiff)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  showDiff ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                <Code size={14} />
                {showDiff ? 'Hide Changes' : 'View Changes'}
              </button>
              <div className="h-4 w-px bg-neutral-200 mx-1" />
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 text-xs font-medium rounded-md transition-colors"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button 
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-md hover:bg-neutral-800 transition-colors"
              >
                <Download size={14} />
                Export
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      {!originalCss ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4 text-neutral-400">
              <Upload size={32} />
            </div>
            <h2 className="text-lg font-medium text-neutral-900 mb-2">Upload a CSS file to start</h2>
            <p className="text-neutral-500 text-sm max-w-md mb-6">
              We'll parse your CSS variables so you can edit them visually. 
              Your file structure will be preserved 100%.
            </p>
            <label 
              htmlFor="css-upload"
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors shadow-sm"
            >
              Select File
            </label>
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Variable List */}
          <div className="w-80 border-r border-neutral-200 bg-white flex flex-col shrink-0">
            <div className="p-3 border-b border-neutral-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-neutral-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Filter variables..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-neutral-300 transition-shadow"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredVariables.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 text-xs">
                  No variables found matching your filter.
                </div>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {filteredVariables.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVarId(v.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors focus:outline-none border-l-2",
                        selectedVarId === v.id 
                          ? "bg-neutral-50 border-neutral-900" 
                          : "border-transparent"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-xs font-medium text-neutral-700 truncate mr-2" title={v.name}>
                          {v.name}
                        </span>
                        {modifiedValues[v.id] !== v.value && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1" />
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider truncate max-w-[120px]">
                          {v.selector}
                        </span>
                        <div className="flex items-center gap-2">
                           {isColor(modifiedValues[v.id]) && (
                             <div 
                               className="w-3 h-3 rounded-full border border-neutral-200 shadow-sm" 
                               style={{ backgroundColor: modifiedValues[v.id].trim() }}
                             />
                           )}
                           <span className="font-mono text-[10px] text-neutral-500 truncate max-w-[80px]">
                             {modifiedValues[v.id].trim()}
                           </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center Panel: Editor */}
          <div className="flex-1 flex flex-col bg-neutral-50 min-w-[300px] border-r border-neutral-200">
            <AnimatePresence mode="wait">
              {selectedVar ? (
                <motion.div 
                  key={selectedVar.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 max-w-2xl mx-auto w-full"
                >
                  <div className="mb-8">
                    <h2 className="text-lg font-semibold text-neutral-900 mb-1 font-mono">{selectedVar.name}</h2>
                    <p className="text-xs text-neutral-500 font-mono">
                      Scope: <span className="bg-neutral-200 px-1.5 py-0.5 rounded text-neutral-700">{selectedVar.selector}</span>
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm space-y-6">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                        Raw Value
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={selectedValue}
                          onChange={(e) => updateValue(selectedVar.id, e.target.value)}
                          className="w-full font-mono text-sm p-3 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    {/* Smart Inputs based on value type */}
                    {isColor(selectedValue) && (
                      <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-100">
                        <div className="flex items-center gap-4">
                          <div className="shrink-0">
                            <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">
                              Color Picker
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedValue.trim().startsWith('#') ? selectedValue.trim() : '#000000'} // Fallback for non-hex
                                onChange={(e) => updateValue(selectedVar.id, e.target.value)}
                                className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                              />
                            </div>
                          </div>
                          <div className="text-xs text-neutral-500">
                            Detected color value. Use the picker or edit the raw hex/rgb string above.
                          </div>
                        </div>
                      </div>
                    )}

                    {isNumeric(selectedValue) && (
                      <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-100">
                        <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-2">
                          Numeric Adjustment
                        </label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="100" // This is arbitrary without unit parsing, but gives some control
                            step="1"
                            className="w-full accent-neutral-900"
                            onChange={(e) => {
                               // Very basic numeric replacement logic
                               const match = selectedValue.match(/^(-?\d*\.?\d+)(.*)$/);
                               if (match) {
                                 updateValue(selectedVar.id, `${e.target.value}${match[2]}`);
                               }
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-2">
                          Simple slider adjustment. For precise control, use the raw input.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-8">
                    <h3 className="text-xs font-medium text-neutral-900 mb-2">Original Definition</h3>
                    <div className="bg-neutral-900 text-neutral-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                      <span className="text-purple-400">{selectedVar.name}</span>: <span className="text-green-400">{selectedVar.value}</span>;
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center text-neutral-400"
                >
                  <Palette size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">Select a variable to edit</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Panel: Preview or Diff */}
          <div className="w-[400px] bg-white flex flex-col shrink-0 border-l border-neutral-200">
            <div className="p-3 border-b border-neutral-100 bg-neutral-50 flex justify-between items-center">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                {showDiff ? 'Change Log' : 'Live Preview'}
              </h3>
              {!showDiff && (
                <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                  <Eye size={12} />
                  <span>Sandbox</span>
                </div>
              )}
            </div>
            
            <div className="flex-1 relative bg-checkerboard">
              {showDiff ? (
                <div className="absolute inset-0 overflow-y-auto p-4 space-y-4">
                  {variables.filter(v => modifiedValues[v.id] !== v.value).length === 0 ? (
                    <div className="text-center text-neutral-400 text-sm mt-10">
                      No changes made yet.
                    </div>
                  ) : (
                    variables.filter(v => modifiedValues[v.id] !== v.value).map(v => (
                      <div key={v.id} className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                        <div className="font-mono text-xs font-medium text-neutral-700 mb-2">{v.name}</div>
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs font-mono">
                          <div className="bg-red-50 text-red-700 p-1.5 rounded truncate" title={v.value}>
                            {v.value}
                          </div>
                          <div className="text-neutral-300">→</div>
                          <div className="bg-green-50 text-green-700 p-1.5 rounded truncate" title={modifiedValues[v.id]}>
                            {modifiedValues[v.id]}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <iframe 
                  ref={previewRef}
                  title="CSS Preview"
                  className="w-full h-full border-none bg-white"
                  sandbox="allow-same-origin allow-scripts"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
