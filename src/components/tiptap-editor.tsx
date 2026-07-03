import { useEffect, useMemo, useRef } from "react";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TipTapEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  targetLength?: number;
  highlightTerms?: string[];
  readOnly?: boolean;
  className?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textToHtml(value: string, highlightTerms: string[] = []) {
  const terms = Array.from(
    new Set(highlightTerms.map((term) => term.trim()).filter(Boolean)),
  );

  return value
    .split(/\n{2,}/)
    .map((paragraph) => {
      let html = escapeHtml(paragraph).replace(/\n/g, "<br>");

      for (const term of terms) {
        const pattern = new RegExp(`(${escapeRegExp(escapeHtml(term))})`, "gi");
        html = html.replace(pattern, "<mark>$1</mark>");
      }

      return `<p>${html || "<br>"}</p>`;
    })
    .join("");
}

export function TipTapEditor({
  value,
  onChange,
  placeholder = "생성된 콘텐츠가 여기에 표시됩니다.",
  targetLength,
  highlightTerms = [],
  readOnly = false,
  className,
}: TipTapEditorProps) {
  const lastExternalValue = useRef(value);
  const highlightedHtml = useMemo(
    () => textToHtml(value, highlightTerms),
    [highlightTerms, value],
  );
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Highlight,
      CharacterCount.configure({ limit: targetLength }),
    ],
    content: highlightedHtml,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const text = editor.getText({ blockSeparator: "\n\n" });
      lastExternalValue.current = text;
      onChange?.(text);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || value === lastExternalValue.current) {
      return;
    }

    lastExternalValue.current = value;
    editor.commands.setContent(highlightedHtml, { emitUpdate: false });
  }, [editor, highlightedHtml, value]);

  if (!editor) {
    return (
      <div className="min-h-[320px] rounded-md border border-border bg-muted/20" />
    );
  }

  const characterCount = editor.storage.characterCount.characters();

  return (
    <div className={cn("rounded-md border border-border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
        <ToolbarButton
          label="굵게"
          active={editor.isActive("bold")}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="기울임"
          active={editor.isActive("italic")}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="제목 2"
          active={editor.isActive("heading", { level: 2 })}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="제목 3"
          active={editor.isActive("heading", { level: 3 })}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="글머리 목록"
          active={editor.isActive("bulletList")}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="번호 목록"
          active={editor.isActive("orderedList")}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="하이라이트"
          active={editor.isActive("highlight")}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          label="실행 취소"
          disabled={readOnly || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="다시 실행"
          disabled={readOnly || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent
        editor={editor}
        className="min-h-[340px] px-4 py-3 text-sm leading-7 outline-none [&_.ProseMirror]:min-h-[320px] [&_.ProseMirror]:outline-none [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-semibold [&_mark]:rounded-sm [&_mark]:bg-red-100 [&_mark]:px-0.5 [&_p]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal"
      />

      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>
          현재 <span className="tabular-nums text-foreground">{characterCount}</span>자
          {targetLength ? (
            <>
              {" "}
              / 목표{" "}
              <span className="tabular-nums text-foreground">
                {targetLength}
              </span>
              자
            </>
          ) : null}
        </span>
        {highlightTerms.length > 0 ? (
          <span>금칙어 {highlightTerms.length}개 표시</span>
        ) : (
          <span>편집 가능</span>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      aria-label={label}
      title={label}
      type="button"
      size="icon"
      variant={active ? "secondary" : "ghost"}
      className="h-8 w-8"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
