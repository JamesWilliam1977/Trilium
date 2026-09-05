import "./collection_filter.css";

import type { HighlightedTokenInfo } from "@triliumnext/commons";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import FNote from "../../entities/fnote";
import { t } from "../../services/i18n";
import type LoadResults from "../../services/load_results";
import searchService from "../../services/search";
import ActionButton from "../react/ActionButton";
import FormTextBox from "../react/FormTextBox";
import { useTriliumEvent } from "../react/hooks";

/** How long changes are left to settle before the active filter is re-run over them. */
const RERUN_DEBOUNCE_MS = 300;

export interface CollectionFilter {
    /** The submitted query, empty while no filter is active. */
    query: string;
    /** The notes the query matches, or null while no filter is active. */
    matchedNoteIds: Set<string> | null;
    /** The tokens the matches were found by, for highlighting them where the notes are drawn. */
    highlightedTokens: HighlightedTokenInfo[] | null;
    /** What is wrong with the query, or null. An erroneous query keeps the previous matches. */
    error: string | null;
    setQuery: (query: string) => void;
}

interface FilterMatches {
    matchedNoteIds: Set<string> | null;
    highlightedTokens: HighlightedTokenInfo[] | null;
}

const NO_MATCHES: FilterMatches = { matchedNoteIds: null, highlightedTokens: null };

/**
 * Narrows a collection to the notes matching a search query, using the full search syntax.
 *
 * The query runs server-side, scoped to the collection's subtree, and the result is a membership
 * set: the view keeps its own enumeration and order and only leaves out the notes not in the set.
 * Search results are a snapshot, so while a filter is active it is re-run (debounced) whenever an
 * entity change touches the collection.
 */
export function useCollectionFilter(note: FNote, {
    persistedQuery, onQueryChanged, collectionNoteIds
}: {
    /** The stored query the filter starts from, so it survives reopening the collection. */
    persistedQuery: string | undefined;
    /** Reports a submitted query, for the view to persist. Called with "" when cleared. */
    onQueryChanged: (query: string) => void;
    /** The notes the collection shows, deciding which entity changes re-run the filter. */
    collectionNoteIds: string[];
}): CollectionFilter {
    const [ query, setQuery ] = useState(persistedQuery ?? "");
    const [ matches, setMatches ] = useState<FilterMatches>(NO_MATCHES);
    const [ error, setError ] = useState<string | null>(null);
    // Runs resolve on the server, so an older one can land after a newer one; only the latest run
    // is allowed to set the result.
    const runSeqRef = useRef(0);
    const rerunTimerRef = useRef<number>();
    const collectionSet = useMemo(() => new Set(collectionNoteIds), [ collectionNoteIds ]);
    const collectionSetRef = useRef(collectionSet);
    collectionSetRef.current = collectionSet;

    async function run(activeQuery: string) {
        const seq = ++runSeqRef.current;
        let response;
        try {
            response = await searchService.searchInSubtree(activeQuery, note.noteId);
        } catch (e) {
            console.error("Failed to run the collection filter:", e);
            if (seq === runSeqRef.current) {
                setError(t("collection_filter.fetch-error"));
            }
            return;
        }

        if (seq !== runSeqRef.current) {
            return;
        }

        if (response.error) {
            // The previous matches stay shown: a broken query must not blank the collection.
            setError(response.error);
            return;
        }

        setError(null);
        setMatches({
            matchedNoteIds: new Set(response.searchResultNoteIds),
            highlightedTokens: response.highlightedTokens
        });
    }

    // Adopt a query stored elsewhere: the persisted one on mount, or one another view submitted.
    useEffect(() => {
        setQuery(persistedQuery ?? "");
    }, [ note.noteId, persistedQuery ]);

    // Resolve the submitted query, or drop the filter when it is cleared.
    useEffect(() => {
        window.clearTimeout(rerunTimerRef.current);
        if (!query.trim()) {
            runSeqRef.current++;
            setError(null);
            setMatches(NO_MATCHES);
            return;
        }
        run(query);
    }, [ note.noteId, query ]);

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (!query.trim() || !touchesCollection(loadResults, collectionSetRef.current, note.noteId)) {
            return;
        }
        window.clearTimeout(rerunTimerRef.current);
        rerunTimerRef.current = window.setTimeout(() => run(query), RERUN_DEBOUNCE_MS);
    });

    useEffect(() => () => window.clearTimeout(rerunTimerRef.current), []);

    return {
        query,
        ...matches,
        error,
        setQuery: (newQuery: string) => {
            const trimmed = newQuery.trim();
            setQuery(trimmed);
            onQueryChanged(trimmed);
        }
    };
}

/**
 * The filter box a collection header shows: Enter submits what is typed, the button or an emptied
 * box clears the filter, and a query error is shown under the box. What is typed but not submitted
 * is local to the box, so an unrelated redraw does not apply a half-typed query.
 */
export function CollectionFilterInput({ filter }: { filter: CollectionFilter }) {
    const [ typed, setTyped ] = useState(filter.query);
    const inputRef = useRef<HTMLInputElement>(null);

    // Adopt a query submitted elsewhere, or the stored one arriving on mount.
    useEffect(() => setTyped(filter.query), [ filter.query ]);

    const isActive = !!filter.query;

    return (
        <div className={clsx("collection-filter", { active: isActive })}>
            <FormTextBox
                inputRef={inputRef}
                currentValue={typed}
                placeholder={t("collection_filter.placeholder")}
                title={t("collection_filter.tooltip")}
                onChange={setTyped}
                onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        filter.setQuery(typed);
                    } else if (e.key === "Escape" && typed !== filter.query) {
                        // Give up what was typed, keeping the submitted query; a second Escape is
                        // left for whatever the view does with it.
                        e.stopPropagation();
                        setTyped(filter.query);
                    }
                }}
            />
            {(!!typed || isActive) && (
                <ActionButton
                    className="collection-filter-clear"
                    icon="bx bx-x"
                    text={t("collection_filter.clear")}
                    onClick={() => {
                        setTyped("");
                        filter.setQuery("");
                        inputRef.current?.focus();
                    }}
                />
            )}
            {filter.error && <span className="collection-filter-error">{filter.error}</span>}
        </div>
    );
}

/** Whether any changed note, attribute or branch belongs to the collection's subtree. */
function touchesCollection(
    loadResults: LoadResults, collectionNoteIds: Set<string>, collectionNoteId: string
) {
    const inCollection = (noteId: string | null | undefined) =>
        !!noteId && (noteId === collectionNoteId || collectionNoteIds.has(noteId));

    return loadResults.getNoteIds().some(inCollection)
        || loadResults.getAttributeRows().some(attr => inCollection(attr.noteId))
        || loadResults.getBranchRows().some(branch =>
            inCollection(branch.noteId) || inCollection(branch.parentNoteId));
}
