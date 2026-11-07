import { useCallback, useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  ImageIcon,
  Minus,
  Table as TableIcon,
  Undo2,
  Redo2,
  Highlighter,
  ListChecks,
  RemoveFormatting,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlogContentJson } from "@/lib/blog-types";
import { cn } from "@/lib/utils";

type Props = {
  initialJson?: BlogContentJson;
  onChange: (payload: { json: BlogContentJson; html: string }) => void;
  onUploadImage?: () => Promise<string | null>;
  className?: string;
};

function ToolBtn({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "navy" : "ghost"}
      className="h-8 w-8 p-0"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ArticleEditor({ initialJson, onChange, onUploadImage, className }: Props) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", class: "text-royal underline" },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-md my-4",
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Start writing your article…" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
    ],
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content:
      initialJson && typeof initialJson === "object" && Object.keys(initialJson as object).length
        ? (initialJson as object)
        : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class:
          "prose prose-navy max-w-none min-h-[420px] px-6 py-5 focus:outline-none prose-headings:font-display prose-img:max-w-full prose-img:h-auto",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange({ json: ed.getJSON() as BlogContentJson, html: ed.getHTML() });
    },
  });

  useEffect(() => {
    if (!editor || !initialJson) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(initialJson);
    if (current !== next) {
      editor.commands.setContent(initialJson as object);
    }
    // Only sync when parent replaces document (e.g. load from server)
  }, [editor, initialJson]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link")["href"] as string | undefined;
    const url = window.prompt("Link URL", prev || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]);

  const insertImage = useCallback(async () => {
    if (!editor) return;
    if (onUploadImage) {
      const url = await onUploadImage();
      if (url) editor.chain().focus().setImage({ src: url }).run();
      return;
    }
    const url = window.prompt("Image URL");
    if (url?.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
  }, [editor, onUploadImage]);

  if (!editor) return null;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-white", className)}>
      <div className="sticky top-0 z-10 flex flex-wrap gap-0.5 border-b border-border bg-muted/40 px-2 py-1.5">
        <ToolBtn label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <span className="mx-1 w-px self-stretch bg-border" />
        <ToolBtn
          label="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolBtn>
        <span className="mx-1 w-px self-stretch bg-border" />
        <ToolBtn
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Highlight"
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-3.5 w-3.5" />
        </ToolBtn>
        <span className="mx-1 w-px self-stretch bg-border" />
        <ToolBtn
          label="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Align centre"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolBtn>
        <span className="mx-1 w-px self-stretch bg-border" />
        <ToolBtn
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Checklist"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListChecks className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Table"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <TableIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Link" active={editor.isActive("link")} onClick={setLink}>
          <Link2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Insert image" onClick={() => void insertImage()}>
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>
      <EditorContent editor={editor} />
      <div className="border-t border-border px-4 py-1.5 text-[0.7rem] text-muted-foreground">
        {editor.storage.characterCount?.words?.() ?? 0} words
      </div>
    </div>
  );
}
