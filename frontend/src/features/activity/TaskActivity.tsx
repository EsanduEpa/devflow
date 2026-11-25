import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass } from '../../shared/form-styles'
import { LoadingState } from '../../shared/ui'
import { taskPriorityLabels, taskStatusLabels } from '../tasks/task-labels'
import { activityKey, listActivity, type ActivityChange } from './api'

const activityDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function changeLabels(change: ActivityChange) {
  switch (change.field) {
    case 'assigneeId':
      return {
        field: 'Assignee',
        from: change.from ? change.fromLabel ?? 'Unavailable member' : 'Unassigned',
        to: change.to ? change.toLabel ?? 'Unavailable member' : 'Unassigned',
      }
    case 'sprintId':
      return {
        field: 'Sprint',
        from: change.from ? change.fromLabel ?? 'Unavailable sprint' : 'Project backlog',
        to: change.to ? change.toLabel ?? 'Unavailable sprint' : 'Project backlog',
      }
    case 'priority':
      return {
        field: 'Priority',
        from: change.from ? taskPriorityLabels[change.from] : '',
        to: change.to ? taskPriorityLabels[change.to] : '',
      }
    case 'status':
      return {
        field: 'Status',
        from: change.from ? taskStatusLabels[change.from] : '',
        to: change.to ? taskStatusLabels[change.to] : '',
      }
  }
}

export function TaskActivity({ taskId, userId }: { taskId: string; userId: string }) {
  const heading = useId()
  const [page, setPage] = useState(1)
  const history = useQuery({
    queryKey: [...activityKey(userId, taskId), page],
    queryFn: ({ signal }) => listActivity(taskId, page, signal), retry: false, gcTime: 0,
  })

  return <section className="ui-panel min-w-0 space-y-3" aria-labelledby={heading}>
    <h2 id={heading} className="text-base font-semibold">Activity</h2>
    {history.isPending && <LoadingState>Loading task activity…</LoadingState>}
    {history.isError && <div className="space-y-2">
      <p role="alert" className={errorClass}>{apiErrorMessage(history.error)}</p>
      <button className="ui-button ui-secondary" type="button" onClick={() => void history.refetch()}>Retry loading activity</button>
    </div>}
    {history.isSuccess && <>
      {!history.data.data.length && <p className="text-sm text-secondary">{page === 1 ? 'No activity recorded yet.' : 'No activity on this page.'}</p>}
      {!!history.data.data.length && <ol className="divide-y divide-line">
        {history.data.data.map((entry) => <li key={entry.id} className="space-y-1 py-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="min-w-0 break-words font-semibold">{entry.actor.name ?? 'Unavailable member'}</span>
            <span>{entry.action === 'TASK_CREATED' ? 'created the task' : entry.completed ? 'completed the task' : 'updated the task'}</span>
            <time className="text-xs text-secondary" dateTime={entry.createdAt}>{activityDate.format(new Date(entry.createdAt))}</time>
          </div>
          <ul className="space-y-1 break-words text-sm text-secondary">
            {entry.changes.map((change) => {
              const { field, from, to } = changeLabels(change)
              return <li key={change.field}>
                <span className="font-medium">{field}</span>
                {entry.action === 'TASK_CREATED' ? ` set to ${to}` : ` changed from ${from} to ${to}`}
              </li>
            })}
          </ul>
        </li>)}
      </ol>}
      {(page > 1 || history.data.pagination.totalPages > 1) && <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
        <button className="ui-button ui-secondary" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Newer activity</button>
        <span>Page {page} of {Math.max(1, history.data.pagination.totalPages)}</span>
        <button className="ui-button ui-secondary" type="button" disabled={page >= history.data.pagination.totalPages}
          onClick={() => setPage(page + 1)}>Older activity</button>
      </div>}
    </>}
  </section>
}
