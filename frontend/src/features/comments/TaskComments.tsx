import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass } from '../../shared/form-styles'
import { LoadingState } from '../../shared/ui'
import { projectKeys } from '../projects/api'
import { taskKey } from '../tasks/api'
import { formatDate } from '../workspaces/workspace-labels'
import { commentKeys, deleteComment, listComments, listMentionOptions, saveComment,
  type CommentFields, type CommentPerson, type TaskComment } from './api'

type MentionOptions = { people: CommentPerson[]; pending: boolean; error: unknown; retry: () => void }
type Refresh = (error?: unknown) => Promise<void>
const mentionName = (person: CommentPerson) => person.name ?? 'Unavailable member'

function CommentForm({ taskId, comment, options, refresh, onSaved, onCancel }: {
  taskId: string
  comment?: TaskComment
  options: MentionOptions
  refresh: Refresh
  onSaved: () => void
  onCancel?: () => void
}) {
  const [body, setBody] = useState(comment?.body ?? '')
  const [selected, setSelected] = useState(comment?.mentions ?? [])
  const save = useMutation({
    mutationFn: (fields: CommentFields) => saveComment(taskId, fields, comment?.id),
    onSuccess: onSaved,
    onSettled: (_result, error) => refresh(error),
  })
  const available = options.people.filter(({ id }) => !selected.some((person) => person.id === id))

  return <form className="space-y-3" onSubmit={(event) => {
    event.preventDefault()
    if (!body.trim() || save.isPending) return
    save.mutate({ body, mentionUserIds: selected.map(({ id }) => id) }, {
      onSuccess: () => {
        if (comment) return
        setBody('')
        setSelected([])
      },
    })
  }}>
    <fieldset className="space-y-3" disabled={save.isPending}>
      <label className="block text-sm font-medium">
        {comment ? 'Edit comment text' : 'Write a comment'}
        <textarea className={`${fieldClass} min-h-24 resize-y`} value={body} maxLength={5000} required
          onChange={(event) => setBody(event.target.value)} autoFocus={!!comment} />
      </label>
      <label className="block max-w-sm text-sm font-medium">
        Mention someone
        <select className={`${fieldClass} truncate`} value="" disabled={!available.length || selected.length >= 20}
          onChange={(event) => {
            const person = available.find(({ id }) => id === event.target.value)
            if (person) setSelected([...selected, person])
          }}>
          <option value="">{options.pending ? 'Loading project members…' : 'Choose a project member'}</option>
          {available.map((person) => <option key={person.id} value={person.id}>{mentionName(person)}</option>)}
        </select>
      </label>
      {!!options.error && <div className="flex flex-wrap items-center gap-2 text-sm">
        <p role="alert" className="text-danger">{apiErrorMessage(options.error)}</p>
        <button className="ui-button ui-secondary" type="button" onClick={options.retry}>Retry loading mentions</button>
      </div>}
      {!!selected.length && <ul className="flex flex-wrap gap-2" aria-label="Selected mentions">
        {selected.map((person) => <li key={person.id} className="min-w-0">
          <button className="ui-button ui-secondary max-w-full" type="button" aria-label={`Remove mention of ${mentionName(person)}`}
            onClick={() => setSelected(selected.filter(({ id }) => id !== person.id))}>
            <span className="truncate">@{mentionName(person)}</span><span aria-hidden="true">×</span>
          </button>
        </li>)}
      </ul>}
    </fieldset>
    {save.isError && <p role="alert" className={errorClass}>{apiErrorMessage(save.error)}</p>}
    <div className="flex flex-wrap gap-2">
      <button className="ui-button ui-primary" disabled={!body.trim() || save.isPending}>
        {save.isPending ? 'Saving…' : comment ? 'Save comment' : 'Post comment'}
      </button>
      {onCancel && <button type="button" className="ui-button ui-secondary" disabled={save.isPending} onClick={onCancel}>Cancel</button>}
    </div>
  </form>
}

