"use client";

import { useId, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  PROJECT_STORY_LIMITS,
  type ProjectStoryDocument,
  type StoryTextAlign,
} from "@physifun/domain";
import { ProjectStoryView } from "@physifun/ui-shared";
import { Button, Input, Modal } from "@/components/common";
import {
  canEditStory,
  countStoryImages,
  isStoryLinkUrl,
  storyEditorExtensions,
} from "./storyEditorExtensions";
import { prepareStoryImage, storyImageErrorMessage } from "./storyImageFile";
import { uploadStoryImage } from "./storyImageUpload";

interface StoryEditorProps {
  /** 画像のアップロード先（そのプロジェクトのストーリー用フォルダ。#319） */
  projectId: string;
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
  // 画像（#320）。表示部品と同じ見た目にし、選んでいるとき（ProseMirror が `ProseMirror-selectednode` を付ける）は枠を出す
  "[&_img]:mx-auto [&_img]:my-2.5 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md",
  "[&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-orange-500 [&_img.ProseMirror-selectednode]:ring-offset-2",
  // 見出しの型の下のヒント（`storyEditorExtensions` の decoration が付ける `.story-hint` と `data-hint`）。
  // 空の段落の中に薄い字で出し、高さを取らない（float + h-0）ので、カーソルは行頭に残り、書き始めるとそのまま文字に置き換わる。
  // Tailwind はソースを文字列として走査するので、クラスは変数で組まずにそのまま書く（組むと CSS が生成されない）
  "[&_.story-hint::before]:content-[attr(data-hint)] [&_.story-hint::before]:pointer-events-none [&_.story-hint::before]:float-left [&_.story-hint::before]:h-0 [&_.story-hint::before]:text-gray-500",
  // スマホではヒントが 2 行に折り返すので、次の見出しに重ならないよう段落の高さを 2 行分にしておく（ヒントは 2 行に収まる長さにしている）
  "max-md:[&_.story-hint]:min-h-[2lh]",
].join(" ");

/**
 * ストーリー（本文）の見たまま編集エディタ（#317、設計書 §5.4）。
 *
 * - 使える要素・装飾は `storyEditorExtensions` で domain の `ProjectStory` が許可するものに絞っている
 * - ツールバーは、元に戻す・見出し・小見出し・太字・斜体・取り消し線・配置・箇条書き・番号付き・リンク・画像。
 *   スマホでは折り返す。動画は S-9（#321）で足す
 * - 画像はボタンから選び、ブラウザで縮小してアップロード API（#319）に送ってから本文に入れる（`ImageButton`）
 * - リンクはダイアログで URL を入れる。`http://` か `https://` で始まるものだけ受け付ける
 * - 文字数は domain と同じく、画面に表示される文字（文字ノードの文字）だけを数える
 * - このエディタにまだ無い要素（YouTube など）を含む本文は、空で開いて保存で消してしまわないよう、
 *   編集できない状態で開く（`onChange` が起きないので、保存しても本文は送られず今のまま残る）
 * - 見出しの型の下には書き方のヒントを薄い字で出す（`storyEditorExtensions`。保存しない）。
 *   「プレビュー」で、保存前の内容を公開ページと同じ部品（`ProjectStoryView`）で確かめられる（#318、設計書 §5.4）
 */
