"use client";

import { useId, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  PROJECT_STORY_LIMITS,
  type ProjectStoryDocument,
  type StoryTextAlign,
} from "@physifun/domain";
import { ProjectStoryView } from "@physifun/ui-shared";
import { Button, Input, Modal } from "@/components/common";
import { canEditStory, isStoryLinkUrl, storyEditorExtensions } from "./storyEditorExtensions";

interface StoryEditorProps {
  label: string;
  /** 欄の上に出す案内文 */
  helperText?: string;
  /** 読み込んだ本文。最初の内容にだけ使い、以後はエディタが持つ */
  value: JSONContent | null;
  /** 本文が変わるたびに、エディタの JSON を返す（空なら null）。中身の検査は保存するときに `ProjectStory.create` で行う */
  onChange: (doc: JSONContent | null) => void;
}

/**
 * エディタの中の見た目。表示部品（`ProjectStoryView`）と同じクラスにして、書いているときと表示をそろえる
 */
const CONTENT_CLASS = [
  "text-sm leading-[1.7] text-gray-800 break-words",
  "[&_p]:mb-2.5",
  "[&_h2]:mt-5 [&_h2]:mb-1.5 [&_h2]:border-l-4 [&_h2]:border-orange-600 [&_h2]:pl-2 [&_h2]:text-[17px] [&_h2]:leading-snug [&_h2]:font-bold",
  "[&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-[15px] [&_h3]:leading-snug [&_h3]:font-bold",
  "[&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-2.5 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li>p]:mb-0 [&_li>ul]:mb-0 [&_li>ol]:mb-0",
  "[&_a]:text-orange-700 [&_a]:underline [&_strong]:font-bold",
].join(" ");

/**
 * ストーリー（本文）の見たまま編集エディタ（#317、設計書 §5.4）。
 *
 * - 使える要素・装飾は `storyEditorExtensions` で domain の `ProjectStory` が許可するものに絞っている
 * - ツールバーは、元に戻す・見出し・小見出し・太字・斜体・取り消し線・配置・箇条書き・番号付き・リンク。
 *   スマホでは折り返す。画像は S-8（#320）、動画は S-9（#321）で足す
 * - リンクはダイアログで URL を入れる。`http://` か `https://` で始まるものだけ受け付ける
 * - 文字数は domain と同じく、画面に表示される文字（文字ノードの文字）だけを数える
 * - このエディタにまだ無い要素（YouTube など）を含む本文は、空で開いて保存で消してしまわないよう、
 *   編集できない状態で開く（`onChange` が起きないので、保存しても本文は送られず今のまま残る）
 */
