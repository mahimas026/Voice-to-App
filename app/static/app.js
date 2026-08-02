const recordButton = document.querySelector('#recordButton');
const parseButton = document.querySelector('#parseButton');
const transcript = document.querySelector('#transcript');
const status = document.querySelector('#status');
const result = document.querySelector('#result');

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let listening = false;

function setStatus(message) { status.textContent = message; }
function escapeHtml(value) { const box = document.createElement('div'); box.textContent = value; return box.innerHTML; }

if (!Recognition) {
  recordButton.disabled = true;
  setStatus('Speech recognition is unavailable in this browser. You can still type your idea.');
} else {
  recognition = new Recognition();
  recognition.lang = navigator.language || 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => { listening = true; recordButton.classList.add('active'); recordButton.lastChild.textContent = ' Listening…'; setStatus('Listening — describe your app.'); };
  recognition.onresult = (event) => {
    let text = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) text += event.results[index][0].transcript;
    transcript.value = text.trim();
  };
  recognition.onerror = (event) => setStatus(`Could not record (${event.error}). You can type your idea instead.`);
  recognition.onend = () => { listening = false; recordButton.classList.remove('active'); recordButton.lastChild.textContent = ' Record'; if (transcript.value) setStatus('Transcript captured. Review it, then turn it into a spec.'); };
  recordButton.addEventListener('click', () => listening ? recognition.stop() : recognition.start());
}

function renderSpec(spec) {
  const entityCards = spec.entities.map(entity => `<article class="entity"><h3>${escapeHtml(entity.name)}</h3><p>${entity.fields.map(escapeHtml).join(' · ')}</p></article>`).join('');
  result.hidden = false;
  result.innerHTML = `<div class="spec-title"><div><p class="eyebrow">PARSED SPEC</p><h2>${escapeHtml(spec.app_name)}</h2><p>${escapeHtml(spec.description)}</p></div><span class="confidence ${spec.confidence}">${spec.confidence} confidence</span></div><h3>Entities</h3><div class="entities">${entityCards}</div><h3>Features</h3><ul>${spec.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>${spec.clarification_needed ? `<div class="clarification"><p><strong>One question:</strong> ${escapeHtml(spec.clarification_needed)}</p><label for="answer">Optional answer</label><input id="answer" placeholder="Add context, or continue with this best guess" /></div>` : ''}<button id="buildButton" class="primary" type="button">Build this${spec.clarification_needed ? ' anyway' : ''}</button>`;
  document.querySelector('#buildButton').addEventListener('click', () => { setStatus('Spec confirmed. Stage 2 generation will use this exact spec.'); document.querySelector('#buildButton').textContent = 'Confirmed'; document.querySelector('#buildButton').disabled = true; });
}

parseButton.addEventListener('click', async () => {
  const text = transcript.value.trim();
  if (!text) { setStatus('Please record or type a description first.'); return; }
  parseButton.disabled = true;
  parseButton.textContent = 'Parsing…';
  setStatus('Converting your description into a validated app spec…');
  try {
    const response = await fetch('/parse-spec', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || 'Unable to parse this description.');
    renderSpec(body);
    setStatus('Spec parsed and validated.');
  } catch (error) { setStatus(error.message); }
  finally { parseButton.disabled = false; parseButton.textContent = 'Turn into a spec'; }
});
