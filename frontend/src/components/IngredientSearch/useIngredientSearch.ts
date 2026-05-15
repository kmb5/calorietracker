import { useCallback, useEffect, useRef, useState } from "react";
import {
  getIngredientIngredientsIngredientIdGet,
  searchIngredientsIngredientsSearchGet,
} from "../../client/services.gen";
import type { IngredientDetail, IngredientSearchResult } from "../../client/types.gen";

const DEBOUNCE_MS = 300;

export type UseIngredientSearchReturn = {
  query: string;
  setQuery: (q: string) => void;
  results: IngredientSearchResult[];
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selected: IngredientSearchResult | null;
  select: (ingredient: IngredientSearchResult) => void;
  clear: () => void;
  detail: IngredientDetail | null;
  isDetailLoading: boolean;
  openDetail: (id: number) => void;
  closeDetail: () => void;
  highlightedIndex: number;
  setHighlightedIndex: (i: number) => void;
};

export function useIngredientSearch(): UseIngredientSearchReturn {
  const [query, setQueryRaw] = useState("");
  const [results, setResults] = useState<IngredientSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IngredientSearchResult | null>(null);
  const [detail, setDetail] = useState<IngredientDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    setHighlightedIndex(0);
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await searchIngredientsIngredientsSearchGet({ q: q.trim() });
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const select = useCallback((ingredient: IngredientSearchResult) => {
    setSelected(ingredient);
    setIsOpen(false);
    setQueryRaw("");
    setResults([]);
  }, []);

  const clear = useCallback(() => {
    setSelected(null);
    setQueryRaw("");
    setResults([]);
    setIsOpen(false);
  }, []);

  const openDetail = useCallback(async (id: number) => {
    setIsDetailLoading(true);
    setDetail(null);
    try {
      const data = await getIngredientIngredientsIngredientIdGet({ ingredientId: id });
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetail(null);
    setIsDetailLoading(false);
  }, []);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    isOpen,
    setIsOpen,
    selected,
    select,
    clear,
    detail,
    isDetailLoading,
    openDetail,
    closeDetail,
    highlightedIndex,
    setHighlightedIndex,
  };
}
