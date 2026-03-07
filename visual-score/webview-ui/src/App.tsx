import React from 'react';
import { ChatPanel } from './components/ChatPanel';
import { InputBox } from './components/InputBox';
import { TaskHeader } from './components/TaskHeader';
import { useChat } from './hooks/useChat';

export default function App() {
  const {
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
  } = useChat();

  return (
    <div className="flex flex-col h-screen">
      <TaskHeader
        agentState={agentState}
        cost={cost}
        mode={mode}
        models={models}
        currentProvider={currentProvider}
        currentModel={currentModel}
        onToggleMode={toggleMode}
        onSelectModel={selectModel}
      />
      <ChatPanel
        messages={messages}
        agentState={agentState}
        pendingApproval={pendingApproval}
        onApprove={approveToolCall}
        onReject={rejectToolCall}
      />
      <InputBox
        onSend={sendMessage}
        onCancel={cancelTask}
        onNewTask={newTask}
        onRunWorkflow={runWorkflow}
        agentState={agentState}
        workflows={workflows}
      />
    </div>
  );
}
