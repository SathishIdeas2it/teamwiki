'use client';

import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

type MarkdownEditorProps = {
  initialValue: string;
  onChange: (value: string) => void;
  'data-testid'?: string;
};

export function MarkdownEditor({
  initialValue,
  onChange,
  'data-testid': testId,
}: MarkdownEditorProps): JSX.Element {
  return (
    <div data-testid={testId ?? 'markdown-editor'} data-color-mode="auto">
      <MDEditor
        value={initialValue}
        onChange={(val) => onChange(val ?? '')}
        height={500}
        preview="live"
      />
    </div>
  );
}
