'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTTS } from '@/contexts/TTSContext';
import {
  BookmarkIcon,
  BookmarksListIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  MoonIcon,
  PaletteIcon,
  SearchIcon,
  SunIcon,
} from '@/components/icons/Icons';
import type { PdfPageTheme } from '@/types/config';
import {
  Input, MenuActionItem, MenuItemsSurface, MenuRoot, MenuTransition, MenuTrigger,
  PopoverRoot, PopoverSurface, PopoverTrigger, ToolbarButton, cn,
} from '@/components/ui';
import type { ReaderNavigationPanel } from '@/components/reader/ReaderNavigationSidebars';

export interface SentenceBookmarkControl {
  isBookmarked: boolean;
  /** False while there is no current sentence that can be bookmarked. */
  canToggle: boolean;
  onToggle: () => void;
}

export interface ReadingThemeControl {
  value: PdfPageTheme;
  onChange: (theme: PdfPageTheme) => void;
}

const compactButton = 'px-1.5 sm:px-2';

const READING_THEME_ORDER: readonly PdfPageTheme[] = ['light', 'night', 'sepia'];

const READING_THEME_META: Record<PdfPageTheme, { label: string; icon: ReactNode }> = {
  light: { label: 'Light page', icon: <SunIcon aria-hidden="true" className="h-4 w-4" /> },
  night: { label: 'Night page', icon: <MoonIcon aria-hidden="true" className="h-4 w-4" /> },
  sepia: { label: 'Sepia page', icon: <PaletteIcon aria-hidden="true" className="h-4 w-4" /> },
};

/**
 * The reading toolbar under the document header, shared by every reader:
 * contents and find on the left, the reader's position cluster in the centre
 * (`navigation` slot), and a menu for saving and viewing bookmarks on the
 * right. Document-level actions (zoom, export, settings) stay in the header.
 */
export function ReaderToolbar({
  activePanel,
  onTogglePanel,
  sentenceBookmark,
  navigation,
  readingTheme,
  hidden = false,
}: {
  activePanel: ReaderNavigationPanel | null;
  onTogglePanel: (panel: ReaderNavigationPanel) => void;
  sentenceBookmark: SentenceBookmarkControl;
  navigation?: ReactNode;
  /** Optional PDF page-theme cycle control. */
  readingTheme?: ReadingThemeControl;
  /** Keeps the toolbar's height while the reader is still loading. */
  hidden?: boolean;
}) {
  const contentsOpen = activePanel === 'contents';
  const searchOpen = activePanel === 'search';
  const bookmarksOpen = activePanel === 'bookmarks';
  return (
    <div
      role="toolbar"
      aria-label="Reader"
      data-reader-toolbar
      aria-hidden={hidden || undefined}
      className={cn(
        'flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line-soft bg-surface px-4 text-xs text-soft',
        hidden && 'invisible',
      )}
    >
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => onTogglePanel('contents')}
          active={contentsOpen}
          aria-label={contentsOpen ? 'Hide contents' : 'Open contents'}
          title="Contents"
          className={compactButton}
        >
          <ListIcon aria-hidden="true" className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => onTogglePanel('search')}
          active={searchOpen}
          aria-label={searchOpen ? 'Hide find in book' : 'Find in book'}
          title="Find in Book"
          className={compactButton}
        >
          <SearchIcon aria-hidden="true" className="h-4 w-4" />
        </ToolbarButton>
        {readingTheme && (
          <ToolbarButton
            onClick={() => {
              const next = READING_THEME_ORDER[
                (READING_THEME_ORDER.indexOf(readingTheme.value) + 1) % READING_THEME_ORDER.length
              ];
              readingTheme.onChange(next);
            }}
            aria-label={`Reading theme: ${READING_THEME_META[readingTheme.value].label} (cycles)`}
            title={`Reading theme: ${READING_THEME_META[readingTheme.value].label}`}
            className={compactButton}
          >
            {READING_THEME_META[readingTheme.value].icon}
          </ToolbarButton>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-center">{navigation}</div>
      <MenuRoot as="div" className="relative inline-flex shrink-0 items-center text-left">
        <MenuTrigger
          as={ToolbarButton}
          active={bookmarksOpen || sentenceBookmark.isBookmarked}
          aria-label="Bookmarks"
          title="Bookmarks"
          className={compactButton}
        >
          <BookmarkIcon aria-hidden="true" filled={sentenceBookmark.isBookmarked} className="h-4 w-4" />
        </MenuTrigger>
        <MenuTransition>
          <MenuItemsSurface anchor="bottom end" className="z-50 mt-1 min-w-[180px] focus:outline-none">
            <MenuActionItem
              onClick={sentenceBookmark.onToggle}
              disabled={!sentenceBookmark.canToggle}
            >
              <BookmarkIcon aria-hidden="true" filled={sentenceBookmark.isBookmarked} className="h-4 w-4" />
              {sentenceBookmark.isBookmarked ? 'Remove bookmark' : 'Save bookmark'}
            </MenuActionItem>
            <MenuActionItem onClick={() => {
              if (!bookmarksOpen) onTogglePanel('bookmarks');
            }}>
              <BookmarksListIcon aria-hidden="true" className="h-4 w-4" />
              View bookmarks
            </MenuActionItem>
          </MenuItemsSurface>
        </MenuTransition>
      </MenuRoot>
    </div>
  );
}

