import React, { useState, useCallback } from 'react';
import { X, Save, Shield, DollarSign, Cpu, Zap } from 'lucide-react';
import { postMessage } from '../utils/vscodeApi';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentProvider: string;
  currentModel: string;
  models: Array<{ id: string; name: string; provider: string }>;
}

interface AutoApproveSettings {
  yoloMode: boolean;
  readFiles: boolean;
  readFilesExternally: boolean;
  editFiles: boolean;
  editFilesExternally: boolean;
  executeSafeCommands: boolean;
  executeAllCommands: boolean;
  useBrowser: boolean;
  useMcp: boolean;
  enableNotifications: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  currentProvider,
  currentModel,
  models,
}) => {
  const [provider, setProvider] = useState(currentProvider);
  const [model, setModel] = useState(currentModel);
  const [budget, setBudget] = useState('1.00');
  const [autoApprove, setAutoApprove] = useState<AutoApproveSettings>({
    yoloMode: false,
    readFiles: true,
    readFilesExternally: false,
    editFiles: false,
    editFilesExternally: false,
    executeSafeCommands: true,
    executeAllCommands: false,
    useBrowser: false,
    useMcp: false,
    enableNotifications: false,
  });

  const providers = [
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'google', name: 'Google Gemini' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'ollama', name: 'Ollama (Local)' },
  ];

  const filteredModels = models.filter(m => m.provider === provider);

  const handleSave = useCallback(() => {
    postMessage({ type: 'selectModel', provider, model });
    postMessage({ type: 'updateSettings', settings: { budget: parseFloat(budget), autoApprove } });
    onClose();
  }, [provider, model, budget, autoApprove, onClose]);

  const handleSetApiKey = useCallback(() => {
    postMessage({ type: 'setApiKey', provider });
  }, [provider]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'var(--vscode-editor-background)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--vscode-panel-border)' }}
      >
        <span className="font-medium text-sm">Settings</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:opacity-80"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Model Selection */}
        <section>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium" style={{ color: 'var(--vscode-foreground)' }}>
            <Cpu size={12} />
            <span>Model</span>
          </div>
          <div className="space-y-2">
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                const first = models.find(m => m.provider === e.target.value);
                if (first) setModel(first.id);
              }}
              className="w-full px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: 'var(--vscode-dropdown-background)',
                color: 'var(--vscode-dropdown-foreground)',
                border: '1px solid var(--vscode-dropdown-border)',
              }}
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: 'var(--vscode-dropdown-background)',
                color: 'var(--vscode-dropdown-foreground)',
                border: '1px solid var(--vscode-dropdown-border)',
              }}
            >
              {filteredModels.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            <button
              onClick={handleSetApiKey}
              className="w-full px-2 py-1 rounded text-xs text-center"
              style={{
                backgroundColor: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
              }}
            >
              Set API Key for {providers.find(p => p.id === provider)?.name || provider}
            </button>
          </div>
        </section>

        {/* Budget */}
        <section>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium" style={{ color: 'var(--vscode-foreground)' }}>
            <DollarSign size={12} />
            <span>Budget per Task</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>$</span>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              min="0"
              step="0.10"
              className="flex-1 px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
              }}
            />
          </div>
        </section>

        {/* Auto-Approve */}
        <section>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium" style={{ color: 'var(--vscode-foreground)' }}>
            <Shield size={12} />
            <span>Auto-Approve</span>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--vscode-foreground)' }}>
              <input
                type="checkbox"
                checked={autoApprove.yoloMode}
                onChange={(e) => setAutoApprove(prev => ({
                  ...prev,
                  yoloMode: e.target.checked,
                }))}
                className="rounded"
              />
              <Zap size={11} className="text-yellow-500" />
              YOLO Mode (approve everything automatically)
            </label>

            {!autoApprove.yoloMode && (
              <>
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-4" style={{ color: 'var(--vscode-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={autoApprove.readFiles}
                    onChange={(e) => setAutoApprove(prev => ({ ...prev, readFiles: e.target.checked }))}
                    className="rounded"
                  />
                  Read files in workspace
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-4" style={{ color: 'var(--vscode-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={autoApprove.readFilesExternally}
                    onChange={(e) => setAutoApprove(prev => ({ ...prev, readFilesExternally: e.target.checked }))}
                    className="rounded"
                  />
                  Read files outside workspace
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-4" style={{ color: 'var(--vscode-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={autoApprove.editFiles}
                    onChange={(e) => setAutoApprove(prev => ({ ...prev, editFiles: e.target.checked }))}
                    className="rounded"
                  />
                  Edit files in workspace
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-4" style={{ color: 'var(--vscode-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={autoApprove.editFilesExternally}
                    onChange={(e) => setAutoApprove(prev => ({ ...prev, editFilesExternally: e.target.checked }))}
                    className="rounded"
                  />
                  Edit files outside workspace
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-4" style={{ color: 'var(--vscode-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={autoApprove.executeSafeCommands}
                    onChange={(e) => setAutoApprove(prev => ({ ...prev, executeSafeCommands: e.target.checked }))}
                    className="rounded"
                  />
                  Execute safe commands (ls, git, npm, etc.)
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-4" style={{ color: 'var(--vscode-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={autoApprove.executeAllCommands}
                    onChange={(e) => setAutoApprove(prev => ({ ...prev, executeAllCommands: e.target.checked }))}
                    className="rounded"
                  />
                  Execute all commands (including destructive)
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-4" style={{ color: 'var(--vscode-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={autoApprove.useBrowser}
                    onChange={(e) => setAutoApprove(prev => ({ ...prev, useBrowser: e.target.checked }))}
                    className="rounded"
                  />
                  Browser actions
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-4" style={{ color: 'var(--vscode-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={autoApprove.useMcp}
                    onChange={(e) => setAutoApprove(prev => ({ ...prev, useMcp: e.target.checked }))}
                    className="rounded"
                  />
                  MCP tools
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer pl-4" style={{ color: 'var(--vscode-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={autoApprove.enableNotifications}
                    onChange={(e) => setAutoApprove(prev => ({ ...prev, enableNotifications: e.target.checked }))}
                    className="rounded"
                  />
                  Show system notifications for approvals
                </label>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--vscode-panel-border)' }}>
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
          style={{
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
          }}
        >
          <Save size={12} />
          Save Settings
        </button>
      </div>
    </div>
  );
};
