export default function TaskList({ tasks, onToggleComplete }) {
  if (!tasks.length) return <p className="empty">No tasks here yet. Add one to get started.</p>

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li className={task.completed ? 'task done' : 'task'} key={task.id}>
          <label className="complete-control">
            <input type="checkbox" checked={task.completed} onChange={() => onToggleComplete(task.id)} />
            <span className="sr-only">Mark {task.title} complete</span>
          </label>
          <div className="task-copy"><strong>{task.title}</strong><span>{task.category || 'Uncategorized'}{task.due_date ? ` · Due ${new Date(`${task.due_date}T00:00:00`).toLocaleDateString()}` : ''}</span></div>
          <span className="status">{task.completed ? 'Complete' : 'Open'}</span>
        </li>
      ))}
    </ul>
  )
}