/** Previous · position · next, grouped as one cluster. */
export function ReaderPager({
  unit,
  onPrevious,
  onNext,
  canPrevious = true,
  canNext = true,
  position,
}: {
  /** Names the step, e.g. "page" or "section" ("Previous page"). */
  unit: string;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
  position: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <ToolbarButton
        onClick={onPrevious}
        disabled={!canPrevious}
        aria-label={`Previous ${unit}`}
        className={cn(compactButton, 'disabled:cursor-not-allowed disabled:opacity-50')}
      >
        <ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
      </ToolbarButton>
      {position}
      <ToolbarButton
        onClick={onNext}
        disabled={!canNext}
        aria-label={`Next ${unit}`}
        className={cn(compactButton, 'disabled:cursor-not-allowed disabled:opacity-50')}
      >
        <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

/** A plain `current / total` readout. */
export function ReaderPosition({ current, total }: { current: number; total: number }) {
  return (
    <span className="whitespace-nowrap px-1.5 tabular-nums">
      {current} / {total}
    </span>
  );
}

/** The page readout that opens a "go to page" field. */
export function PageJumpControl({
  currentPage,
  numPages,
  onGoToPage,
}: {
  currentPage: number;
  numPages: number;
  onGoToPage: (page: number) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [popoverKey, setPopoverKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const confirm = (close?: () => void) => {
    const parsed = Number.parseInt(inputValue, 10);
    if (Number.isNaN(parsed)) return;
    const page = Math.min(Math.max(parsed, 1), Math.max(1, numPages));
    close?.();
    if (page !== currentPage) onGoToPage(page);
    setInputValue('');
    if (close) {
      setPopoverKey((key) => key + 1);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  return (
    <PopoverRoot key={popoverKey} className="relative">
      {({ close }) => (
        <>
          <PopoverTrigger
            ref={triggerRef}
            className="whitespace-nowrap rounded-md bg-surface-sunken px-2 py-1 text-xs tabular-nums"
            onClick={() => {
              setInputValue('');
              window.setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
              }, 50);
            }}
          >
            {currentPage} / {numPages}
          </PopoverTrigger>
          <PopoverSurface anchor="bottom">
            <div className="flex flex-col space-y-2">
              <div className="text-xs font-medium text-foreground">Go to page</div>
              <Input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                controlSize="sm"
                className="w-20 appearance-none border-none text-center text-accent"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => confirm()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') confirm(close);
                }}
                placeholder={currentPage.toString()}
                aria-label="Page number"
              />
              <div className="text-center text-xs text-soft">of {numPages}</div>
            </div>
          </PopoverSurface>
        </>
      )}
    </PopoverRoot>
  );
}

/** How far through the playback plan the current sentence is. */
export function ReadingProgress() {
  const { currentSentenceOrdinal, playbackPlanSegmentCount } = useTTS();
  if (!playbackPlanSegmentCount || currentSentenceOrdinal === null) return null;
  const percent = Math.round(((currentSentenceOrdinal + 1) / playbackPlanSegmentCount) * 100);
  return (
    <span className="whitespace-nowrap tabular-nums" aria-label={`Reading position ${percent}%`}>
      {percent}%
    </span>
  );
}

/**
 * Draggable page scrubber with book-progress stats for paginated readers.
 *
 * While dragging, the visual position updates immediately but the seek commits
 * at most once every `COMMIT_DEBOUNCE_MS` (and on release), so scrubbing does
 * not flood the playback cursor with superseded page commands.
 */
export function ReaderPageScrubber({
  currentPage,
  numPages,
  onSeekPage,
}: {
  currentPage: number;
  numPages: number;
  onSeekPage: (page: number) => void;
}) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
  }, []);

  const commit = () => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    setDragValue(null);
    if (pending !== null && pending !== currentPage) onSeekPage(Math.min(Math.max(pending, 1), numPages));
  };

  const scheduleCommit = () => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(commit, 250);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const page = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(page)) return;
    pendingRef.current = page;
    setDragValue(page);
    scheduleCommit();
  };

  // Progress stats describe the settled reading position, not the drag preview.
  const percent = numPages > 1 ? Math.round(((currentPage - 1) / (numPages - 1)) * 100) : 100;
  const pagesLeft = Math.max(0, numPages - currentPage);
  const value = dragValue ?? currentPage;

  return (
    <div className="flex items-center gap-2" data-testid="page-scrubber">
      <input
        type="range"
        min={1}
        max={Math.max(1, numPages)}
        value={value}
        onChange={handleChange}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="pdf-page-scrubber h-1 w-16 cursor-pointer sm:w-28 md:w-36"
        aria-label="Reading position"
        title="Scrub pages"
      />
      <span
        className="hidden whitespace-nowrap text-xs tabular-nums text-faint lg:inline"
        aria-label={`Book ${percent} percent complete, ${pagesLeft} pages left`}
      >
        {percent}% · {pagesLeft} left
      </span>
    </div>
  );
}
