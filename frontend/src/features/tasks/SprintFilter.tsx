import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import { getSprint, listSprints, sprintKeys } from '../sprints/api'

export function SprintFilter({ projectId, userId, selected }: { projectId: string; userId: string; selected: string }) {
  const [value, setValue] = useState(selected)
  const options = useInfiniteQuery({
    queryKey: [...sprintKeys.project(userId, projectId), 'task-filter'],
    queryFn: ({ pageParam, signal }) => listSprints(projectId, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: ({ pagination }) => pagination.page < pagination.totalPages ? pagination.page + 1 : undefined,
    retry: false,
  })
  const sprints = new Map(options.data?.pages.flatMap(({ data }) => data.map(({ id, name }) => [id, name] as const)))
  const missing = value !== '' && value !== 'none' && !sprints.has(value)
  const selectedSprint = useQuery({
    queryKey: sprintKeys.detail(userId, projectId, value),
    queryFn: ({ signal }) => getSprint(value, signal),
    enabled: missing && /^[a-f\d]{24}$/.test(value), retry: false, gcTime: 0,
  })
  return <div className="min-w-0">
    <label className="block text-sm font-medium">Sprint
      <select name="sprintId" className={`${fieldClass} truncate`} value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="">All sprints</option>
        <option value="none">No sprint</option>
        {missing && <option value={value}>{selectedSprint.data?.projectId === projectId ? selectedSprint.data.name : 'Selected sprint'}</option>}
        {[...sprints].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
    {options.isPending && <p className="mt-1 text-xs text-secondary">Loading sprints…</p>}
    {options.isError && <p className={`${errorClass} mt-1 text-xs`} role="alert">Could not load sprints.{' '}
      <button type="button" className={linkClass} onClick={() => void options.refetch()}>Retry</button>
    </p>}
    {options.hasNextPage && <button type="button" className={`${linkClass} mt-1 text-sm`} disabled={options.isFetchingNextPage}
      onClick={() => void options.fetchNextPage()}>{options.isFetchingNextPage ? 'Loading…' : 'Load more sprints'}</button>}
  </div>
}
