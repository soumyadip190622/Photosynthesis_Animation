import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  X,
  Sparkles,
  Zap,
  BrainCircuit,
  RotateCcw,
} from 'lucide-react';
import { SimulationInputs, SimulationOutputs } from '../model/photosynthesisModel';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

interface BiologyChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputs: SimulationInputs;
  outputs: SimulationOutputs;
  savedCount: number;
  theme: 'dark' | 'light';
}

const SUGGESTED_BIOLOGY_PROMPTS = [
  'Analyze my current simulator settings and explain what is limiting the rate.',
  'Why does the photosynthesis curve flatten above 60 klux (Blackman’s Law)?',
  'How does RuBisCO work and why does high temperature increase photorespiration?',
  'Compare C3, C4, and CAM plants under drought and high sunlight.',
  'How do Photosystem II and Photosystem I cooperate in the Z-scheme?',
];

export const BiologyChatbotModal: React.FC<BiologyChatbotModalProps> = ({
  isOpen,
  onClose,
  inputs,
  outputs,
  savedCount,
  theme,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'model',
      text: `Hello! I am your **Light & Leaf Biology & Plant Physiology Consultant**. I have live access to your simulator state (**${inputs.lightKlux} klux**, **${outputs.activeRate.toFixed(2)} µmol CO₂ m⁻² s⁻¹**, **${outputs.limitingFactor.factor}**).\n\nAsk me anything about your experiment, why the curve flattens, thylakoid electron transport, RuBisCO kinetics, or any topic in biology!`,
      timestamp: 'Just now',
      modelUsed: 'gemini-3.8-flash',
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [modelTier, setModelTier] = useState<'general' | 'fast'>('general');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelTier,
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          simContext: {
            lightKlux: inputs.lightKlux,
            co2Ppm: inputs.co2Ppm,
            temperatureC: inputs.temperatureC,
            waterPct: inputs.waterPct,
            mode: inputs.mode,
            activeRate: outputs.activeRate,
            baselineRate: outputs.baselineRate,
            analyticalSlope: outputs.analyticalSlope,
            limitingFactor: outputs.limitingFactor.factor,
            savedCount,
          },
        }),
      });

      const data = await response.json();
      const botMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply || 'Unable to generate response right now.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.modelUsed || 'gemini-3.8-flash',
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: `At **${inputs.lightKlux} klux**, the modeled photosynthetic rate is **${outputs.activeRate.toFixed(2)} µmol CO₂ m⁻² s⁻¹** with local slope **${outputs.analyticalSlope.toFixed(3)} µmol m⁻² s⁻¹ klux⁻¹**. Primary limiting factor: **${outputs.limitingFactor.factor}**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'local-physiological-engine',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="biology-consultant-title"
    >
      <div
        className={`w-full max-w-lg h-full flex flex-col border-l shadow-2xl ${
          theme === 'dark'
            ? 'bg-[#0b1812] border-emerald-900/60 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Drawer Header */}
        <div
          className={`px-4 py-3.5 border-b flex items-center justify-between gap-3 ${
            theme === 'dark' ? 'border-emerald-900/50 bg-[#08120e]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 id="biology-consultant-title" className="text-sm font-bold">
                Gemini Biology &amp; Photosynthesis Consultant
              </h2>
              <p className="text-[11px] text-slate-400">
                Synchronized with live simulator state ({inputs.lightKlux} klux ·{' '}
                {outputs.activeRate.toFixed(1)} µmol/m²/s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    id: 'reset-msg',
                    role: 'model',
                    text: `Conversation cleared. Current simulator state: **${inputs.lightKlux} klux**, **${outputs.activeRate.toFixed(2)} µmol CO₂ m⁻² s⁻¹** (${outputs.limitingFactor.factor}). How can I help with your biology questions?`,
                    timestamp: 'Just now',
                    modelUsed: 'gemini-3.8-flash',
                  },
                ])
              }
              title="Reset Chat History"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Biology Consultant"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Model Selector & Live Telemetry Bar */}
        <div
          className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
            theme === 'dark' ? 'border-emerald-900/40 bg-[#0d1d16]' : 'border-slate-200 bg-slate-100'
          }`}
        >
          <span className="text-[11px] text-slate-400">Response Mode:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setModelTier('general')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                modelTier === 'general'
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BrainCircuit className="w-3 h-3" />
              <span>Detailed Biology (Gemini 3.8 Flash)</span>
            </button>
            <button
              type="button"
              onClick={() => setModelTier('fast')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                modelTier === 'fast'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Fast (3.1 Flash-Lite)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Conversation Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-emerald-500 text-slate-950 font-medium'
                    : theme === 'dark'
                    ? 'bg-[#12261d] border border-emerald-800/50 text-slate-100'
                    : 'bg-slate-100 border border-slate-200 text-slate-800'
                }`}
              >
                {msg.text.split(/(\*\*.*?\*\*)/g).map((part, idx) =>
                  part.startsWith('**') && part.endsWith('**') ? (
                    <strong key={idx} className="font-semibold text-emerald-300">
                      {part.slice(2, -2)}
                    </strong>
                  ) : (
                    <React.Fragment key={idx}>{part}</React.Fragment>
                  )
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <span>{msg.role === 'user' ? 'You' : 'Biology Consultant'}</span>
                <span>·</span>
                <span>{msg.timestamp}</span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono p-2">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Synthesizing plant physiology response...</span>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Quick-Ask Biology Prompt Starters */}
        <div
          className={`px-4 py-2.5 border-t space-y-1.5 ${
            theme === 'dark' ? 'border-emerald-900/40 bg-[#09140f]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-medium text-slate-400">
            Quick Biology &amp; Experiment Questions:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_BIOLOGY_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={isLoading}
                className={`text-left px-2.5 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'border-emerald-800/50 bg-[#10231a] text-emerald-200 hover:bg-emerald-900/50'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(inputText);
          }}
          className={`p-3 border-t flex items-center gap-2 ${
            theme === 'dark' ? 'border-emerald-900/50 bg-[#08120e]' : 'border-slate-200 bg-white'
          }`}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask any biology, photosynthesis, or simulator question..."
            aria-label="Biology question input"
            className={`flex-1 px-3 py-2 rounded-lg text-xs border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              theme === 'dark'
                ? 'bg-[#0e1f18] border-emerald-800/60 text-white placeholder-slate-400'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
};
