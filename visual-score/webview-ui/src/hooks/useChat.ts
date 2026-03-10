import { useState, useEffect, useCallback, useRef } from 'react';
import { postMessage, onMessage, getState, setState } from '../utils/vscodeApi';

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
  result?: { success: boolean; output: string; error?: string; diff?: { filePath: string; original: string; modified: string; isNewFile: boolean; addedLines: number; removedLines: number } };
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

export interface ModeInfo {
  slug: string;
  name: string;
  icon: string;
  description: string;
  isBuiltin: boolean;
}

export interface FileListItem {
  path: string;
  name: string;
  isDirectory: boolean;
}

export interface Attachment {
  type: 'file' | 'folder' | 'url' | 'problems' | 'git' | 'terminal' | 'selection' | 'image';
  value: string;
  displayName?: string;
  mimeType?: string;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  fileReferences: string[];
}

export interface Plan {
  id: string;
  title: string;
  summary: string;
  steps: PlanStep[];
  createdAt: number;
}

interface PersistedState {
  messages?: ChatMessage[];
  cost?: CostInfo;
  mode?: string;
}

function loadPersistedState(): PersistedState {
  try {
    return getState<PersistedState>() ?? {};
  } catch {
    return {};
  }
}

export function useChat() {
  const persisted = useRef(loadPersistedState());
  const [messages, setMessages] = useState<ChatMessage[]>(persisted.current.messages ?? []);
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [cost, setCost] = useState<CostInfo>(persisted.current.cost ?? { inputTokens: 0, outputTokens: 0, estimatedCost: 0 });
  const [pendingApproval, setPendingApproval] = useState<ToolCallInfo | null>(null);
  const [mode, setMode] = useState<string>('act');
  const [models, setModels] = useState<ModelCatalogEntry[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('anthropic');
  const [currentModel, setCurrentModel] = useState<string>('claude-sonnet-4-6');
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileList, setFileList] = useState<FileListItem[]>([]);
  const [folderList, setFolderList] = useState<FileListItem[]>([]);
  const [activeFile, setActiveFile] = useState<{ filePath: string; fileName: string } | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [modeList, setModeList] = useState<ModeInfo[]>([]);
  const [checkpoints, setCheckpoints] = useState<Array<{ id: string; label: string; timestamp: string; toolName?: string }>>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const nonStreaming = messages.map(m => m.isStreaming ? { ...m, isStreaming: false } : m);
    setState<PersistedState>({ messages: nonStreaming, cost, mode });
  }, [messages, cost, mode]);

  const tokenBufferRef = useRef<Map<string, string>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushTokenBuffer = useCallback(() => {
    const buffer = tokenBufferRef.current;
    if (buffer.size === 0) return;
    const entries = Array.from(buffer.entries());
    buffer.clear();
    flushTimerRef.current = null;
    setMessages((prev) =>
      prev.map((m) => {
        const pending = entries.find(([id]) => id === m.id);
        return pending ? { ...m, content: m.content + pending[1], isStreaming: true } : m;
      })
    );
    setAgentState('streaming');
  }, []);

  useEffect(() => {
    const cleanup = onMessage((data: unknown) => {
      const message = data as Record<string, unknown>;
      if (!message || !message.type) return;

      switch (message.type) {
        case 'addMessage': {
          const msg = message.message as ChatMessage;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            if (msg.role === 'user' && prev.length > 0) {
              const last = prev[prev.length - 1];
              if (last.role === 'user' && last.content === msg.content) return prev;
            }
            return [...prev, msg];
          });
          break;
        }

        case 'streamToken': {
          const { messageId, token } = message as { messageId: string; token: string; type: string };
          const buf = tokenBufferRef.current;
          buf.set(messageId, (buf.get(messageId) || '') + token);
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(flushTokenBuffer, 50);
          }
          break;
        }

        case 'streamEnd': {
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          flushTokenBuffer();
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
                      toolCalls: [...(m.toolCalls || []), { ...tc, status: tc.status || ('running' as const) }],
                    }
                  : m
              );
            }
            const placeholder: ChatMessage = {
              id: `assistant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
              toolCalls: [{ ...tc, status: tc.status || ('running' as const) }],
            };
            return [...prev, placeholder];
          });
          setAgentState('tool_calling');
          break;
        }

        case 'toolCallCompleted': {
          const { toolCallId, result } = message as {
            toolCallId: string;
            result: NonNullable<ToolCallInfo['result']>;
            type: string;
          };
          setMessages((prev) =>
            prev.map((m) => {
              if (!m.toolCalls?.some(tc => tc.id === toolCallId)) return m;
              return {
                ...m,
                toolCalls: m.toolCalls!.map((tc) =>
                  tc.id === toolCallId
                    ? { ...tc, status: (result.success ? 'completed' : 'failed') as ToolCallInfo['status'], result }
                    : tc
                ),
              };
            })
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
          const { summary } = message as { summary: string; type: string };
          setMessages((prev) => {
            const updated = prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m);
            if (summary && summary !== 'Agent finished responding.') {
              return [...updated, {
                id: `completion_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                role: 'system' as const,
                content: summary,
                timestamp: Date.now(),
              }];
            }
            return updated;
          });
          setAgentState('idle');
          setPendingApproval(null);
          setFollowUpSuggestions([]);
          break;
        }

        case 'taskError': {
          const errorMsg = message.error as string;
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.isStreaming ? { ...m, isStreaming: false } : m
            );
            return [
              ...updated,
              {
                id: `error_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                role: 'system',
                content: `Error: ${errorMsg}`,
                timestamp: Date.now(),
              },
            ];
          });
          setAgentState('idle');
          setPendingApproval(null);
          setFollowUpSuggestions([]);
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
          setAttachments([]);
          setFileList([]);
          setFolderList([]);
          setFollowUpSuggestions([]);
          setCurrentPlan(null);
          setState<PersistedState>({ messages: [], cost: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 }, mode: 'act' });
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

        case 'fileList': {
          const { files } = message as { files: FileListItem[]; type: string };
          setFileList(files);
          break;
        }

        case 'folderList': {
          const { folders } = message as { folders: FileListItem[]; type: string };
          setFolderList(folders);
          break;
        }

        case 'activeFileInfo': {
          const { filePath, fileName } = message as { filePath: string; fileName: string; type: string };
          setActiveFile({ filePath, fileName });
          break;
        }

        case 'prefillAttachment': {
          const att = message.attachment as Attachment;
          if (att) {
            setAttachments((prev) => {
              if (prev.some((a) => a.type === att.type && a.value === att.value)) return prev;
              return [...prev, att];
            });
          }
          break;
        }

        case 'followUpSuggestions': {
          const { question, suggestions } = message as { question?: string; suggestions: string[]; type: string };
          if (question) {
            setMessages((prev) => {
              const lastAssistant = [...prev].reverse().find((m) => m.role === 'assistant');
              if (lastAssistant && !lastAssistant.content.includes(question)) {
                return prev.map((m) =>
                  m.id === lastAssistant.id
                    ? { ...m, content: m.content ? `${m.content}\n\n${question}` : question }
                    : m
                );
              }
              return prev;
            });
          }
          setFollowUpSuggestions(suggestions || []);
          break;
        }

        case 'askAboutContext': {
          const { text: contextText, attachment: contextAtt } = message as {
            text: string;
            attachment: Attachment;
            type: string;
          };
          if (contextText) {
            const allAtts = contextAtt ? [contextAtt] : [];
            const msg: Record<string, unknown> = { type: 'sendMessage', text: contextText, attachments: allAtts };
            postMessage(msg);
            setAttachments([]);
            setFollowUpSuggestions([]);
          } else if (contextAtt) {
            setAttachments((prev) => {
              if (prev.some((a) => a.type === contextAtt.type && a.value === contextAtt.value)) return prev;
              return [...prev, contextAtt];
            });
          }
          break;
        }

        case 'modeUpdate': {
          const { mode: newMode } = message as { mode: string; type: string };
          setMode(newMode);
          break;
        }

        case 'modeList': {
          const { modes: incomingModes } = message as { modes: ModeInfo[]; type: string };
          setModeList(incomingModes);
          break;
        }

        case 'checkpointCreated': {
          const cp = message.checkpoint as { id: string; label: string; timestamp: string };
          if (cp) {
            setCheckpoints(prev => [...prev, cp]);
          }
          break;
        }

        case 'checkpointList': {
          const cps = message.checkpoints as Array<{ id: string; label: string; timestamp: string; toolName: string }>;
          if (cps) setCheckpoints(cps);
          break;
        }

        case 'checkpointRestored': {
          const result = message.result as { restored: string[]; errors: string[] };
          if (result) {
            const detail = result.restored.length > 0
              ? `Restored ${result.restored.length} file(s): ${result.restored.join(', ')}`
              : 'No files were restored.';
            const errorDetail = result.errors.length > 0
              ? `\nErrors: ${result.errors.join(', ')}`
              : '';
            setMessages(prev => [...prev, {
              id: `checkpoint_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              role: 'system' as const,
              content: `Checkpoint restored. ${detail}${errorDetail}`,
              timestamp: Date.now(),
            }]);
          }
          break;
        }

        case 'planUpdate': {
          const plan = message.plan as Plan;
          if (plan) setCurrentPlan(plan);
          break;
        }

        case 'updateMessageContent': {
          const { messageId: msgId, content: newContent } = message as {
            messageId: string; content: string; type: string;
          };
          setMessages(prev =>
            prev.map(m => m.id === msgId ? { ...m, content: newContent } : m)
          );
          break;
        }

        case 'planStepUpdate': {
          const { planId, stepId, status: stepStatus } = message as {
            planId: string; stepId: string; status: PlanStep['status']; type: string;
          };
          setCurrentPlan(prev => {
            if (!prev || prev.id !== planId) return prev;
            return {
              ...prev,
              steps: prev.steps.map(s =>
                s.id === stepId ? { ...s, status: stepStatus } : s
              ),
            };
          });
          break;
        }

        case 'planCleared': {
          setCurrentPlan(null);
          break;
        }

        case 'taskResumed': {
          const { title } = message as { taskId: string; title: string; type: string };
          setMessages(prev => [...prev, {
            id: `resume_info_${Date.now()}`,
            role: 'system' as const,
            content: `Task resumed: ${title}`,
            timestamp: Date.now(),
          }]);
          break;
        }

        case 'settingsUpdate': {
          break;
        }
      }
    });

    // Signal to extension that React is mounted and ready to receive messages
    postMessage({ type: 'webviewReady' });

    return () => {
      cleanup();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback((text: string) => {
    if ((!text.trim() && attachments.length === 0) || agentState !== 'idle') return;
    const displayText = text.trim()
      ? text
      : `[${attachments.map((a) => a.displayName || `@${a.type}`).join(', ')}]`;
    setMessages((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'user' as const,
        content: displayText,
        timestamp: Date.now(),
      },
    ]);
    setAgentState('thinking');
    const msg: Record<string, unknown> = { type: 'sendMessage', text: text || '' };
    if (attachments.length > 0) {
      msg.attachments = attachments;
    }
    postMessage(msg);
    setAttachments([]);
    setFollowUpSuggestions([]);
  }, [agentState, attachments]);

  const cancelTask = useCallback(() => {
    postMessage({ type: 'cancelTask' });
    setPendingApproval(null);
    setFollowUpSuggestions([]);
    setAgentState('idle');
  }, []);

  const newTask = useCallback(() => {
    postMessage({ type: 'newTask' });
    setFollowUpSuggestions([]);
  }, []);

  const approveToolCall = useCallback((toolCallId: string) => {
    postMessage({ type: 'approveToolCall', toolCallId });
    setPendingApproval(null);
    setAgentState('tool_calling');
  }, []);

  const rejectToolCall = useCallback((toolCallId: string) => {
    postMessage({ type: 'rejectToolCall', toolCallId });
    setPendingApproval(null);
    setAgentState('thinking');
  }, []);

  const toggleMode = useCallback(() => {
    const newMode = mode === 'act' ? 'plan' : 'act';
    setMode(newMode);
    postMessage({ type: 'toggleMode', mode: newMode });
  }, [mode]);

  const switchMode = useCallback((slug: string) => {
    setMode(slug);
    postMessage({ type: 'toggleMode', mode: slug });
  }, []);

  const selectModel = useCallback((provider: string, model: string) => {
    setCurrentProvider(provider);
    setCurrentModel(model);
    postMessage({ type: 'selectModel', provider, model });
  }, []);

  const runWorkflow = useCallback((workflowName: string, userText: string, workflowAttachments?: Attachment[]) => {
    const atts = workflowAttachments ?? attachments;
    const msg: Record<string, unknown> = { type: 'runWorkflow', workflowName, userText };
    if (atts.length > 0) {
      msg.attachments = atts;
    }
    postMessage(msg);
    setAttachments([]);
  }, [attachments]);

  const requestFileList = useCallback((query: string) => {
    setFileList([]);
    postMessage({ type: 'requestFileList', query });
  }, []);

  const requestFolderList = useCallback((query: string) => {
    setFolderList([]);
    postMessage({ type: 'requestFolderList', query });
  }, []);

  const addAttachment = useCallback((attachment: Attachment) => {
    setAttachments((prev) => {
      // Prevent duplicates
      if (prev.some((a) => a.type === attachment.type && a.value === attachment.value)) return prev;
      return [...prev, attachment];
    });
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const openRulesFile = useCallback(() => {
    postMessage({ type: 'openRulesFile' });
  }, []);

  const restoreCheckpoint = useCallback((checkpointId: string) => {
    postMessage({ type: 'restoreCheckpoint', checkpointId });
  }, []);

  const requestCheckpoints = useCallback(() => {
    postMessage({ type: 'requestCheckpoints' });
  }, []);

  const executePlan = useCallback((planId: string) => {
    postMessage({ type: 'executePlan', planId });
  }, []);

  const editPlanStep = useCallback((planId: string, stepId: string, title: string, description: string) => {
    postMessage({ type: 'editPlanStep', planId, stepId, title, description });
  }, []);

  const skipPlanStep = useCallback((planId: string, stepId: string) => {
    postMessage({ type: 'skipPlanStep', planId, stepId });
  }, []);

  const resumeTask = useCallback((taskId: string) => {
    postMessage({ type: 'resumeTask', taskId });
  }, []);

  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  return {
    messages,
    agentState,
    cost,
    pendingApproval,
    mode,
    modeList,
    models,
    currentProvider,
    currentModel,
    workflows,
    attachments,
    fileList,
    folderList,
    activeFile,
    followUpSuggestions,
    sendMessage,
    cancelTask,
    newTask,
    approveToolCall,
    rejectToolCall,
    toggleMode,
    switchMode,
    selectModel,
    runWorkflow,
    requestFileList,
    requestFolderList,
    addAttachment,
    removeAttachment,
    openRulesFile,
    checkpoints,
    restoreCheckpoint,
    requestCheckpoints,
    currentPlan,
    executePlan,
    editPlanStep,
    skipPlanStep,
    resumeTask,
    showSettings,
    openSettings,
    closeSettings,
  };
}