export function StoryEditor({ label, helperText, value, onChange }: StoryEditorProps) {
  const labelId = useId();
  const helperId = `${labelId}-helper`;
  const countId = `${labelId}-count`;
  // 最初の本文だけで決まる（以後はエディタが本文を持つ）
  const [editable] = useState(() => canEditStory(value));
  const editor = useEditor({
    extensions: storyEditorExtensions,
    content: editable ? value : null,
    editable,
    // クライアントで本文を取得してから描くので SSR されない。未指定だと Tiptap が Next.js と判定して
    // 最初の描画でエディタを null にする（ツールバーが 1 フレーム出ない）うえ、開発時に毎回警告を出す
    immediatelyRender: true,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        "aria-describedby": helperText ? `${helperId} ${countId}` : countId,
        class: "min-h-[280px] px-3 py-2 outline-none",
      },
    },
    // useEditor は常にいまの onUpdate を呼ぶので、親の再描画で onChange が変わっても古い関数を抱え込まない
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? null : e.getJSON()),
  });

  return (
    <div className="w-full">
      <p id={labelId} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </p>
      {helperText && (
        <p id={helperId} className="mb-2 text-sm text-gray-500">
          {helperText}
        </p>
      )}
      {editable ? (
        <>
          <div className="rounded-md border border-gray-300 bg-white shadow-sm focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500">
            {editor && <Toolbar editor={editor} />}
            <EditorContent editor={editor} className={CONTENT_CLASS} />
          </div>
          {editor && <TextCount editor={editor} id={countId} />}
        </>
      ) : (
        <>
          <p
            role="status"
            className="mb-3 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800"
          >
            このストーリーには、この画面ではまだ編集できない内容が含まれています。内容を守るため、ここでは編集できません（保存してもストーリーは今のまま残ります）。
          </p>
          {/* 中身は見られるように、表示部品で読み取り専用で描く。読み込んだ本文は保存時に検査済みの文書データ */}
          {value && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <ProjectStoryView story={value as ProjectStoryDocument} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ALIGNMENTS: readonly StoryTextAlign[] = ["left", "center", "right"];
const ALIGN_LABEL: Record<StoryTextAlign, string> = {
  left: "左寄せ",
  center: "中央寄せ",
  right: "右寄せ",
};

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      heading2: e.isActive("heading", { level: 2 }),
      heading3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      // 指定なし（null）は左寄せとして扱う
      align: ALIGNMENTS.find((a) => a !== "left" && e.isActive({ textAlign: a })) ?? "left",
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      link: e.isActive("link"),
    }),
  });
  const [linkDialog, setLinkDialog] = useState<{ href: string; error?: string } | null>(null);

  const openLinkDialog = () => {
    const href: unknown = editor.getAttributes("link").href;
    setLinkDialog({ href: typeof href === "string" ? href : "" });
  };

  const applyLink = () => {
    if (!linkDialog) return;
    const href = linkDialog.href.trim();
    if (!isStoryLinkUrl(href)) {
      setLinkDialog({ href, error: "http:// か https:// で始まる URL を入力してください" });
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !state.link) {
      // 文字を選んでいないときは、URL そのものをリンクの文字として入れる
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] });
    } else {
      chain.setLink({ href });
    }
    chain.run();
    setLinkDialog(null);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkDialog(null);
  };

  // キャンセル（Escape・閉じる・背景）で閉じたときも、フォーカスをエディタに戻す（共通の Modal は復元しない）
  const closeLinkDialog = () => {
    setLinkDialog(null);
    editor.commands.focus();
  };

  const setAlign = (align: StoryTextAlign) => {
    const chain = editor.chain().focus();
    // 左寄せは「指定なし」に戻す（保存する JSON に残さない）
    (align === "left" ? chain.unsetTextAlign() : chain.setTextAlign(align)).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="書式"
      className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 p-1.5"
    >
      <ToolbarButton
        label="元に戻す"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <span aria-hidden="true">↶</span> 元に戻す
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="見出し"
        active={state.heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        見出し
      </ToolbarButton>
      <ToolbarButton
        label="小見出し"
        active={state.heading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        小見出し
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="太字"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        label="斜体"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        label="取り消し線"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolbarButton>
      <Divider />
      {ALIGNMENTS.map((align) => (
        <ToolbarButton
          key={align}
          label={ALIGN_LABEL[align]}
          active={state.align === align}
          onClick={() => setAlign(align)}
        >
          <AlignIcon align={align} />
        </ToolbarButton>
      ))}
      <Divider />
      <ToolbarButton
        label="箇条書き"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <span aria-hidden="true">•</span> リスト
      </ToolbarButton>
      <ToolbarButton
        label="番号付きリスト"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <span aria-hidden="true">1.</span> リスト
      </ToolbarButton>
      <Divider />
      <ToolbarButton label="リンク" active={state.link} onClick={openLinkDialog}>
        リンク
      </ToolbarButton>

      <Modal isOpen={linkDialog !== null} onClose={closeLinkDialog} title="リンク" size="sm">
        <Input
          label="リンク先の URL"
          type="url"
          inputMode="url"
          placeholder="https://example.com"
          autoFocus
          value={linkDialog?.href ?? ""}
          error={linkDialog?.error}
          onChange={(e) => setLinkDialog({ href: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyLink();
            }
          }}
        />
        <div className="mt-4 flex justify-end gap-3">
          {state.link && (
            <Button type="button" variant="outline" onClick={removeLink}>
              リンクを外す
            </Button>
          )}
          <Button type="button" variant="primary" onClick={applyLink}>
            設定
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  /** 切り替えのボタンだけ渡す（動作のボタンには aria-pressed を付けない） */
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // 押してもエディタからフォーカスが外れないようにする（選択範囲を保ち、スマホでキーボードが閉じないように）
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded px-2 text-sm whitespace-nowrap text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? "bg-orange-100 text-orange-800" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 my-1.5 w-px self-stretch bg-gray-300" />;
}

/**
 * 配置のアイコン（3 本の線を左・中央・右にそろえる）
 */
function AlignIcon({ align }: { align: StoryTextAlign }) {
  const x = { left: [2, 2, 2], center: [2, 5, 3], right: [2, 8, 4] }[align];
  const width = [16, 10, 14];
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
      {width.map((w, i) => (
        <rect key={i} x={x[i]} y={4 + i * 5} width={w} height="2" rx="1" fill="currentColor" />
      ))}
    </svg>
  );
}

function TextCount({ editor, id }: { editor: Editor; id: string }) {
  const length = useEditorState({
    editor,
    selector: ({ editor: e }) => e.state.doc.textContent.length,
  });
  const over = length > PROJECT_STORY_LIMITS.textLength;
  return (
    <p
      id={id}
      aria-live="polite"
      className={`mt-1 text-right text-xs ${over ? "text-red-600" : "text-gray-500"}`}
    >
      {length.toLocaleString()} / {PROJECT_STORY_LIMITS.textLength.toLocaleString()} 文字
    </p>
  );
}
