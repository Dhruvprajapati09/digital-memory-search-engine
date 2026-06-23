import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  searchDocuments,
  fetchSearchHistory,
  fetchSearchStats,
  deleteSearchHistoryItem,
  clearSearchHistory,
} from '../services/searchService'
import type { SearchParams } from '../types/search'

export const searchKeys = {
  all: ['search'] as const,
  results: (params: SearchParams) =>
    [...searchKeys.all, 'results', params] as const,
  history: () => [...searchKeys.all, 'history'] as const,
  stats: () => [...searchKeys.all, 'stats'] as const,
}

export function useSearchQuery(
  params: SearchParams | null,
  enabled = true,
) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: params ? searchKeys.results(params) : searchKeys.all,
    queryFn: async () => {
      const result = await searchDocuments(params!)
      await queryClient.invalidateQueries({ queryKey: searchKeys.history() })
      await queryClient.invalidateQueries({ queryKey: searchKeys.stats() })
      return result
    },
    enabled: enabled && Boolean(params?.q?.trim()),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useSearchHistory() {
  return useQuery({
    queryKey: searchKeys.history(),
    queryFn: async () => {
      const data = await fetchSearchHistory()
      return data.history
    },
    staleTime: 60_000,
  })
}

export function useSearchStats() {
  return useQuery({
    queryKey: searchKeys.stats(),
    queryFn: fetchSearchStats,
    staleTime: 60_000,
  })
}

export function useDeleteSearchHistoryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSearchHistoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchKeys.history() })
    },
  })
}

export function useClearSearchHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearSearchHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchKeys.history() })
    },
  })
}
