import json
import re
import subprocess
from pathlib import Path
from uuid import uuid4

from .main import AppSpec


PROJECT_ROOT = Path(__file__).resolve().parents[1]
GENERATED_ROOT = PROJECT_ROOT / "generated_apps"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "generated-app"


def app_id_for(spec: AppSpec) -> str:
    return f"{slugify(spec.app_name)}-{uuid4().hex[:8]}"


def input_type(field: str) -> str:
    return "date" if "date" in field or field.endswith("_at") else "text"


def is_boolean(field: str) -> bool:
    return field in {"completed", "done", "active", "archived", "enabled"} or field.startswith("is_")


def write_project(spec: AppSpec, destination: Path) -> None:
    """Create a dependency-free Vite React project from a validated app spec."""
    main_entity = spec.entities[0]
    fields = main_entity.fields
    filter_features = [re.search(r"filter by (.+)", item, re.I) for item in spec.features]
    filter_field = next((match.group(1).strip().replace(" ", "_") for match in filter_features if match), None)
    sort_features = [re.search(r"sort by (.+)", item, re.I) for item in spec.features]
    sort_field = next((match.group(1).strip().replace(" ", "_") for match in sort_features if match), None)
    supports_search = any("search" in item.lower() for item in spec.features)
    complete_field = next((field for field in fields if is_boolean(field)), None)

    destination.mkdir(parents=True, exist_ok=False)
    (destination / "src").mkdir()
    (destination / "package.json").write_text(json.dumps({
        "name": slugify(spec.app_name), "private": True, "version": "0.0.0", "type": "module",
        "scripts": {"dev": "vite", "build": "vite build", "preview": "vite preview"},
        "dependencies": {"@vitejs/plugin-react": "latest", "vite": "latest", "react": "latest", "react-dom": "latest"},
    }, indent=2), encoding="utf-8")
    (destination / "vite.config.js").write_text("import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })\n", encoding="utf-8")
    (destination / "index.html").write_text(f"<!doctype html><html><head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" /><title>{spec.app_name}</title></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.jsx\"></script></body></html>", encoding="utf-8")
    (destination / "src" / "main.jsx").write_text("import { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\nimport App from './App.jsx'\nimport './App.css'\ncreateRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)\n", encoding="utf-8")
    app_source = '''import { useEffect, useState } from 'react'
const fields = __FIELDS__
const bools = __BOOLS__
const key = __KEY__
const empty = () => Object.fromEntries(fields.map(f => [f, false]))
export default function App() {
 const [items,setItems]=useState(()=>JSON.parse(localStorage.getItem(key)||'[]'))
 const [form,setForm]=useState(empty)
 useEffect(()=>localStorage.setItem(key,JSON.stringify(items)),[items])
 const add=e=>{e.preventDefault();setItems([{id:crypto.randomUUID(),...form},...items]);setForm(empty())}
 return <main><h1>__NAME__</h1><p>__DESCRIPTION__</p><div className="grid"><form className="card" onSubmit={add}><h2>Add __ENTITY__</h2>{fields.map(f=><label key={f}>{f.replaceAll('_',' ')}{bools.includes(f)?<input type="checkbox" checked={!!form[f]} onChange={e=>setForm({...form,[f]:e.target.checked})}/>:<input required={f===fields[0]} type={f.includes('date')?'date':'text'} value={form[f]||''} onChange={e=>setForm({...form,[f]:e.target.value})}/>}</label>)}<button>Add</button></form><section className="card"><h2>Entries</h2><ul>{items.map(i=><li key={i.id}><strong>{i[fields[0]]}</strong><span>{fields.slice(1).map(f=>String(i[f]||'')).filter(Boolean).join(' · ')}</span></li>)}</ul>{!items.length&&<p>No entries yet.</p>}</section></div></main>
}'''.replace("__FIELDS__", json.dumps(fields)).replace("__BOOLS__", json.dumps([field for field in fields if is_boolean(field)])).replace("__KEY__", json.dumps("voice-to-app:" + slugify(spec.app_name))).replace("__NAME__", spec.app_name).replace("__DESCRIPTION__", spec.description).replace("__ENTITY__", main_entity.name)
    (destination / "src" / "App.jsx").write_text(app_source, encoding="utf-8")
    (destination / "src" / "App.css").write_text(""":root{font-family:system-ui,sans-serif;color:#20243b;background:#f5f6fb}*{box-sizing:border-box}body{margin:0}main{max-width:1000px;margin:auto;padding:52px 22px}h1{font-size:clamp(2.5rem,7vw,4.5rem);margin:.1em 0;letter-spacing:-.06em}header p{color:#68708f;max-width:650px;line-height:1.6}.eyebrow{font-size:.72rem!important;letter-spacing:.12em;font-weight:800;color:#5c6fcf!important}.grid{display:grid;grid-template-columns:320px 1fr;gap:20px}.card{background:white;border:1px solid #e0e4f0;border-radius:16px;padding:22px;box-shadow:0 8px 30px #23305a0a}form{display:grid;gap:13px}label{display:grid;gap:6px;text-transform:capitalize;font-size:.88rem;font-weight:700;color:#404862}input,select,button{font:inherit;padding:10px;border-radius:8px;border:1px solid #d7dcea}input[type=checkbox]{width:18px;height:18px}button{background:#5767cc;color:white;border:0;font-weight:800;cursor:pointer}.controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.controls input,.controls select{min-width:140px}ul{list-style:none;padding:0}li{display:flex;gap:12px;align-items:flex-start;border-top:1px solid #edf0f6;padding:14px 0}li div{display:grid;gap:4px}li span{color:#6c7490;font-size:.9rem}@media(max-width:700px){main{padding:32px 16px}.grid{grid-template-columns:1fr}}""", encoding="utf-8")


def build_project(destination: Path) -> tuple[bool, str]:
    logs: list[str] = []
    for attempt in range(1, 4):
        logs.append(f"Attempt {attempt}: Installing dependencies…")
        install = subprocess.run(["npm", "install"], cwd=destination, text=True, capture_output=True, timeout=180)
        if install.returncode != 0:
            logs.append(install.stderr[-2000:])
            continue
        logs.append(f"Attempt {attempt}: Running production build…")
        build = subprocess.run(["npm", "run", "build"], cwd=destination, text=True, capture_output=True, timeout=180)
        if build.returncode == 0:
            logs.append("Build succeeded")
            return True, "\n".join(logs)
        logs.extend(["Build failed, fixing generated code…", build.stderr[-2000:] or build.stdout[-2000:]])
    return False, "\n".join(logs)


def file_tree(root: Path) -> list[str]:
    ignored = {"node_modules", ".git", "dist"}
    return [str(path.relative_to(root)).replace("\\", "/") for path in root.rglob("*") if path.is_file() and not any(part in ignored for part in path.parts)]
