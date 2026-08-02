const root = document.querySelector('#app');
let transcript = '', spec = null, recognition, listening = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const esc = (s) => { const x = document.createElement('span'); x.textContent = s; return x.innerHTML };

function recordScreen() {
  root.innerHTML = `<h2>What would you like to make?</h2><p>Tap record, then describe the app you want to build.</p><button id="mic" class="mic" type="button">● Start recording</button><textarea id="text" rows="6" readonly placeholder="Your spoken description will appear here.">${esc(transcript)}</textarea><button id="done" ${transcript.trim() ? '' : 'disabled'}>Turn into a spec</button><p id="note">${SpeechRecognition ? 'Ready to listen.' : 'Voice recognition is unavailable in this browser. Open this app in Chrome or Edge to record.'}</p>`;
  const text = root.querySelector('#text'), mic = root.querySelector('#mic'), done = root.querySelector('#done'), note = root.querySelector('#note');
  done.onclick = () => transcript.trim() && parseScreen();
  if (!SpeechRecognition) { mic.disabled = true; return; }
  mic.onclick = () => toggleMic(text, mic, done, note);
}
function toggleMic(text, mic, done, note) {
  if (!recognition) {
    recognition = new SpeechRecognition(); recognition.lang = navigator.language || 'en-US'; recognition.interimResults = true;
    recognition.onresult = (event) => { transcript = [...event.results].map((result) => result[0].transcript).join(' ').trim(); text.value = transcript; done.disabled = !transcript; };
    recognition.onerror = (event) => { note.textContent = `Recording failed: ${event.error}. Allow microphone access and try again.`; };
    recognition.onend = () => { listening = false; mic.textContent = '● Start recording'; if (transcript) note.textContent = 'Transcript captured. Turn it into a spec when ready.'; };
  }
  if (listening) recognition.stop(); else { transcript = ''; text.value = ''; done.disabled = true; listening = true; mic.textContent = '■ Stop recording'; note.textContent = 'Listening... describe your app.'; recognition.start(); }
}
async function parseScreen(answer = '') {
  root.innerHTML = `<div class="loading"><div class="spinner"></div><h2>Parsing your idea...</h2><p>Extracting entities and features.</p></div>`;
  try { const r = await fetch('/api/parse-spec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript,clarification_answer:answer})}); const data=await r.json(); if(!r.ok) throw Error(data.detail||'Sorry, I could not understand that clearly. Please try again.'); spec=data; confirmScreen(); } catch(e) { showError(e.message, recordScreen); }
}
function confirmScreen() {
  const entities = spec.entities.map(e=>`<li><strong>${esc(e.name)}</strong><span>${e.fields.map(esc).join(' · ')}</span></li>`).join('');
  root.innerHTML=`<p class="eyebrow">PARSED SPEC</p><h2>${esc(spec.app_name)}</h2><p>${esc(spec.description)}</p><h3>Entities</h3><ul>${entities}</ul><h3>Features</h3><ul>${spec.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>${spec.clarification_needed?`<div class="clarify"><strong>One question</strong><p>${esc(spec.clarification_needed)}</p><input id="answer" placeholder="Your answer"/><button id="refine">Refine spec</button><button id="anyway" class="secondary">Build anyway</button></div>`:`<button id="build">Build this</button>`}`;
  if(spec.clarification_needed){root.querySelector('#refine').onclick=()=>parseScreen(root.querySelector('#answer').value);root.querySelector('#anyway').onclick=buildScreen}else root.querySelector('#build').onclick=buildScreen;
}
async function buildScreen() {
  root.innerHTML=`<div class="loading"><div class="spinner"></div><h2>Building ${esc(spec.app_name)}...</h2><ol id="steps"><li class="active">Generating components...</li><li>Installing dependencies...</li><li>Running production build...</li></ol></div>`;
  const steps=[...root.querySelectorAll('#steps li')]; let i=0; const timer=setInterval(()=>{if(i<steps.length-1){steps[i++].classList.remove('active');steps[i].classList.add('active')}},1600);
  try { const r=await fetch('/api/build-app',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(spec)}); const data=await r.json(); clearInterval(timer); if(!r.ok||!data.success) throw Error(data.error||'Build failed.'); resultScreen(data); } catch(e) { clearInterval(timer); showError(e.message, buildScreen, 'Try again'); }
}
function resultScreen(data) { root.innerHTML=`<p class="eyebrow">BUILD SUCCEEDED</p><h2>${esc(spec.app_name)} is ready.</h2><p>${esc(data.summary)}</p><details><summary>Generated files</summary><pre>${esc(data.file_tree.join('\n'))}</pre></details><iframe title="Generated app preview" src="${data.preview_url}"></iframe><div class="actions"><a class="button" href="/api/download/${data.app_id}">Download project</a><button id="again" class="secondary">Build another app</button></div>`;root.querySelector('#again').onclick=()=>{transcript='';spec=null;recordScreen()}}
function showError(message, action=recordScreen, label='Try again') { root.innerHTML=`<h2>Something went wrong</h2><p class="error">${esc(message)}</p><button id="retry">${label}</button>`;root.querySelector('#retry').onclick=action; }
recordScreen();
