import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Square, PlusCircle, Workflow, FileText, Folder, AlertTriangle, Globe, X, AtSign, GitBranch, Terminal, TextCursorInput, Image } from 'lucide-react';
import type { AgentState, WorkflowInfo, Attachment, FileListItem } from '../hooks/useChat';

type MentionMenuMode = 'types' | 'file-search' | 'folder-search' | 'url-input';

interface InputBoxProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  onNewTask: () => void;
  onRunWorkflow: (workflowName: string, userText: string, attachments?: Attachment[]) => void;
  agentState: AgentState;
  workflows: WorkflowInfo[];
  attachments: Attachment[];
  fileList: FileListItem[];
  folderList: FileListItem[];
  activeFile?: { filePath: string; fileName: string } | null;
  onRequestFileList: (query: string) => void;
  onRequestFolderList: (query: string) => void;
  onAddAttachment: (attachment: Attachment) => void;
  onRemoveAttachment: (index: number) => void;
}

export const InputBox: React.FC<InputBoxProps> = React.memo(({
  onSend, onCancel, onNewTask, onRunWorkflow, agentState, workflows,
  attachments, fileList, folderList, activeFile,
  onRequestFileList, onRequestFolderList, onAddAttachment, onRemoveAttachment,
}) => {
  const [text, setText] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [mentionMode, setMentionMode] = useState<MentionMenuMode | null>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isIdle = agentState === 'idle';

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [text]);

  // Slash menu detection
  useEffect(() => {
    if (text.startsWith('/') && workflows.length > 0 && isIdle && !mentionMode) {
      setShowSlashMenu(true);
      setSlashFilter(text.slice(1).toLowerCase());
      setSlashSelectedIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  }, [text, workflows, isIdle, mentionMode]);

  // File search debounce
  useEffect(() => {
    if (mentionMode === 'file-search') {
      const timer = setTimeout(() => onRequestFileList(mentionSearch), 150);
      return () => clearTimeout(timer);
    }
    if (mentionMode === 'folder-search') {
      const timer = setTimeout(() => onRequestFolderList(mentionSearch), 150);
      return () => clearTimeout(timer);
    }
  }, [mentionSearch, mentionMode, onRequestFileList, onRequestFolderList]);

  // Close mention menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setMentionMode(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredWorkflows = useMemo(() => {
    if (!slashFilter) return workflows;
    return workflows.filter((w) =>
      w.name.toLowerCase().includes(slashFilter) || w.description.toLowerCase().includes(slashFilter)
    );
  }, [workflows, slashFilter]);

  const readFileAsBase64 = useCallback((file: File): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ data: base64, mimeType: file.type || 'image/png' });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleImageFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    for (const file of imageFiles.slice(0, 5)) {
      try {
        const { data, mimeType } = await readFileAsBase64(file);
        onAddAttachment({
          type: 'image',
          value: data,
          displayName: file.name || 'pasted image',
          mimeType,
        });
      } catch { /* skip unreadable files */ }
    }
  }, [onAddAttachment, readFileAsBase64]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageItems.push(file);
      }
    }
    if (imageItems.length > 0) {
      e.preventDefault();
      handleImageFiles(imageItems);
    }
  }, [handleImageFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.some(f => f.type.startsWith('image/'))) {
      handleImageFiles(files);
    }
  }, [handleImageFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.items).some(item => item.type.startsWith('image/'))) {
      e.preventDefault();
    }
  }, []);

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || !isIdle) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSelectWorkflow = (workflow: WorkflowInfo) => {
    setShowSlashMenu(false);
    const userText = text.replace(/^\/\S*\s*/, '').trim();
    onRunWorkflow(workflow.name, userText, attachments);
    setText('');
  };

  const openMentionMenu = useCallback(() => {
    setMentionMode('types');
    setMentionSearch('');
  }, []);

  // Strip trailing @ that was typed to trigger the menu
  const stripTrailingAt = () => {
    setText((prev) => prev.replace(/@\s*$/, '').trimEnd());
  };

  const handleSelectMentionType = (type: string) => {
    stripTrailingAt();
    if (type === 'file') {
      setMentionMode('file-search');
      setMentionSearch('');
      onRequestFileList('');
    } else if (type === 'folder') {
      setMentionMode('folder-search');
      setMentionSearch('');
      onRequestFolderList('');
    } else if (type === 'problems') {
      onAddAttachment({ type: 'problems', value: 'diagnostics', displayName: '@problems' });
      setMentionMode(null);
    } else if (type === 'url') {
      setMentionMode('url-input');
      setUrlInput('');
    } else if (type === 'git') {
      onAddAttachment({ type: 'git', value: 'git', displayName: '@git' });
      setMentionMode(null);
    } else if (type === 'terminal') {
      onAddAttachment({ type: 'terminal', value: 'terminal', displayName: '@terminal' });
      setMentionMode(null);
    } else if (type === 'selection') {
      onAddAttachment({ type: 'selection', value: 'selection', displayName: '@selection' });
      setMentionMode(null);
    } else if (type === 'active-file' && activeFile) {
      onAddAttachment({ type: 'file', value: activeFile.filePath, displayName: activeFile.fileName });
      setMentionMode(null);
    }
  };

  const handleSelectFile = (file: FileListItem) => {
    onAddAttachment({ type: 'file', value: file.path, displayName: file.name });
    setMentionMode(null);
    textareaRef.current?.focus();
  };

  const handleSelectFolder = (folder: FileListItem) => {
    onAddAttachment({ type: 'folder', value: folder.path, displayName: folder.name });
    setMentionMode(null);
    textareaRef.current?.focus();
  };

  const handleSubmitUrl = () => {
    if (urlInput.trim()) {
      const url = urlInput.trim().startsWith('http') ? urlInput.trim() : `https://${urlInput.trim()}`;
      onAddAttachment({ type: 'url', value: url, displayName: url });
    }
    setMentionMode(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Detect @ trigger
    if (e.key === '@' && !mentionMode && !showSlashMenu) {
      // Don't prevent default — let @ appear in text, then open menu
      setTimeout(() => openMentionMenu(), 0);
      return;
    }
    if (mentionMode && e.key === 'Escape') {
      e.preventDefault();
      setMentionMode(null);
      return;
    }
    if (showSlashMenu && e.key === 'Escape') {
      e.preventDefault();
      setShowSlashMenu(false);
      return;
    }
    if (showSlashMenu && filteredWorkflows.length > 0 && e.key === 'ArrowDown') {
      e.preventDefault();
      setSlashSelectedIndex((prev) => Math.min(prev + 1, filteredWorkflows.length - 1));
      return;
    }
    if (showSlashMenu && filteredWorkflows.length > 0 && e.key === 'ArrowUp') {
      e.preventDefault();
      setSlashSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (showSlashMenu && filteredWorkflows.length > 0 && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSelectWorkflow(filteredWorkflows[slashSelectedIndex] || filteredWorkflows[0]);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !mentionMode) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && !mentionMode && !showSlashMenu) {
      if (text.trim()) {
        setText('');
      } else {
        onCancel();
      }
    }
  };

  const menuBg = 'var(--vscode-dropdown-background, var(--vscode-input-background))';
  const menuBorder = 'var(--vscode-dropdown-border, var(--vscode-input-border, rgba(128,128,128,0.3)))';

  return (
    <div
      className="border-t px-2 py-2"
      style={{ borderColor: 'var(--vscode-panel-border, rgba(128,128,128,0.2))' }}
    >
      {/* Action buttons row */}
      <div className="flex items-center gap-1 mb-1.5">
        <button
          onClick={onNewTask}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] opacity-60 hover:opacity-100 transition-opacity"
          title="New Chat"
        >
          <PlusCircle size={11} />
          New
        </button>

        {!isIdle && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ml-auto"
            style={{ color: 'var(--vscode-errorForeground)' }}
            title="Cancel"
          >
            <Square size={10} />
            Cancel
          </button>
        )}
      </div>

      {/* Context chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {attachments.map((att, i) => (
            <span
              key={`${att.type}-${att.value}-${i}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
              style={{
                backgroundColor: 'var(--vscode-badge-background, rgba(0,120,212,0.2))',
                color: 'var(--vscode-badge-foreground, inherit)',
              }}
            >
              {att.type === 'file' && <FileText size={9} />}
              {att.type === 'folder' && <Folder size={9} />}
              {att.type === 'problems' && <AlertTriangle size={9} />}
              {att.type === 'url' && <Globe size={9} />}
              {att.type === 'git' && <GitBranch size={9} />}
              {att.type === 'terminal' && <Terminal size={9} />}
              {att.type === 'selection' && <TextCursorInput size={9} />}
              {att.type === 'image' && <Image size={9} />}
              <span className="truncate max-w-[120px]">{att.displayName || att.value}</span>
              <button
                onClick={() => onRemoveAttachment(i)}
                className="opacity-60 hover:opacity-100"
                title="Remove"
              >
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Slash command workflow picker */}
      {showSlashMenu && filteredWorkflows.length > 0 && (
        <div
          className="mb-1 rounded-md border overflow-y-auto"
          style={{ maxHeight: '150px', backgroundColor: menuBg, borderColor: menuBorder }}
        >
          {filteredWorkflows.map((w, idx) => (
            <button
              key={w.name}
              onClick={() => handleSelectWorkflow(w)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 transition-opacity text-left"
              style={{
                backgroundColor: idx === slashSelectedIndex
                  ? 'var(--vscode-list-activeSelectionBackground, rgba(0,120,212,0.3))'
                  : 'transparent',
              }}
            >
              <Workflow size={12} className="opacity-50 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">/{w.name}</div>
                {w.description && (
                  <div className="text-[9px] opacity-50 truncate">{w.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* @mention menu */}
      {mentionMode && (
        <div
          ref={mentionRef}
          className="mb-1 rounded-md border overflow-y-auto"
          style={{ maxHeight: '200px', backgroundColor: menuBg, borderColor: menuBorder }}
        >
          {mentionMode === 'types' && (
            <>
              <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider opacity-50">
                Attach Context
              </div>
              {activeFile && (
                <button
                  onClick={() => handleSelectMentionType('active-file')}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 text-left"
                  style={{ backgroundColor: 'transparent' }}
                >
                  <FileText size={12} className="opacity-50" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">Current File</div>
                    <div className="text-[9px] opacity-50 truncate">{activeFile.filePath}</div>
                  </div>
                </button>
              )}
              <button
                onClick={() => handleSelectMentionType('file')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 text-left"
                style={{ backgroundColor: 'transparent' }}
              >
                <FileText size={12} className="opacity-50" />
                <div><div className="font-medium">@file</div><div className="text-[9px] opacity-50">Attach a file from workspace</div></div>
              </button>
              <button
                onClick={() => handleSelectMentionType('folder')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 text-left"
                style={{ backgroundColor: 'transparent' }}
              >
                <Folder size={12} className="opacity-50" />
                <div><div className="font-medium">@folder</div><div className="text-[9px] opacity-50">Attach folder listing</div></div>
              </button>
              <button
                onClick={() => handleSelectMentionType('problems')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 text-left"
                style={{ backgroundColor: 'transparent' }}
              >
                <AlertTriangle size={12} className="opacity-50" />
                <div><div className="font-medium">@problems</div><div className="text-[9px] opacity-50">Attach current errors & warnings</div></div>
              </button>
              <button
                onClick={() => handleSelectMentionType('url')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 text-left"
                style={{ backgroundColor: 'transparent' }}
              >
                <Globe size={12} className="opacity-50" />
                <div><div className="font-medium">@url</div><div className="text-[9px] opacity-50">Fetch & attach URL content</div></div>
              </button>
              <button
                onClick={() => handleSelectMentionType('git')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 text-left"
                style={{ backgroundColor: 'transparent' }}
              >
                <GitBranch size={12} className="opacity-50" />
                <div><div className="font-medium">@git</div><div className="text-[9px] opacity-50">Attach git diff & status</div></div>
              </button>
              <button
                onClick={() => handleSelectMentionType('terminal')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 text-left"
                style={{ backgroundColor: 'transparent' }}
              >
                <Terminal size={12} className="opacity-50" />
                <div><div className="font-medium">@terminal</div><div className="text-[9px] opacity-50">Attach terminal context</div></div>
              </button>
              <button
                onClick={() => handleSelectMentionType('selection')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 text-left"
                style={{ backgroundColor: 'transparent' }}
              >
                <TextCursorInput size={12} className="opacity-50" />
                <div><div className="font-medium">@selection</div><div className="text-[9px] opacity-50">Attach current editor selection</div></div>
              </button>
            </>
          )}

          {mentionMode === 'file-search' && (
            <>
              <div className="px-2 py-1">
                <input
                  autoFocus
                  value={mentionSearch}
                  onChange={(e) => setMentionSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && fileList.length > 0) {
                      e.preventDefault();
                      handleSelectFile(fileList[0]);
                    }
                    if (e.key === 'Escape') { e.preventDefault(); setMentionMode(null); }
                    if (e.key === 'Backspace' && !mentionSearch) { setMentionMode('types'); }
                  }}
                  placeholder="Search files..."
                  className="w-full bg-transparent border-none outline-none text-[11px]"
                  style={{ color: 'var(--vscode-input-foreground)' }}
                />
              </div>
              {fileList.map((f) => (
                <button
                  key={f.path}
                  onClick={() => handleSelectFile(f)}
                  className="flex items-center gap-2 w-full px-2 py-1 text-[10px] hover:opacity-80 text-left truncate"
                  style={{ backgroundColor: 'transparent' }}
                >
                  <FileText size={10} className="opacity-40 flex-shrink-0" />
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
              {fileList.length === 0 && mentionSearch && (
                <div className="px-2 py-1.5 text-[10px] opacity-40">No files found</div>
              )}
            </>
          )}

          {mentionMode === 'folder-search' && (
            <>
              <div className="px-2 py-1">
                <input
                  autoFocus
                  value={mentionSearch}
                  onChange={(e) => setMentionSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && folderList.length > 0) {
                      e.preventDefault();
                      handleSelectFolder(folderList[0]);
                    }
                    if (e.key === 'Escape') { e.preventDefault(); setMentionMode(null); }
                    if (e.key === 'Backspace' && !mentionSearch) { setMentionMode('types'); }
                  }}
                  placeholder="Search folders..."
                  className="w-full bg-transparent border-none outline-none text-[11px]"
                  style={{ color: 'var(--vscode-input-foreground)' }}
                />
              </div>
              {folderList.map((f) => (
                <button
                  key={f.path}
                  onClick={() => handleSelectFolder(f)}
                  className="flex items-center gap-2 w-full px-2 py-1 text-[10px] hover:opacity-80 text-left truncate"
                  style={{ backgroundColor: 'transparent' }}
                >
                  <Folder size={10} className="opacity-40 flex-shrink-0" />
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
              {folderList.length === 0 && mentionSearch && (
                <div className="px-2 py-1.5 text-[10px] opacity-40">No folders found</div>
              )}
            </>
          )}

          {mentionMode === 'url-input' && (
            <div className="px-2 py-1.5">
              <input
                autoFocus
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleSubmitUrl(); }
                  if (e.key === 'Escape') { e.preventDefault(); setMentionMode(null); }
                }}
                placeholder="Enter URL (https://...)"
                className="w-full bg-transparent border-none outline-none text-[11px]"
                style={{ color: 'var(--vscode-input-foreground)' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div
        className="flex items-end gap-1.5 rounded-md border px-2 py-1.5"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          borderColor: 'var(--vscode-input-border, var(--vscode-panel-border, rgba(128,128,128,0.3)))',
        }}
      >
        <button
          onClick={openMentionMenu}
          className="flex-shrink-0 p-0.5 rounded opacity-40 hover:opacity-80 transition-opacity"
          title="Attach context (@file, @folder, @problems, @url)"
          disabled={!isIdle}
        >
          <AtSign size={14} />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 p-0.5 rounded opacity-40 hover:opacity-80 transition-opacity"
          title="Attach image (or paste/drop)"
          disabled={!isIdle}
        >
          <Image size={14} />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          placeholder={isIdle ? 'Ask MitraHelix anything... (@ to attach, / for workflow, paste image)' : 'Waiting for agent...'}
          disabled={!isIdle}
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-5"
          style={{
            color: 'var(--vscode-input-foreground)',
            fontFamily: 'var(--vscode-font-family)',
            minHeight: '20px',
            maxHeight: '150px',
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            if (files.length > 0) handleImageFiles(files);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        <button
          onClick={isIdle ? handleSend : onCancel}
          disabled={isIdle && !text.trim() && attachments.length === 0}
          className="flex-shrink-0 p-1 rounded transition-opacity disabled:opacity-30"
          style={{
            backgroundColor: (text.trim() || attachments.length > 0) && isIdle ? 'var(--vscode-button-background)' : 'transparent',
            color: (text.trim() || attachments.length > 0) && isIdle ? 'var(--vscode-button-foreground)' : 'var(--vscode-input-foreground)',
          }}
          title={isIdle ? 'Send (Enter)' : 'Cancel (Escape)'}
        >
          {isIdle ? <Send size={14} /> : <Square size={14} />}
        </button>
      </div>

      <div className="text-[9px] opacity-30 mt-1 text-center">
        Enter to send · Shift+Enter for newline · / workflow · @ context · paste/drop images
      </div>
    </div>
  );
});