export function StoryEditor({ projectId, label, helperText, value, onChange }: StoryEditorProps) {
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
            {editor && <Toolbar editor={editor} projectId={projectId} />}
            <EditorContent editor={editor} className={CONTENT_CLASS} />
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            {editor && <PreviewButton editor={editor} />}
            {editor && <TextCount editor={editor} id={countId} />}
          </div>
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

function Toolbar({ editor, projectId }: { editor: Editor; projectId: string }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      images: countStoryImages(e.state.doc),
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
      <Divider />
      <ImageButton editor={editor} projectId={projectId} imageCount={state.images} />

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
  accent = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  /** 切り替えのボタンだけ渡す（動作のボタンには aria-pressed を付けない） */
  active?: boolean;
  /** 目立たせる（画像・動画。設計書 §5.4） */
  accent?: boolean;
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
      className={`inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded px-2 text-sm whitespace-nowrap disabled:opacity-40 ${
        accent
          ? "bg-orange-600 font-medium text-white hover:bg-orange-700 disabled:hover:bg-orange-600"
          : `text-gray-700 hover:bg-gray-200 disabled:hover:bg-transparent ${
              active ? "bg-orange-100 text-orange-800" : ""
            }`
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

interface ImageDialogState {
  readonly file: File;
  /** プレビュー用の object URL。閉じるときに解放する */
  readonly previewUrl: string;
  readonly alt: string;
  readonly uploading: boolean;
  readonly error?: string;
}

/**
 * 画像ボタンとダイアログ（#320、設計書 §5.3・§5.4）。
 *
 * ファイルを選ぶ → ダイアログでプレビューと代わりの文（alt）を確かめる → 「挿入」で、ブラウザで縮小（`prepareStoryImage`）して
 * アップロード API（`uploadStoryImage`、#319）に送り、返った URL を画像ノードとしてカーソルの位置に入れる。
 * - 上限（`PROJECT_STORY_LIMITS.images`）に達したらボタンを使えなくする。貼り付けで超えた分は保存時の検査が止める
 * - 縮小できない形式・大きすぎる・アップロードの失敗は、ダイアログの中に分かる言葉で出す（閉じずに選び直せる）
 * - 処理中はダイアログを閉じられない（閉じたあとに結果が返って状態がずれないように）
 */
function ImageButton({
  editor,
  projectId,
  imageCount,
}: {
  editor: Editor;
  projectId: string;
  imageCount: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<ImageDialogState | null>(null);
  const limitMessage = `画像は ${PROJECT_STORY_LIMITS.images} 枚までです`;
  const full = imageCount >= PROJECT_STORY_LIMITS.images;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルをもう一度選べるように、選択を空に戻す
    e.target.value = "";
    if (!file) return;
    setDialog({ file, previewUrl: URL.createObjectURL(file), alt: "", uploading: false });
  };

  const close = () => {
    if (dialog) URL.revokeObjectURL(dialog.previewUrl);
    setDialog(null);
    editor.commands.focus();
  };

  const fail = (error: string) =>
    setDialog((current) => (current ? { ...current, uploading: false, error } : null));

  const insert = async () => {
    if (!dialog || dialog.uploading) return;
    // ダイアログを開いている間に貼り付けで増えていることがあるので、入れる直前にも数える
    if (countStoryImages(editor.state.doc) >= PROJECT_STORY_LIMITS.images) {
      fail(limitMessage);
      return;
    }
    setDialog({ ...dialog, uploading: true, error: undefined });
    const prepared = await prepareStoryImage(dialog.file);
    if (!prepared.ok) {
      fail(storyImageErrorMessage(prepared.error));
      return;
    }
    const uploaded = await uploadStoryImage(projectId, prepared.value);
    if (!uploaded.ok) {
      fail(uploaded.error.message);
      return;
    }
    const alt = dialog.alt.trim();
    editor
      .chain()
      .focus()
      .insertContent({ type: "image", attrs: { src: uploaded.value.url, alt: alt || null } })
      .run();
    close();
  };

  return (
    <>
      <ToolbarButton
        label={full ? `画像（${limitMessage}）` : "画像"}
        accent
        disabled={full}
        onClick={() => inputRef.current?.click()}
      >
        <ImageIcon /> 画像
      </ToolbarButton>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFileChange}
      />

      <Modal
        isOpen={dialog !== null}
        onClose={dialog?.uploading ? () => {} : close}
        title="画像を入れる"
        size="md"
      >
        {dialog && (
          <>
            {/* 選んだファイルそのもの（縮小前）をそのまま見せる。CSP の img-src は blob: を許している。
                blob: の URL は next/image では扱えないので <img> を使う */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dialog.previewUrl}
              alt=""
              className="mx-auto mb-4 max-h-60 rounded-md object-contain"
            />
            <Input
              label="画像の説明（代わりの文）"
              helperText="画像が表示できないときや、読み上げのときに使われます。空でもかまいません"
              placeholder="例: 田植えを手伝う参加者たち"
              autoFocus
              disabled={dialog.uploading}
              value={dialog.alt}
              onChange={(e) =>
                setDialog((current) => (current ? { ...current, alt: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void insert();
                }
              }}
            />
            {dialog.error && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {dialog.error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <Button type="button" variant="outline" disabled={dialog.uploading} onClick={close}>
                キャンセル
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={dialog.uploading}
                onClick={() => void insert()}
              >
                {dialog.uploading ? "アップロード中..." : "挿入"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

/**
 * 画像のアイコン（枠と山と太陽）
 */
function ImageIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="8" r="1.5" fill="currentColor" />
      <path d="M3.5 15l4.5-4.5 3 3 2.5-2.5 3 3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * 保存前の内容を、公開ページと同じ表示部品で見せる。開いた時点の文書データを写して出す
 * （検査は保存するときに `ProjectStory.create` で行う。表示部品は許可したものだけを描くので、そのまま渡してよい）
 */
function PreviewButton({ editor }: { editor: Editor }) {
  const [preview, setPreview] = useState<ProjectStoryDocument | null>(null);
  const close = () => {
    setPreview(null);
    editor.commands.focus();
  };
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPreview(editor.getJSON() as ProjectStoryDocument)}
      >
        プレビュー
      </Button>
      <Modal isOpen={preview !== null} onClose={close} title="ストーリーのプレビュー" size="2xl">
        <div className="max-h-[70vh] overflow-y-auto">
          {preview && !isBlank(preview) ? (
            <ProjectStoryView story={preview} />
          ) : (
            <p className="py-6 text-center text-sm text-gray-500">まだ何も書かれていません</p>
          )}
        </div>
      </Modal>
    </>
  );
}

/**
 * 空の段落しかない（何も書いていない）文書か
 */
function isBlank(doc: ProjectStoryDocument): boolean {
  return (doc.content ?? []).every(
    (block) => block.type === "paragraph" && (block.content?.length ?? 0) === 0
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
      className={`ml-auto text-right text-xs ${over ? "text-red-600" : "text-gray-500"}`}
    >
      {length.toLocaleString()} / {PROJECT_STORY_LIMITS.textLength.toLocaleString()} 文字
    </p>
  );
}