function CommentItem({ taskId, comment, canEdit, options, refresh }: {
  taskId: string
  comment: TaskComment
  canEdit: boolean
  options: MentionOptions
  refresh: Refresh
}) {
  const [action, setAction] = useState<'edit' | 'delete' | null>(null)
  const remove = useMutation({
    mutationFn: () => deleteComment(taskId, comment.id),
    onSettled: (_result, error) => refresh(error),
  })

  return <li className="min-w-0 space-y-2 py-4">
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="min-w-0 break-words text-sm font-semibold">{comment.author.name ?? 'Unavailable author'}</span>
      <time className="text-xs text-secondary" dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
      {comment.revision > 1 && <span className="text-xs text-secondary">Edited</span>}
    </div>
    {canEdit && action === 'edit' ? <CommentForm taskId={taskId} comment={comment} options={options}
      refresh={refresh} onSaved={() => setAction(null)} onCancel={() => setAction(null)} /> : <>
      <p className="break-words whitespace-pre-wrap">{comment.body}</p>
      {!!comment.mentions.length && <ul className="flex flex-wrap gap-2" aria-label="Mentions">
        {comment.mentions.map((person) => <li key={person.id} className="ui-badge max-w-full break-words bg-selected text-accent-ink">
          @{mentionName(person)}
        </li>)}
      </ul>}
    </>}
    {canEdit && action === null && <div className="flex flex-wrap gap-2">
      <button className="ui-button ui-ghost" type="button" onClick={() => setAction('edit')}>Edit comment</button>
      <button className="ui-button ui-ghost" type="button" onClick={() => { remove.reset(); setAction('delete') }}>Delete comment</button>
    </div>}
    {canEdit && action === 'delete' && <div className="space-y-2">
      <p className="text-sm text-secondary">Permanently delete this comment?</p>
      {remove.isError && <p role="alert" className={errorClass}>{apiErrorMessage(remove.error)}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="ui-button ui-danger-solid" type="button" disabled={remove.isPending} onClick={() => remove.mutate()}>
          {remove.isPending ? 'Deleting…' : 'Confirm deletion'}
        </button>
        <button className="ui-button ui-secondary" type="button" disabled={remove.isPending} autoFocus onClick={() => setAction(null)}>Cancel</button>
      </div>
    </div>}
  </li>
}

export function TaskComments({ taskId, projectId, userId, editable }: {
  taskId: string; projectId: string; userId: string; editable: boolean
}) {
  const heading = useId()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const historyKey = commentKeys.history(userId, taskId)
  const mentionsKey = commentKeys.mentions(userId, taskId)
  const history = useQuery({
    queryKey: [...historyKey, page],
    queryFn: ({ signal }) => listComments(taskId, page, signal), retry: false, gcTime: 0,
  })
  const options = useQuery({
    queryKey: mentionsKey,
    queryFn: ({ signal }) => listMentionOptions(taskId, signal), enabled: editable, retry: false, gcTime: 0,
  })

  async function refresh(error?: unknown) {
    if (!error) {
      await client.invalidateQueries({ queryKey: historyKey })
    } else if (error instanceof ApiError) {
      if ([400, 403, 404].includes(error.status)) await client.invalidateQueries({ queryKey: mentionsKey })
      if (error.status === 404) await Promise.all([
        client.invalidateQueries({ queryKey: taskKey(userId, taskId) }),
        client.invalidateQueries({ queryKey: historyKey }),
      ])
      if (error.status === 409) await client.invalidateQueries({ queryKey: projectKeys.details(userId, projectId) })
    }
  }

  const mentionOptions = { people: options.data ?? [], pending: options.isPending, error: options.error, retry: () => void options.refetch() }
  return <section className="ui-panel min-w-0 space-y-4" aria-labelledby={heading}>
    <h2 id={heading} className="text-base font-semibold">Comments</h2>
    {editable && <CommentForm taskId={taskId} options={mentionOptions} refresh={refresh} onSaved={() => setPage(1)} />}
    {history.isPending && <LoadingState>Loading comments…</LoadingState>}
    {history.isError && <div className="space-y-2">
      <p role="alert" className={errorClass}>{apiErrorMessage(history.error)}</p>
      <button className="ui-button ui-secondary" type="button" onClick={() => void history.refetch()}>Retry loading comments</button>
    </div>}
    {history.isSuccess && <>
      {history.data.data.length === 0 && <p className="text-sm text-secondary">{page === 1 ? 'No comments yet.' : 'No comments on this page.'}</p>}
      <ul className="divide-y divide-line">
        {history.data.data.map((comment) => <CommentItem key={comment.id} taskId={taskId} comment={comment}
          canEdit={editable && comment.author.id === userId} options={mentionOptions} refresh={refresh} />)}
      </ul>
      {(page > 1 || history.data.pagination.totalPages > 1) && <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
        <button className="ui-button ui-secondary" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {Math.max(1, history.data.pagination.totalPages)}</span>
        <button className="ui-button ui-secondary" type="button" disabled={page >= history.data.pagination.totalPages}
          onClick={() => setPage(page + 1)}>Next</button>
      </div>}
    </>}
  </section>
}
