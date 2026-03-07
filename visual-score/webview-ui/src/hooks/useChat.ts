import { useState, useEffect, useCallback, useRef } from 'react';
import { postMessage, onMessage } from '../utils/vscodeApi';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
}

export interface ToolCallInfo {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'approved' | 'rejected' | 'completed' | 'failed';
  result?: { success: boolean; output: string; error?: string };
}

export interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export type AgentState = 'idle' | 'thinking' | 'tool_calling' | 'awaiting_approval' | 'streaming' | 'error';

export interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  supportsToolUse: boolean;
}

export interface WorkflowInfo {
  name: string;
  description: string;
  fileName: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [cost, setCost] = useState<CostInfo>({ inputTokens: 0, outputTokens: 0, estimatedCost: 0 });
  const [pendingApproval, setPendingApproval] = useState<ToolCallInfo | null>(null);
  const [mode, setMode] = useState<'act' | 'plan'>('act');
  const [models, setModels] = useState<ModelCatalogEntry[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('anthropic');
  const [currentModel, setCurrentModel] = useState<string>('claude-sonnet-4-6');
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    const cleanup = onMessage((data: unknown) => {
      const message = data as Record<string, unknown>;
      if (!message || !message.type) return;

      switch (message.type) {
        case 'addMessage': {
          const msg = message.message as ChatMessage;
          setMessages((prev) => {
            const exists = prev.find((m) => m.id === msg.id);
            if (exists) return prev;
            return [...prev, msg];
          });
          break;
        }

        case 'streamToken': {
          const { messageId, token } = message as { messageId: string; token: string; type: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: m.content + token, isStreaming: true }
                : m
            )
          );
          setAgentState('streaming');
          break;
        }

        case 'streamEnd': {
          const { messageId } = message as { messageId: string; type: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, isStreaming: false } : m
            )
          );
          break;
        }

        case 'toolCallStarted': {
          const tc = message.toolCall as ToolCallInfo;
          setMessages((prev) => {
            const lastAssistant = [...prev].reverse().find((m) => m.role === 'assistant');
            if (lastAssistant) {
              return prev.map((m) =>
                m.id === lastAssistant.id
                  ? {
                      ...m,
                      toolCalls: [...(m.toolCalls || []), { ...tc, status: 'running' as const }],
                    }
                  : m
              );
            }
            return prev;
          });
          setAgentState('tool_calling');
          break;
        }

        case 'toolCallCompleted': {
          const { toolCallId, result } = message as {
            toolCallId: string;
            result: { success: boolean; output: string; error?: string };
            type: string;
          };
          setMessages((prev) =>
            prev.map((m) => ({
              ...m,
              toolCalls: m.toolCalls?.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, status: (result.success ? 'completed' : 'failed') as ToolCallInfo['status'], result }
                  : tc
              ),
            }))
          );
          break;
        }

        case 'requestApproval': {
          const tc = message.toolCall as ToolCallInfo;
          setPendingApproval(tc);
          setAgentState('awaiting_approval');
          break;
        }

        case 'taskCompleted': {
          setAgentState('idle');
          setPendingApproval(null);
          break;
        }

        case 'taskError': {
          const errorMsg = message.error as string;
          setMessages((prev) => [
            ...prev,
            {
              id: `error_${Date.now()}`,
              role: 'system',
              content: `Error: ${errorMsg}`,
              timestamp: Date.now(),
            },
          ]);
          setAgentState('idle');
          setPendingApproval(null);
          break;
        }

        case 'costUpdate': {
          const c = message.cost as CostInfo;
          setCost(c);
          break;
        }

        case 'stateUpdate': {
          setAgentState(message.state as AgentState);
          break;
        }

        case 'clearMessages': {
          setMessages([]);
          setCost({ inputTokens: 0, outputTokens: 0, estimatedCost: 0 });
          setAgentState('idle');
          setPendingApproval(null);
          break;
        }

        case 'modelCatalog': {
          const { models: catalogModels, currentProvider: cp, currentModel: cm } = message as {
            models: ModelCatalogEntry[];
            currentProvider: string;
            currentModel: string;
            type: string;
          };
          setModels(catalogModels);
          setCurrentProvider(cp);
          setCurrentModel(cm);
          break;
        }

        case 'workflowList': {
          const { workflows: wf } = message as { workflows: WorkflowInfo[]; type: string };
          setWorkflows(wf);
          break;
        }
      }
    });

    // Signal to extension that React is mounted and ready to receive messages
    postMessage({ type: 'webviewReady' });

    return cleanup;
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || agentState !== 'idle') return;
    postMessage({ type: 'sendMessage', text });
  }, [agentState]);

  const cancelTask = useCallback(() => {
    postMessage({ type: 'cancelTask' });
  }, []);

  const newTask = useCallback(() => {
    postMessage({ type: 'newTask' });
  }, []);

  const approveToolCall = useCallback((toolCallId: string) => {
    postMessage({ type: 'approveToolCall', toolCallId });
    setPendingApproval(null);
  }, []);

  const rejectToolCall = useCallback((toolCallId: string) => {
    postMessage({ type: 'rejectToolCall', toolCallId });
    setPendingApproval(null);
  }, []);

  const toggleMode = useCallback(() => {
    const newMode = mode === 'act' ? 'plan' : 'act';
    setMode(newMode);
    postMessage({ type: 'toggleMode', mode: newMode });
  }, [mode]);

  const selectModel = useCallback((provider: string, model: string) => {
    setCurrentProvider(provider);
    setCurrentModel(model);
    postMessage({ type: 'selectModel', provider, model });
  }, []);

  const runWorkflow = useCallback((workflowName: string, userText: string) => {
    postMessage({ type: 'runWorkflow', workflowName, userText });
  }, []);

  return {
    messages,
    agentState,
    cost,
    pendingApproval,
    mode,
    models,
    currentProvider,
    currentModel,
    workflows,
    sendMessage,
    cancelTask,
    newTask,
    approveToolCall,
    rejectToolCall,
    toggleMode,
    selectModel,
    runWorkflow,
  };
}
