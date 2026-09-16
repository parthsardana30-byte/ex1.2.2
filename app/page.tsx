"use client";

import { Check, ChevronLeft, Clock3, FilePenLine, LoaderCircle, Menu, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { useAppDispatch, useAppSelector, useAppStore } from "@/lib/hooks";
import { selectAllPlatforms, type Platform, type PlatformKey } from "@/lib/features/platforms/platformsSlice";
import { deletePost, hydratePosts, postCreated, postUpdated, savePost, selectAllPosts, selectPostById, selectPostCount, selectPostsStatus, type Post, type PostCategory } from "@/lib/features/posts/postsSlice";
import { makeSelectFilteredPosts, makeSelectPostMetrics, selectPostCategoryCounts, type PostFilter } from "@/lib/features/posts/selectors";

type SaveState = "idle" | "saving" | "saved";
type DraftToolInput = { id?: string; title?: string; content?: string; category?: PostCategory };
type Metrics = { words: number; characters: number; readingMinutes: number };
type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: DraftToolInput) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };

const categories = ["All", "Article", "Social", "Newsletter", "Notes"] as const;
const formatDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));

const DraftCard = memo(function DraftCard({ draft, active, onSelect }: { draft: Post; active: boolean; onSelect: (id: string) => void }) {
  return <button className={active ? "draft-card active" : "draft-card"} type="button" onClick={() => onSelect(draft.id)} aria-pressed={active}>
    <div className="draft-card-top"><span className={`category-dot ${draft.category.toLowerCase()}`} /><span>{draft.category}</span><time dateTime={draft.updatedAt}>{formatDate(draft.updatedAt)}</time></div>
    <strong>{draft.title || "Untitled draft"}</strong><p>{draft.content || "No content yet"}</p>
  </button>;
});

