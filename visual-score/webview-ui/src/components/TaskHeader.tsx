import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Zap, Clock, Loader2, ChevronDown, FileText, Settings2, History, Undo2 } from 'lucide-react';
import type { AgentState, CostInfo, ModelCatalogEntry, ModeInfo } from '../hooks/useChat';

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
  mode: string;
  modeList: ModeInfo[];
  models: ModelCatalogEntry[];
  currentProvider: string;
  currentModel: string;
  activeFile?: { filePath: string; fileName: string } | null;
  onToggleMode: () => void;
  onSwitchMode: (slug: string) => void;
  onSelectModel: (provider: string, model: string) => void;
  onOpenRules?: () => void;
  onShowHistory?: () => void;
  onOpenSettings?: () => void;
  checkpoints?: Array<{ id: string; label: string; timestamp: string; toolName?: string }>;
  onRestoreCheckpoint?: (id: string) => void;
}

export const TaskHeader: React.FC<TaskHeaderProps> = React.memo(({
  agentState, cost, mode, modeList, models, currentProvider, currentModel, activeFile, onToggleMode, onSwitchMode, onSelectModel, onOpenRules, onShowHistory, onOpenSettings, checkpoints, onRestoreCheckpoint,
}) => {
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const modePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
      if (modePickerRef.current && !modePickerRef.current.contains(e.target as Node)) {
        setShowModePicker(false);
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

  const currentModeEntry = modeList.find((m) => m.slug === mode);
  const displayModeName = currentModeEntry?.name || (mode === 'act' ? 'Act' : mode === 'plan' ? 'Plan' : mode);
  const displayModeIcon = currentModeEntry?.icon || (mode === 'act' ? '⚡' : '📋');

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

        <div className="relative" ref={modePickerRef}>
          <button
            onClick={() => {
              if (modeList.length > 0) {
                setShowModePicker(!showModePicker);
              } else {
                onToggleMode();
              }
            }}
            disabled={isActive}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-opacity ${isActive ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'}`}
            title={isActive ? 'Cannot switch mode while task is running' : 'Select mode'}
          >
            <span className="text-[10px]">{displayModeIcon}</span>
            <span className="font-medium">{displayModeName}</span>
            {modeList.length > 0 && <ChevronDown size={8} className="opacity-50" />}
          </button>
          {showModePicker && modeList.length > 0 && (
            <div
              className="absolute left-0 top-full z-50 mt-0.5 rounded-md border shadow-lg overflow-y-auto min-w-[140px]"
              style={{
                maxHeight: '220px',
                backgroundColor: 'var(--vscode-dropdown-background, var(--vscode-input-background))',
                borderColor: 'var(--vscode-dropdown-border, var(--vscode-input-border, rgba(128,128,128,0.3)))',
              }}
            >
              {modeList.map((m) => (
                <button
                  key={m.slug}
                  onClick={() => {
                    onSwitchMode(m.slug);
                    setShowModePicker(false);
                  }}
                  className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] hover:opacity-100 transition-opacity text-left"
                  style={{
                    backgroundColor: m.slug === mode
                      ? 'var(--vscode-list-activeSelectionBackground, rgba(0,120,212,0.3))'
                      : 'transparent',
                    color: m.slug === mode
                      ? 'var(--vscode-list-activeSelectionForeground, inherit)'
                      : 'inherit',
                  }}
                  title={m.description}
                >
                  <span>{m.icon}</span>
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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

      {/* Row 2: Active file + History + Rules */}
      {(activeFile || onOpenRules || onShowHistory) && (
        <div className="flex items-center justify-between px-3 pb-0.5 text-[9px]">
          {activeFile ? (
            <span className="flex items-center gap-1 opacity-40 truncate" title={activeFile.filePath}>
              <FileText size={9} />
              {activeFile.filePath}
            </span>
          ) : <span />}
          <div className="flex items-center gap-2">
            {checkpoints && checkpoints.length > 0 && onRestoreCheckpoint && !isActive && (
              <button
                onClick={() => {
                  const latest = checkpoints[checkpoints.length - 1];
                  if (latest) onRestoreCheckpoint(latest.id);
                }}
                className="flex items-center gap-0.5 opacity-40 hover:opacity-80 transition-opacity"
                title={`Undo last edit: ${checkpoints[checkpoints.length - 1]?.label || 'checkpoint'}`}
              >
                <Undo2 size={9} />
                Undo
              </button>
            )}
            {onShowHistory && (
              <button
                onClick={onShowHistory}
                className="flex items-center gap-0.5 opacity-40 hover:opacity-80 transition-opacity"
                title="Task history"
              >
                <History size={9} />
                History
              </button>
            )}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-0.5 opacity-40 hover:opacity-80 transition-opacity"
                title="Open settings"
              >
                <Settings2 size={9} />
                Settings
              </button>
            )}
            {onOpenRules && (
              <button
                onClick={onOpenRules}
                className="flex items-center gap-0.5 opacity-40 hover:opacity-80 transition-opacity"
                title="Edit global rules (.mitrahelixrules)"
              >
                <FileText size={9} />
                Rules
              </button>
            )}
          </div>
        </div>
      )}

      {/* Row 3: Model selector */}
      <div className="relative px-3 pb-1.5" ref={pickerRef}>
        <button
          onClick={() => !isActive && setShowModelPicker(!showModelPicker)}
          disabled={isActive}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] w-full transition-opacity ${isActive ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'}`}
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderColor: 'var(--vscode-input-border, var(--vscode-panel-border, rgba(128,128,128,0.3)))',
            border: '1px solid',
          }}
          title={isActive ? 'Cannot change model while task is running' : 'Select model'}
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
});
