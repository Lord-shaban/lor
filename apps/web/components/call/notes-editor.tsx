"use client";

import Collaboration from "@tiptap/extension-collaboration";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import * as Y from "yjs";
import { NOTES_FRAGMENT_KEY } from "@/lib/notes-yjs";

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
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        "min-h-11 rounded-md px-3 text-sm font-medium transition-colors duration-150",
        active
          ? "bg-[#f4f4f5] text-[#0a0a0b]"
          : "bg-[#27272a] text-[#f4f4f5] hover:bg-[#3f3f46]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/**
 * Tiptap persists its document structure in Y.XmlFragment. The surrounding
 * lifecycle owns hydration, LiveKit transport and snapshot retries, so this
 * component is intentionally just the editable view of that one document.
 */
export function NotesEditor({ document }: { document: Y.Doc }) {
  const t = useTranslations("call.notes");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // Collaboration supplies a scoped Y.UndoManager. The normal history
      // extension would be unaware of remote changes and could undo a peer.
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document, field: NOTES_FRAGMENT_KEY }),
      Placeholder.configure({ placeholder: t("placeholder") }),
    ],
    editorProps: {
      attributes: {
        "aria-describedby": "notes-collaboration-status notes-editor-help",
        "aria-label": t("editorLabel"),
        class: "min-h-full outline-none",
        dir: "auto",
      },
    },
  }, [document]);

  if (!editor) {
    return (
      <div role="status" className="grid h-full place-items-center px-6 text-sm text-[#d4d4d8]">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#111113]">
      <div
        role="toolbar"
        aria-label={t("toolbar")}
        className="flex shrink-0 flex-wrap gap-2 border-b border-[#2a2a2e] bg-[#18181b] px-3 py-2 sm:px-4"
      >
        <ToolbarButton
          label={t("bold")}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong aria-hidden="true">B</strong>
        </ToolbarButton>
        <ToolbarButton
          label={t("italic")}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em aria-hidden="true">I</em>
        </ToolbarButton>
        <ToolbarButton
          label={t("heading")}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <span aria-hidden="true">H2</span>
        </ToolbarButton>
        <ToolbarButton
          label={t("bulletList")}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <span aria-hidden="true">• —</span>
        </ToolbarButton>
        <ToolbarButton
          label={t("orderedList")}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <span aria-hidden="true">1.</span>
        </ToolbarButton>
        <ToolbarButton
          label={t("quote")}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <span aria-hidden="true">“</span>
        </ToolbarButton>
        <span className="mx-1 hidden h-8 self-center border-s border-[#3f3f46] sm:block" aria-hidden="true" />
        <ToolbarButton
          label={t("undo")}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <span aria-hidden="true">↶</span>
        </ToolbarButton>
        <ToolbarButton
          label={t("redo")}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <span aria-hidden="true">↷</span>
        </ToolbarButton>
      </div>

      <p id="notes-editor-help" className="sr-only">{t("editorHint")}</p>
      <EditorContent
        editor={editor}
        className="notes-editor min-h-0 flex-1 overflow-y-auto px-4 py-6 text-base leading-7 text-[#f4f4f5] sm:px-8 md:px-12 [&_.ProseMirror]:mx-auto [&_.ProseMirror]:max-w-3xl [&_.ProseMirror]:pb-24 [&_.ProseMirror]:[unicode-bidi:plaintext] [&_.ProseMirror_blockquote]:my-5 [&_.ProseMirror_blockquote]:border-s-2 [&_.ProseMirror_blockquote]:border-[#71717a] [&_.ProseMirror_blockquote]:ps-4 [&_.ProseMirror_h2]:mb-4 [&_.ProseMirror_h2]:mt-8 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_li]:my-1 [&_.ProseMirror_ol]:my-4 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ps-7 [&_.ProseMirror_p]:my-3 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[#a1a1aa] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_ul]:my-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ps-7 [&_.ProseMirror]:focus-visible:outline-2 [&_.ProseMirror]:focus-visible:outline-offset-4 [&_.ProseMirror]:focus-visible:outline-[#f4f4f5]"
      />
    </div>
  );
}