const EditorPane = memo(function EditorPane({ draft, isReady, saveState, metrics, platforms, onOpenList, onCreate, onUpdate, onTogglePlatform, onSave, onDelete }: {
  draft?: Post; isReady: boolean; saveState: SaveState; metrics: Metrics; platforms: Platform[];
  onOpenList: () => void; onCreate: () => void; onUpdate: (changes: Partial<Pick<Post, "title" | "content" | "category" | "platformIds">>) => void;
  onTogglePlatform: (id: PlatformKey) => void; onSave: () => void; onDelete: () => void;
}) {
  if (!draft) return isReady
    ? <div className="empty-editor"><span><FilePenLine size={28} /></span><h2>Your next idea starts here</h2><p>Create a draft to begin writing.</p><button type="button" onClick={onCreate}><Plus size={17} /> New draft</button></div>
    : <div className="loading-editor"><LoaderCircle className="spin" size={25} /><span>Opening your drafts…</span></div>;

  return <div className="editor-page">
    <div className="editor-toolbar"><button className="back-button" type="button" onClick={onOpenList}><ChevronLeft size={18} /> All drafts</button><div className={`save-indicator ${saveState}`} aria-live="polite">{saveState === "saving" ? <><LoaderCircle className="spin" size={15} /> Saving…</> : saveState === "saved" ? <><Check size={15} /> Saved</> : <><Clock3 size={15} /> Unsaved changes</>}</div><span /></div>
    <div className="editor-content">
      <label className="category-control">Type<select value={draft.category} onChange={(event) => onUpdate({ category: event.target.value as PostCategory })}><option>Article</option><option>Social</option><option>Newsletter</option><option>Notes</option></select></label>
      <input className="title-input" value={draft.title} onChange={(event) => onUpdate({ title: event.target.value })} placeholder="Untitled draft" aria-label="Draft title" />
      <div className="meta-line"><span>Created {formatDate(draft.createdAt)}</span><i /><span>{metrics.words} words</span><i /><span>{metrics.characters} characters</span>{metrics.readingMinutes > 0 && <><i /><span>{metrics.readingMinutes} min read</span></>}</div>
      <div className="platform-row" aria-label="Publishing platforms">{platforms.map((platform) => <button key={platform.id} type="button" className={draft.platformIds.includes(platform.id) ? "selected" : ""} onClick={() => onTogglePlatform(platform.id)} aria-pressed={draft.platformIds.includes(platform.id)} style={{ "--platform-color": platform.color } as React.CSSProperties}>{platform.name}</button>)}</div>
      <div className="paper-rule" />
      <textarea className="content-input" value={draft.content} onChange={(event) => onUpdate({ content: event.target.value })} placeholder="Start writing. Your ideas are safe here…" aria-label="Draft content" />
    </div>
    <footer className="editor-footer"><div><button className="delete-button" type="button" onClick={onDelete} disabled={saveState === "saving"}><Trash2 size={17} /> Delete</button><button className="save-button" type="button" onClick={onSave} disabled={saveState === "saving"}>{saveState === "saving" ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Save draft</button></div></footer>
  </div>;
});

export default function Home() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const platforms = useAppSelector(selectAllPlatforms);
  const draftCount = useAppSelector(selectPostCount);
  const categoryCounts = useAppSelector(selectPostCategoryCounts);
  const requestStatus = useAppSelector(selectPostsStatus);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<PostFilter>("All");
  const [isReady, setIsReady] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const filteredSelector = useMemo(() => makeSelectFilteredPosts(), []);
  const metricsSelector = useMemo(() => makeSelectPostMetrics(), []);
  const filteredDrafts = useAppSelector((state) => filteredSelector(state, deferredQuery, filter));
  const activeDraft = useAppSelector((state) => selectPostById(state, activeId));
  const metrics = useAppSelector((state) => metricsSelector(state, activeId));
  const saveState: SaveState = requestStatus === "saving" || requestStatus === "deleting" ? "saving" : requestStatus === "saved" ? "saved" : "idle";

  useEffect(() => {
    void dispatch(hydratePosts()).unwrap().then((posts) => setActiveId(posts[0]?.id ?? "")).catch(() => {
      toast.error("Saved drafts could not be read", { description: "A fresh Redux workspace has been opened." });
    }).finally(() => setIsReady(true));
  }, [dispatch]);

  useEffect(() => {
    if (!isReady) return;
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const allowedCategories = ["Article", "Social", "Newsletter", "Notes"] as const;
    const tools = [
      {
        name: "list_drafts", title: "List drafts", description: "List the post drafts currently saved in this browser.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({ drafts: selectAllPosts(store.getState()).map(({ id, title, category, updatedAt }) => ({ id, title: title || "Untitled draft", category, updatedAt })) }),
      },
      {
        name: "create_draft", title: "Create draft", description: "Create and save a new post draft, then open it in the editor.",
        inputSchema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, category: { type: "string", enum: allowedCategories } }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input: DraftToolInput) => { if (input.category && !allowedCategories.includes(input.category)) throw new Error("Choose a valid draft category."); const action = postCreated(); dispatch(action); dispatch(postUpdated({ id: action.payload.id, changes: { title: input.title ?? "", content: input.content ?? "", category: input.category ?? "Article" } })); setActiveId(action.payload.id); await dispatch(savePost(action.payload.id)).unwrap(); return { created: true, id: action.payload.id }; },
      },
      {
        name: "update_draft", title: "Update draft", description: "Update and save the title, content, or category of an existing draft.",
        inputSchema: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, content: { type: "string" }, category: { type: "string", enum: allowedCategories } }, required: ["id"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input: DraftToolInput) => { if (!selectPostById(store.getState(), input.id ?? "")) throw new Error("Draft not found."); if (input.category && !allowedCategories.includes(input.category)) throw new Error("Choose a valid draft category."); const changes = { ...(input.title !== undefined && { title: input.title }), ...(input.content !== undefined && { content: input.content }), ...(input.category !== undefined && { category: input.category }) }; dispatch(postUpdated({ id: input.id!, changes })); setActiveId(input.id!); const result = await dispatch(savePost(input.id!)).unwrap(); return { updated: true, id: input.id, updatedAt: result.savedAt }; },
      },
      {
        name: "delete_draft", title: "Delete draft", description: "Permanently delete one locally saved draft by its ID.",
        inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input: DraftToolInput) => { if (!selectPostById(store.getState(), input.id ?? "")) throw new Error("Draft not found."); await dispatch(deletePost(input.id!)).unwrap(); setActiveId(selectAllPosts(store.getState())[0]?.id ?? ""); return { deleted: true, id: input.id }; },
      },
    ];
    tools.forEach((tool) => { void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); });
    return () => lifecycle.abort();
  }, [dispatch, isReady, store]);

  const updateActive = useCallback((changes: Partial<Pick<Post, "title" | "content" | "category" | "platformIds">>) => {
    if (activeId) dispatch(postUpdated({ id: activeId, changes }));
  }, [activeId, dispatch]);
  const createDraft = useCallback(() => { const action = postCreated(); dispatch(action); setActiveId(action.payload.id); setQuery(""); setFilter("All"); setMobileListOpen(false); toast.info("Blank draft created"); }, [dispatch]);
  const selectDraft = useCallback((id: string) => { setActiveId(id); setMobileListOpen(false); }, []);
  const saveDraft = useCallback(async () => {
    const current = selectPostById(store.getState(), activeId);
    if (!current || (!current.title.trim() && !current.content.trim())) { toast.error("Add a title or some content first"); return; }
    try { await dispatch(savePost(activeId)).unwrap(); toast.success("Draft saved from the Redux store"); }
    catch (error) { toast.error("Draft could not be saved", { description: String(error) }); }
  }, [activeId, dispatch, store]);
  const deleteDraft = useCallback(async () => {
    const current = selectPostById(store.getState(), activeId);
    if (!current) return;
    try { await dispatch(deletePost(activeId)).unwrap(); setActiveId(selectAllPosts(store.getState())[0]?.id ?? ""); setDeleteOpen(false); toast.success(`“${current.title || "Untitled draft"}” deleted`); }
    catch (error) { toast.error("Draft could not be deleted", { description: String(error) }); }
  }, [activeId, dispatch, store]);
  const togglePlatform = useCallback((platformId: PlatformKey) => {
    const current = selectPostById(store.getState(), activeId);
    if (!current) return;
    const platformIds = current.platformIds.includes(platformId) ? current.platformIds.filter((id) => id !== platformId) : [...current.platformIds, platformId];
    dispatch(postUpdated({ id: activeId, changes: { platformIds } }));
  }, [activeId, dispatch, store]);
  const openList = useCallback(() => setMobileListOpen(true), []);
  const requestDelete = useCallback(() => setDeleteOpen(true), []);

  return <main className="draft-app">
    <Toaster position="top-right" />
    <header className="app-header">
      <a className="brand" href="#workspace" aria-label="Draft It home"><span className="brand-symbol"><FilePenLine size={19} /></span><span>Draft It</span></a>
      <span />
      <div className="header-actions"><button className="mobile-menu" type="button" aria-label="Show drafts" onClick={openList}><Menu size={20} /></button><span className="avatar" aria-label="Personal workspace">P</span></div>
    </header>
    <section className="workspace" id="workspace">
      <aside className="rail" aria-label="Workspace navigation"><div className="rail-mark"><Sparkles size={18} /></div><nav><button className="active" type="button" aria-label="Drafts"><FilePenLine size={19} /><span>Drafts</span></button></nav><div className="rail-footer"><span>PD</span></div></aside>
      <aside className={mobileListOpen ? "draft-sidebar mobile-open" : "draft-sidebar"}>
        <div className="sidebar-top">
          <div className="title-row"><h1>Drafts</h1><button className="close-list" type="button" aria-label="Close drafts" onClick={() => setMobileListOpen(false)}><X size={19} /></button></div>
          <button className="new-draft" type="button" onClick={createDraft}><Plus size={17} /> New draft</button>
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search drafts" aria-label="Search drafts" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</label>
          <div className="filter-row" aria-label="Filter drafts">{categories.map((item) => <button key={item} className={filter === item ? "active" : ""} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}<span>{categoryCounts[item]}</span></button>)}</div>
        </div>
        <div className="draft-list" aria-live="polite">
          {!isReady ? Array.from({ length: 3 }).map((_, index) => <div className="draft-skeleton" key={index}><span /><span /><span /></div>) : filteredDrafts.length ? filteredDrafts.map((draft) => <DraftCard key={draft.id} draft={draft} active={draft.id === activeId} onSelect={selectDraft} />) : <div className="empty-list"><Search size={22} /><strong>No drafts found</strong><p>Try another search or start a new draft.</p></div>}
        </div><p className="draft-count">{draftCount} draft{draftCount === 1 ? "" : "s"}</p>
      </aside>
      <section className="editor-shell"><EditorPane draft={activeDraft} isReady={isReady} saveState={saveState} metrics={metrics} platforms={platforms} onOpenList={openList} onCreate={createDraft} onUpdate={updateActive} onTogglePlatform={togglePlatform} onSave={saveDraft} onDelete={requestDelete} /></section>
    </section>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent className="delete-dialog"><AlertDialogHeader><AlertDialogTitle>Delete this draft?</AlertDialogTitle><AlertDialogDescription>“{activeDraft?.title || "Untitled draft"}” will be permanently removed from this device.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep draft</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={deleteDraft}>Delete draft</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
