import { Node } from '@tiptap/core';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import UniqueID from '@tiptap/extension-unique-id';
import { useEffect, useState, type SVGProps } from 'react';
import {
  createSongSection,
  getDefaultSectionLabel,
  songSectionTypes,
  type SongDocumentV1,
  type SongSectionType,
} from '@/db/songDocument';
import { createId } from '@/lib/createId';
import './songEditor.css';

type IconProps = SVGProps<SVGSVGElement>;

const sectionChoices = songSectionTypes.filter((type) => type !== 'free') as Exclude<SongSectionType, 'free'>[];

const SongDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'songSection+',
});

const SongSection = Node.create({
  name: 'songSection',
  group: 'block',
  content: 'paragraph+',
  defining: true,

  addAttributes() {
    return {
      id: { default: null },
      sectionType: { default: 'free' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-song-section]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'section',
      {
        'data-song-section': '',
        'data-section-type': HTMLAttributes.sectionType,
        'data-section-label': HTMLAttributes.label,
      },
      0,
    ];
  },
});

function UndoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h9a6 6 0 0 1 6 6" />
    </svg>
  );
}

function RedoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m15 7 5 5-5 5" />
      <path d="M20 12h-9a6 6 0 0 0-6 6" />
    </svg>
  );
}

function ChevronIcon({ direction, ...props }: IconProps & { direction: 'left' | 'right' | 'down' }) {
  const path = direction === 'left' ? 'm15 18-6-6 6-6' : direction === 'right' ? 'm9 18 6-6-6-6' : 'm6 9 6 6 6-6';
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d={path} />
    </svg>
  );
}

function SectionIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 15h8" />
    </svg>
  );
}

interface SongEditorProps {
  initialDocument: SongDocumentV1;
  onChange: (document: SongDocumentV1) => void;
  autoFocus?: boolean;
}

export function SongEditor({ initialDocument, onChange, autoFocus = true }: SongEditorProps) {
  const [isSectionMenuOpen, setIsSectionMenuOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ document: false }),
      SongDocument,
      SongSection,
      Placeholder.configure({ placeholder: 'Écris une première ligne…' }),
      UniqueID.configure({
        types: ['songSection', 'paragraph'],
        generateID: () => createId(),
      }),
    ],
    content: initialDocument,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'fz-song-editor__content',
        spellcheck: 'true',
        autocapitalize: 'sentences',
        enterkeyhint: 'enter',
        'aria-label': 'Paroles de la chanson',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getJSON() as unknown as SongDocumentV1);
    },
  });

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      canUndo: currentEditor?.can().undo() ?? false,
      canRedo: currentEditor?.can().redo() ?? false,
    }),
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const closeMenu = () => setIsSectionMenuOpen(false);
    editor.on('blur', closeMenu);
    return () => {
      editor.off('blur', closeMenu);
    };
  }, [editor]);

  function moveCursor(delta: -1 | 1) {
    if (!editor) {
      return;
    }

    const nextPosition = Math.max(1, Math.min(editor.state.doc.content.size - 1, editor.state.selection.from + delta));
    editor.chain().focus().setTextSelection(nextPosition).scrollIntoView().run();
  }

  function insertSection(sectionType: Exclude<SongSectionType, 'free'>) {
    if (!editor) {
      return;
    }

    const insertionPosition = editor.state.selection.from;
    const section = createSongSection(sectionType);
    editor
      .chain()
      .focus()
      .insertContentAt(insertionPosition, section)
      .setTextSelection(insertionPosition + 2)
      .scrollIntoView()
      .run();
    setIsSectionMenuOpen(false);
  }

  function hideKeyboard() {
    editor?.commands.blur();
    setIsSectionMenuOpen(false);
  }

  return (
    <>
      <EditorContent editor={editor} className="fz-song-editor" />

      {isSectionMenuOpen ? (
        <div className="fz-song-editor__section-menu" role="dialog" aria-label="Ajouter une section">
          <p>Ajouter une section</p>
          <div>
            {sectionChoices.map((sectionType) => (
              <button
                key={sectionType}
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => insertSection(sectionType)}
              >
                {getDefaultSectionLabel(sectionType) || 'Personnalisée'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="fz-song-editor__toolbar" aria-label="Outils d’écriture">
        <button
          type="button"
          disabled={!toolbarState?.canUndo}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().undo().run()}
          aria-label="Annuler"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          disabled={!toolbarState?.canRedo}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().redo().run()}
          aria-label="Rétablir"
        >
          <RedoIcon />
        </button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => moveCursor(-1)} aria-label="Déplacer le curseur à gauche">
          <ChevronIcon direction="left" />
        </button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => moveCursor(1)} aria-label="Déplacer le curseur à droite">
          <ChevronIcon direction="right" />
        </button>
        <button
          type="button"
          className={isSectionMenuOpen ? 'is-active' : ''}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setIsSectionMenuOpen((value) => !value)}
          aria-expanded={isSectionMenuOpen}
          aria-label="Ajouter une section"
        >
          <SectionIcon />
          <span>Section</span>
        </button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={hideKeyboard} aria-label="Masquer le clavier">
          <ChevronIcon direction="down" />
        </button>
      </div>
    </>
  );
}
