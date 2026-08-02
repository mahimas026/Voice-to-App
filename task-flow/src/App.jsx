import { useEffect, useMemo, useState } from 'react'
import TaskForm from './components/TaskForm.jsx'
import TaskList from './components/TaskList.jsx'

const STORAGE_KEY = 'task-flow-tasks'

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export default function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [category, setCategory] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const categories = useMemo(
    () => [...new Set(tasks.map((task) => task.category).filter(Boolean))].sort(),
    [tasks],
  )
  const visibleTasks = category ? tasks.filter((task) => task.category === category) : tasks

  function addTask(fields) {
    setTasks((current) => [{ id: crypto.randomUUID(), ...fields }, ...current])
  }

  function toggleComplete(id) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task))
  }

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">PERSONAL TASK MANAGER</p>
        <h1>TaskFlow</h1>
        <p className="subtitle">A to-do list app where tasks can be organized by category and have due dates.</p>
      </header>
      <div className="dashboard">
        <TaskForm onAdd={addTask} />
        <section className="card tasks-card" aria-labelledby="tasks-heading">
          <div className="list-heading">
            <div><p className="eyebrow">YOUR WORK</p><h2 id="tasks-heading">Tasks</h2></div>
            <label className="filter-label">Filter by category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <TaskList tasks={visibleTasks} onToggleComplete={toggleComplete} />
        </section>
      </div>
    </main>
  )
}
