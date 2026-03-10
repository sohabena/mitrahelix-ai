import * as vscode from 'vscode';
import { MAX_CONTENT_PREVIEW } from '../../shared/constants.js';

export class ActiveEditorContext {
  async gather(): Promise<string> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return '';
    }

    const document = editor.document;
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const languageId = document.languageId;
    const lineCount = document.lineCount;
    const cursorLine = editor.selection.active.line + 1;

    const selection = editor.selection;
    let selectedText = '';
    if (!selection.isEmpty) {
      selectedText = document.getText(selection);
    }

    const content = document.getText();
    const truncatedContent = content.length > MAX_CONTENT_PREVIEW
      ? content.slice(0, MAX_CONTENT_PREVIEW) + '\n[FILE TRUNCATED]'
      : content;

    let result = `File: ${filePath}\nLanguage: ${languageId}\nLines: ${lineCount}\nCursor: line ${cursorLine}`;

    if (selectedText) {
      result += `\nSelected text:\n\`\`\`\n${selectedText.slice(0, 5000)}\n\`\`\``;
    }

    result += `\nContent:\n\`\`\`${languageId}\n${truncatedContent}\n\`\`\``;

    return result;
  }
}
