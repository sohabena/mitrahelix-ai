import React, { useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { InputBox } from './components/InputBox';
import { TaskHeader } from './components/TaskHeader';
import { TaskHistoryPanel } from './components/TaskHistoryPanel';
import { PlanView } from './components/PlanView';
import { SettingsPanel } from './components/SettingsPanel';
import { useChat } from './hooks/useChat';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen px-6 text-center">
          <div className="text-2xl mb-3">Something went wrong</div>
          <div className="text-xs opacity-60 mb-4 max-w-xs">{this.state.error}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            className="px-4 py-2 rounded text-sm"
            style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [showHistory, setShowHistory] = useState(false);
  const {
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
    currentPlan,
    executePlan,
    editPlanStep,
    skipPlanStep,
    showSettings,
    openSettings,
    closeSettings,
  } = useChat();

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-screen relative">
      <TaskHeader
        agentState={agentState}
        cost={cost}
        mode={mode}
        modeList={modeList}
        models={models}
        currentProvider={currentProvider}
        currentModel={currentModel}
        activeFile={activeFile}
        onToggleMode={toggleMode}
        onSwitchMode={switchMode}
        onSelectModel={selectModel}
        onOpenRules={openRulesFile}
        onShowHistory={() => setShowHistory(true)}
        onOpenSettings={openSettings}
        checkpoints={checkpoints}
        onRestoreCheckpoint={restoreCheckpoint}
      />
      <TaskHistoryPanel isOpen={showHistory} onClose={() => setShowHistory(false)} />
      <SettingsPanel
        isOpen={showSettings}
        onClose={closeSettings}
        currentProvider={currentProvider}
        currentModel={currentModel}
        models={models}
      />
      {currentPlan && (
        <PlanView
          plan={currentPlan}
          agentState={agentState}
          onExecute={executePlan}
          onSkipStep={skipPlanStep}
          onEditStep={editPlanStep}
        />
      )}
      <ChatPanel
        messages={messages}
        agentState={agentState}
        pendingApproval={pendingApproval}
        followUpSuggestions={followUpSuggestions}
        onApprove={approveToolCall}
        onReject={rejectToolCall}
        onSendMessage={sendMessage}
      />
      <InputBox
        onSend={sendMessage}
        onCancel={cancelTask}
        onNewTask={newTask}
        onRunWorkflow={runWorkflow}
        agentState={agentState}
        workflows={workflows}
        attachments={attachments}
        fileList={fileList}
        folderList={folderList}
        activeFile={activeFile}
        onRequestFileList={requestFileList}
        onRequestFolderList={requestFolderList}
        onAddAttachment={addAttachment}
        onRemoveAttachment={removeAttachment}
      />
    </div>
    </ErrorBoundary>
  );
}
