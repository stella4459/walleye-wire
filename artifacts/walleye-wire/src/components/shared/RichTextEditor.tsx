import { forwardRef, useImperativeHandle, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import type { Editor } from "@tiptap/react";

export interface RichTextEditorRef {
  reset: () => void;
  getHTML: () => string;
}

interface Props {
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      className={`px-2 py-1 text-xs font-mono tracking-wide border transition-colors rounded-none select-none ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-background text-foreground border-border hover:bg-accent hover:border-foreground/30"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/30">
      <ToolbarButton
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
      >
        <span className="underline">U</span>
      </ToolbarButton>

      <span className="w-px h-5 bg-border mx-1" aria-hidden="true" />

      <ToolbarButton
        title="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
      >
        H3
      </ToolbarButton>

      <span className="w-px h-5 bg-border mx-1" aria-hidden="true" />

      <ToolbarButton
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
      >
        1. List
      </ToolbarButton>

      <span className="w-px h-5 bg-border mx-1" aria-hidden="true" />

      <ToolbarButton
        title="Blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
      >
        ❝ Quote
      </ToolbarButton>

      <span className="w-px h-5 bg-border mx-1" aria-hidden="true" />

      <ToolbarButton
        title="Clear formatting"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        Clear
      </ToolbarButton>
    </div>
  );
}

export const RichTextEditor = forwardRef<RichTextEditorRef, Props>(
  ({ onChange, placeholder = "Write here…", minHeight = "200px" }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit,
        UnderlineExt,
        Placeholder.configure({ placeholder }),
        Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      ],
      content: "",
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: "rich-editor-content focus:outline-none",
          style: `min-height: ${minHeight}; padding: 12px 14px;`,
        },
      },
    });

    useImperativeHandle(ref, () => ({
      reset: () => {
        editor?.commands.clearContent();
        onChange("");
      },
      getHTML: () => editor?.getHTML() ?? "",
    }));

    useEffect(() => {
      return () => {
        editor?.destroy();
      };
    }, [editor]);

    return (
      <div className="border border-border bg-background rounded-none overflow-hidden">
        <Toolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";
