import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Zap, Clock, ToggleLeft, ToggleRight, Loader2, ChevronDown } from 'lucide-react';
import type { AgentState, CostInfo, ModelCatalogEntry } from '../hooks/useChat';

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google Gemini',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (Local)',
};

interface TaskHeaderProps {
  agentState: AgentState;
  cost: CostInfo;
  mode: 'act' | 'plan';
  models: ModelCatalogEntry[];
  currentProvider: string;
  currentModel: string;
  onToggleMode: () => void;
  onSelectModel: (provider: string, model: string) => void;
}

export const TaskHeader: React.FC<TaskHeaderProps> = ({
  agentState, cost, mode, models, currentProvider, currentModel, onToggleMode, onSelectModel,
}) => {
  const [showModelPicker, setShowModelPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const stateLabel = (() => {
    switch (agentState) {
      case 'thinking': return 'Thinking...';
      case 'streaming': return 'Writing...';
      case 'tool_calling': return 'Using tool...';
      case 'awaiting_approval': return 'Awaiting approval';
      case 'error': return 'Error';
      default: return 'Ready';
    }
  })();

  const isActive = agentState !== 'idle';

  const currentModelEntry = models.find((m) => m.id === currentModel && m.provider === currentProvider);
  const displayModelName = currentModelEntry?.name || currentModel;

  const providerGroups = useMemo(() => models.reduce<Record<string, ModelCatalogEntry[]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {}), [models]);

  return (
    <div
      className="flex flex-col border-b"
      style={{ borderColor: 'var(--vscode-panel-border, rgba(128,128,128,0.2))', position: 'relative', zIndex: 100 }}
    >
      {/* Row 1: Status + Mode + Cost */}
      <div className="flex items-center justify-between px-3 py-1.5 text-[10px]">
        <div className="flex items-center gap-1.5">
          {isActive ? (
            <Loader2 size={10} className="animate-spin" style={{ color: 'var(--vscode-charts-yellow)' }} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--vscode-charts-green)' }} />
          )}
          <span className={isActive ? 'opacity-80' : 'opacity-50'}>{stateLabel}</span>
        </div>

        <button
          onClick={onToggleMode}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
          title={mode === 'act' ? 'Switch to Plan Mode' : 'Switch to Act Mode'}
        >
          {mode === 'act' ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
          <span className="font-medium">{mode === 'act' ? 'Act' : 'Plan'}</span>
        </button>

        <div className="flex items-center gap-2 opacity-50">
          <span className="flex items-center gap-0.5">
            <Zap size={9} />
            {((cost.inputTokens + cost.outputTokens) / 1000).toFixed(1)}K
          </span>
          <span className="flex items-center gap-0.5">
            <Clock size={9} />
            ${cost.estimatedCost.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Row 2: Model selector */}
      <div className="relative px-3 pb-1.5" ref={pickerRef}>
        <button
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] w-full hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderColor: 'var(--vscode-input-border, var(--vscode-panel-border, rgba(128,128,128,0.3)))',
            border: '1px solid',
          }}
          title="Select model"
        >
          <span className="truncate flex-1 text-left opacity-70">{displayModelName}</span>
          <ChevronDown size={10} className="opacity-50 flex-shrink-0" />
        </button>

        {showModelPicker && (
          <div
            className="absolute left-3 right-3 top-full z-50 mt-0.5 rounded-md border shadow-lg overflow-y-auto"
            style={{
              maxHeight: '300px',
              backgroundColor: 'var(--vscode-dropdown-background, var(--vscode-input-background))',
              borderColor: 'var(--vscode-dropdown-border, var(--vscode-input-border, rgba(128,128,128,0.3)))',
            }}
          >
            {Object.entries(providerGroups).map(([provider, providerModels]) => (
              <div key={provider}>
                <div
                  className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider opacity-50"
                  style={{ backgroundColor: 'var(--vscode-sideBar-background, transparent)' }}
                >
                  {PROVIDER_LABELS[provider] || provider}
                </div>
                {providerModels.map((m) => (
                  <button
                    key={`${m.provider}-${m.id}`}
                    onClick={() => {
                      onSelectModel(m.provider, m.id);
                      setShowModelPicker(false);
                    }}
                    className="flex items-center justify-between w-full px-2 py-1 text-[10px] hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor:
                        m.id === currentModel && m.provider === currentProvider
                          ? 'var(--vscode-list-activeSelectionBackground, rgba(0,120,212,0.3))'
                          : 'transparent',
                      color:
                        m.id === currentModel && m.provider === currentProvider
                          ? 'var(--vscode-list-activeSelectionForeground, inherit)'
                          : 'inherit',
                    }}
                  >
                    <span className="truncate">
                      {m.name}
                      {!m.supportsToolUse && <span title="No native tool support (uses XML fallback)"> ⚠</span>}
                    </span>
                    <span className="opacity-40 ml-2 flex-shrink-0">
                      {m.contextWindow >= 1000000
                        ? `${(m.contextWindow / 1000000).toFixed(1)}M`
                        : `${(m.contextWindow / 1000).toFixed(0)}K`}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
