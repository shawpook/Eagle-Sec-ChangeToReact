import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Asset } from '../shared/types'

/**
 * Asset lookup for the preview stage. Eagle's item model is mapped to the
 * OrcaBox `Asset` shape; `updateAsset` currently only needs the favorite
 * toggle (star mapping) used by the document stage.
 */
export function useAsset(assetId: string | null) {
  return useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => (assetId ? api.asset.get(assetId) : null),
    enabled: Boolean(assetId),
    staleTime: 1000 * 60 * 2,
  })
}

export function useUpdateAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: { favorite?: boolean; rating?: number } }) => {
      if (typeof input.favorite === 'boolean') {
        return api.asset.updateFavorite(id, input.favorite)
      }
      return api.asset.get(id)
    },
    onSuccess: (asset) => {
      if (asset) queryClient.setQueryData(['asset', asset.id], asset)
    },
  })
}
