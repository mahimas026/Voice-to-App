import { useState } from 'react'

const initialForm = { title: '', category: '', due_date: '', completed: false }

export default function TaskForm({ onAdd }) {
  const [form, setForm] = useState(initialForm)

  function updateField(event) {
    const { name, type, checked, value } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  function submit(event) {
    event.preventDefault()
    if (!form.title.trim()) return
    onAdd({ ...form, title: form.title.trim(), category: form.category.trim() })
    setForm(initialForm)
  }

  return (
    <section className="card form-card" aria-labelledby="new-task-heading">
      <p className="eyebrow">CREATE TASK</p>
      <h2 id="new-task-heading">What needs doing?</h2>
      <form onSubmit={submit}>
        <label>Title<input name="title" value={form.title} onChange={updateField} placeholder="e.g. Book dentist appointment" required /></label>
        <label>Category<input name="category" value={form.category} onChange={updateField} placeholder="e.g. Personal" /></label>
        <label>Due date<input name="due_date" type="date" value={form.due_date} onChange={updateField} /></label>
        <label className="checkbox-label"><input name="completed" type="checkbox" checked={form.completed} onChange={updateField} /> Already complete</label>
        <button type="submit">Add task</button>
      </form>
    </section>
  )
}
