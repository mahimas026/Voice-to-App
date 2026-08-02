const root = document.querySelector('#app');
let transcript = '', spec = null, recognition, listening = false;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const esc = (s) => { const x = document.createElement('span'); x.textContent = s; return x.innerHTML };

function recordScreen() {
  root.innerHTML = `<h2>What would you like to make?</h2><p>Speak your idea or type it below.</p><button id="mic" class="mic" ${Recognition ? '' : 'disabled'}>● Record</button><textarea id="text" rows="6" placeholder="Example: I need a to-do app with categories and due dates.">${esc(transcript)}</textarea><button id="done">Turn into a spec</button><p id="note">${Recognition ? 'Ready to listen.' : 'Speech recognition is not supported here—typing works just as well.'}</p>`;
  const text = root.querySelector('#text');
  text.addEventListener('input', () => transcript = text.value);
  root.querySelector('#done').onclick = () => transcript.trim() ? parseScreen() : showError('Please describe the app first.');
  if (Recognition) root.querySelector('#mic').onclick = () => toggleMic(text);
}
function toggleMic(text) {
  if (!recognition) { recognition = new Recognition(); recognition.interimResults = true; recognition.onresult = e => { transcript = [...e.results].map(r => r[0].transcript).join(' '); text.value = transcript }; recognition.onend = () => { listening=false; root.querySelector('#mic').textContent='● Record' }; }
  if (listening) recognition.stop(); else { listening=true; root.querySelector('#mic').textContent='■ Stop'; recognition.start(); }
}
async function parseScreen(answer = '') {
  root.innerHTML = `<div class="loading"><div class="spinner"></div><h2>Parsing your idea…</h2><p>Extracting entities and features.</p></div>`;
  try { const r = await fetch('/api/parse-spec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript,clarification_answer:answer})}); const data=await r.json(); if(!r.ok) throw Error(data.detail||'Sorry, I could not understand that clearly. Please try again.'); spec=data; confirmScreen(); } catch(e) { showError(e.message, recordScreen); }
}
function confirmScreen() {
  const entities = spec.entities.map(e=>`<li><strong>${esc(e.name)}</strong><span>${e.fields.map(esc).join(' · ')}</span></li>`).join('');
  root.innerHTML=`<p class="eyebrow">PARSED SPEC</p><h2>${esc(spec.app_name)}</h2><p>${esc(spec.description)}</p><h3>Entities</h3><ul>${entities}</ul><h3>Features</h3><ul>${spec.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>${spec.clarification_needed?`<div class="clarify"><strong>One question</strong><p>${esc(spec.clarification_needed)}</p><input id="answer" placeholder="Your answer"/><button id="refine">Refine spec</button><button id="anyway" class="secondary">Build anyway</button></div>`:`<button id="build">Build this</button>`}`;
  if(spec.clarification_needed){root.querySelector('#refine').onclick=()=>parseScreen(root.querySelector('#answer').value);root.querySelector('#anyway').onclick=buildScreen}else root.querySelector('#build').onclick=buildScreen;
}
async function buildScreen() {
  root.innerHTML=`<div class="loading"><div class="spinner"></div><h2>Building ${esc(spec.app_name)}…</h2><ol id="steps"><li class="active">Generating components…</li><li>Installing dependencies…</li><li>Running production build…</li></ol></div>`;
  const steps=[...root.querySelectorAll('#steps li')]; let i=0; const timer=setInterval(()=>{if(i<steps.length-1){steps[i++].classList.remove('active');steps[i].classList.add('active')}},1600);
  try { const r=await fetch('/api/build-app',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(spec)}); const data=await r.json(); clearInterval(timer); if(!r.ok||!data.success) throw Error(data.error||'Build failed.'); resultScreen(data); } catch(e) { clearInterval(timer); showError(e.message, buildScreen, 'Try again'); }
}
function resultScreen(data) { root.innerHTML=`<p class="eyebrow">BUILD SUCCEEDED</p><h2>${esc(spec.app_name)} is ready.</h2><p>${esc(data.summary)}</p><details><summary>Generated files</summary><pre>${esc(data.file_tree.join('\n'))}</pre></details><iframe title="Generated app preview" src="${data.preview_url}"></iframe><div class="actions"><a class="button" href="/api/download/${data.app_id}">Download project</a><button id="again" class="secondary">Build another app</button></div>`;root.querySelector('#again').onclick=()=>{transcript='';spec=null;recordScreen()}}
function showError(message, action=recordScreen, label='Try again') { root.innerHTML=`<h2>Something went wrong</h2><p class="error">${esc(message)}</p><button id="retry">${label}</button>`;root.querySelector('#retry').onclick=action; }
recordScreen();
