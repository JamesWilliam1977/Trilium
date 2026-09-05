import "./collection_filter.css";

import type { HighlightedTokenInfo } from "@triliumnext/commons";
import type { Tooltip } from "bootstrap";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import FNote from "../../entities/fnote";
import { t } from "../../services/i18n";
import type LoadResults from "../../services/load_results";
import searchService from "../../services/search";
import ActionButton from "../react/ActionButton";
import FormTextBox from "../react/FormTextBox";
import { useStaticTooltip, useTriliumEvent } from "../react/hooks";

/** How long to wait after a change before re-running the active filter. */
const RERUN_DEBOUNCE_MS = 300;

// Hover only: the box is typed into, and a tooltip opened by the focus would sit over the header
// for as long as the query is being written.
const TOOLTIP_CONFIG: Partial<Tooltip.Options> = {
    title: t("collection_filter.tooltip"),
    placement: "bottom",
    trigger: "hover",
    animation: false
};

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
 * The result is a membership set, not an order: a view keeps its own enumeration and leaves out
 * the notes the set does not name. A search result is a snapshot, so an active filter re-runs
 * when an entity change touches the collection.
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
    // A run resolves on the server, so an older one can land after a newer one. Only the latest
    // run sets the result.
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
        const collection = collectionSetRef.current;
        if (!query.trim() || !touchesCollection(loadResults, collection, note.noteId)) {
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
 * The filter box for a collection header, styled after the quick search box. Enter or the search
 * button submits what is typed, and the clear button beside it drops the filter.
 *
 * What is typed is held here until it is submitted, so an unrelated redraw cannot apply a
 * half-typed query.
 */
export function CollectionFilterInput({ filter, placeholder }: {
    filter: CollectionFilter;
    /** Names the collection being filtered, for a view that has a word for what it holds. */
    placeholder?: string;
}) {
    const [ typed, setTyped ] = useState(filter.query);
    const inputRef = useRef<HTMLInputElement>(null);
    useStaticTooltip(inputRef, TOOLTIP_CONFIG);

    // Adopt a query submitted elsewhere, or the stored one arriving on mount.
    useEffect(() => setTyped(filter.query), [ filter.query ]);

    const isActive = !!filter.query;

    return (
        <div className={clsx("collection-filter", { active: isActive })}>
            <FormTextBox
                inputRef={inputRef}
                currentValue={typed}
                placeholder={placeholder ?? t("collection_filter.placeholder")}
                onChange={setTyped}
                onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        filter.setQuery(typed);
                    } else if (e.key === "Escape" && typed !== filter.query) {
                        // Drops what was typed and keeps the submitted query. A second Escape
                        // reaches the view, which handles it as usual.
                        e.stopPropagation();
                        setTyped(filter.query);
                    }
                }}
            />
            <div className="collection-filter-buttons">
                {(!!typed || isActive) && (
                    <ActionButton
                        className="collection-filter-clear"
                        noIconActionClass
                        icon="bx bx-x"
                        text={t("collection_filter.clear")}
                        onClick={() => {
                            setTyped("");
                            filter.setQuery("");
                            inputRef.current?.focus();
                        }}
                    />
                )}
                <ActionButton
                    className="collection-filter-submit"
                    noIconActionClass
                    icon="bx bx-search"
                    text={t("collection_filter.submit")}
                    onClick={() => filter.setQuery(typed)}
                />
            </div>
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
