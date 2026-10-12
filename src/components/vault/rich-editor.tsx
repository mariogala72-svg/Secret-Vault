"use client";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Redo2, Smile, Underline, Undo2 } from "lucide-react";
import { useState } from "react";
import { cn } from "../ui/cn";

const EMOJI = ["❤️", "🥰", "😊", "😢", "🙏", "🌹", "🌻", "🕊️", "✨", "⭐", "🎂", "🎉", "💍", "👶", "🏡", "📸", "🎶", "☀️", "🌙", "🤍", "💛", "🫶", "🤗", "🍀"];

export const editorExtensions = (placeholder?: string) => [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    codeBlock: false,
    code: false,
    link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
  }),
  ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
];

function ToolbarButton({ on, active, label, children }: { on: () => void; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn("grid size-9 place-items-center rounded-xl transition", active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-ink")}
    >
      {children}
    </button>
  );
}

export function RichEditor({ value, onChange }: { value: JSONContent | null; onChange: (v: JSONContent) => void }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const editor = useEditor({
    extensions: editorExtensions("Scrivi qui il tuo messaggio… prenditi tutto il tempo che ti serve."),
    content: value ?? "",
    immediatelyRender: false,
    editorProps: { attributes: { class: "prose-vault px-5 py-4 sm:px-7 sm:py-6", "aria-label": "Testo del messaggio" } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            h2: e.isActive("heading", { level: 2 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
          }
        : null,
  });

  if (!editor) return <div className="skeleton h-80 rounded-3xl" />;


  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Indirizzo del link (https://…)", prev ?? "https://");
    if (url === null) return;
    if (url === "" || url === "https://") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface-solid/50 focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10">
      <div className="relative flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5" role="toolbar" aria-label="Formattazione">
        <ToolbarButton label="Grassetto" active={state?.bold} on={() => editor.chain().focus().toggleBold().run()}><Bold className="size-4" /></ToolbarButton>
        <ToolbarButton label="Corsivo" active={state?.italic} on={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-4" /></ToolbarButton>
        <ToolbarButton label="Sottolineato" active={state?.underline} on={() => editor.chain().focus().toggleUnderline().run()}><Underline className="size-4" /></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-line" />
        <ToolbarButton label="Titolo di sezione" active={state?.h2} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Elenco puntato" active={state?.bullet} on={() => editor.chain().focus().toggleBulletList().run()}><List className="size-4" /></ToolbarButton>
        <ToolbarButton label="Elenco numerato" active={state?.ordered} on={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4" /></ToolbarButton>
        <ToolbarButton label="Citazione" active={state?.quote} on={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="size-4" /></ToolbarButton>
        <ToolbarButton label="Link" active={state?.link} on={setLink}><Link2 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Emoji" active={emojiOpen} on={() => setEmojiOpen((o) => !o)}><Smile className="size-4" /></ToolbarButton>
        <span className="flex-1" />
        <ToolbarButton label="Annulla" on={() => editor.chain().focus().undo().run()}><Undo2 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Ripeti" on={() => editor.chain().focus().redo().run()}><Redo2 className="size-4" /></ToolbarButton>
        {emojiOpen && (
          <div className="absolute left-2 top-12 z-20 grid grid-cols-8 gap-1 rounded-2xl border border-line bg-surface-solid p-2 shadow-xl">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                className="grid size-9 place-items-center rounded-lg text-lg hover:bg-surface-2"
                onClick={() => {
                  editor.chain().focus().insertContent(e).run();
                  setEmojiOpen(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/** Read-only rendering: ProseMirror's schema only allows the nodes above, so no arbitrary HTML can run. */
export function RichViewer({ content }: { content: JSONContent }) {
  const editor = useEditor({
    extensions: editorExtensions(),
    content,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "prose-vault" } },
  });
  if (!editor) return <div className="skeleton h-40 rounded-2xl" />;
  return <EditorContent editor={editor} />;
}
