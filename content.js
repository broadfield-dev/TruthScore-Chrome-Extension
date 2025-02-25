console.log('Content script loaded on:', window.location.href);

let isAssessingActive = false;
let clickListener = null;
let consoleVisible = false;
let lastClickedText = '';

// API configurations
const apiConfigs = {
  'huggingface-zero-shot': { name: 'Hugging Face Zero-Shot', models: ['facebook/bart-large-mnli', 'typeform/distilbert-base-uncased-mnli'] },
  'huggingface-language': { name: 'Hugging Face Language', models: ['meta-llama/Llama-3-70b', 'google/gemma-7b'] },
  'groq': { name: 'Groq', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
  'openrouter': { name: 'OpenRouter', models: ['meta-llama/llama-3-8b-instruct', 'openrouter/deepseek-r1'] },
  'togetherai': { name: 'Together AI', models: ['llama-3-8b', 'mistral-7b-instruct-v0.2'] },
  'cohere': { name: 'Cohere', models: ['command-r-plus', 'command-light'] },
  'xai': { name: 'xAI (Grok)', models: ['grok-beta', 'grok-2'] },
  'openai': { name: 'OpenAI', models: ['gpt-3.5-turbo', 'gpt-4'] },
  'google': { name: 'Google Gemini', models: ['gemini-1.5-pro', 'gemini-1.0-pro'] }
};

// Prompt configurations
const promptConfigs = {
  'truthscore': { name: 'TruthScore', description: 'Provides an Objective Truth Probability Score (0-1).' },
  'fullreport': { name: 'Full Report', description: 'Detailed analysis including truth probability, reasoning, and confidence.' },
  'sentiment': { name: 'Sentiment', description: 'Analyzes sentiment (positive, negative, neutral) with a score.' },
  'summary': { name: 'Summary', description: 'Summarizes the text in a concise manner.' },
  'contradictions': { name: 'Contradictions', description: 'Identifies potential contradictions or inconsistencies.' },
  'logicalargument': { name: 'Logical Argument', description: 'Detects logical fallacies in the statement.' },
  'translate': { name: 'Translate to English', description: 'Translates the text into English.' }
};

// Highlight clicked element
function highlightClickedElement(element) {
  const originalOutline = element.style.outline;
  element.style.outline = '2px solid red';
  element.style.zIndex = '10001';
  setTimeout(() => element.style.outline = originalOutline, 3000);
}

// Extract text from clicked element
function getTextFromClick(event) {
  let element = event.target;
  const blockTags = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'section', 'article', 'aside', 'main', 'nav', 'footer', 'header'];

  const consoleDiv = document.getElementById('truthfulness-console');
  if (consoleDiv && consoleDiv.contains(element)) return '';

  function getClosestBlockAncestor(el) {
    while (el && el.nodeName && blockTags.indexOf(el.nodeName.toLowerCase()) === -1) {
      el = el.parentElement;
    }
    return el;
  }

  let block = getClosestBlockAncestor(element);
  if (block && block.textContent.trim() !== '') {
    highlightClickedElement(block);
    lastClickedText = block.textContent.trim();
    return lastClickedText;
  }
  return '';
}

// Format text for basic Markdown-like display
function formatResponse(text) {
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/^- (.*)$/gm, '<div class="list-item">$1</div>') // Lists
    .replace(/\n/g, '<br>'); // Line breaks
  return formatted;
}

// Log messages to console
function logToConsole(message, type = 'info', details = '') {
  const consoleOutput = document.getElementById('console-output');
  if (consoleOutput) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `[${new Date().toISOString()}] ${formatResponse(message)}`;
    if (details) {
      logEntry.innerHTML += `<br><span class="log-details">Details: ${formatResponse(details)}</span>`;
    }
    consoleOutput.appendChild(logEntry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  } else {
    console.error('Console output element not found:', message, details);
  }
}

// Toggle assessment
function toggleAssessing() {
  isAssessingActive = !isAssessingActive;
  const toggleButton = document.getElementById('toggle-assess');
  if (toggleButton) {
    toggleButton.textContent = isAssessingActive ? 'Disable Click Assessment' : 'Enable Click Assessment';
    toggleButton.className = isAssessingActive ? 'button active' : 'button';
  }

  if (isAssessingActive) {
    clickListener = function(event) {
      const text = getTextFromClick(event);
      if (text) {
        const apiProvider = document.getElementById('api-provider').value;
        const model = document.getElementById('api-model').value;
        const promptType = document.getElementById('prompt-type').value;
        const userPrompt = document.getElementById('user-prompt').value.trim();
        logToConsole('Processing text: ' + text.slice(0, 50) + (text.length > 50 ? '...' : ''));

        chrome.runtime.sendMessage({ 
          action: 'assessTruthfulness', 
          text: text,
          apiProvider: apiProvider,
          model: model,
          promptType: promptType,
          userPrompt: userPrompt || ''
        }, handleResponse);
      }
    };
    document.addEventListener('click', clickListener, true);
    logToConsole('Click assessment enabled', 'success');
  } else {
    if (clickListener) {
      document.removeEventListener('click', clickListener, true);
      clickListener = null;
    }
    logToConsole('Click assessment disabled');
  }
}

// Handle API response
function handleResponse(response) {
  if (response && !response.error) {
    const promptType = document.getElementById('prompt-type').value;
    if (promptType === 'truthscore') {
      const percentageScore = (response.score * 100).toFixed(2);
      logToConsole(`TruthScore: ${percentageScore}%`, 'success');
    } else {
      logToConsole(`Research Results:\n${response.result}`, 'success');
    }
  } else if (response && response.error) {
    logToConsole('Assessment failed', 'error', response.error);
  }
}

// Perform research
function performResearch() {
  const userPrompt = document.getElementById('user-prompt').value.trim();
  const combinedText = userPrompt + (lastClickedText ? '\nClicked Text: ' + lastClickedText : '');
  if (!combinedText) {
    logToConsole('No input provided for research', 'error');
    return;
  }
  const apiProvider = document.getElementById('api-provider').value;
  const model = document.getElementById('api-model').value;
  logToConsole('Performing research on: ' + combinedText.slice(0, 50) + '...');
  chrome.runtime.sendMessage({
    action: 'performResearch',
    text: combinedText,
    apiProvider: apiProvider,
    model: model
  }, handleResponse);
}

// Clear console
function clearConsole() {
  const consoleOutput = document.getElementById('console-output');
  if (consoleOutput) {
    consoleOutput.innerHTML = '';
    logToConsole('Console cleared');
  }
}

// Inject console UI
function injectConsole() {
  if (document.getElementById('truthfulness-console')) return;

  const consoleDiv = document.createElement('div');
  consoleDiv.id = 'truthfulness-console';
  consoleDiv.innerHTML = `
    <div class="console-header">
      <span>Truthfulness Assessor Console</span>
      <button id="minimize-console">-</button>
    </div>
    <div id="console-output"></div>
    <div class="console-controls">
      <select id="api-provider"></select>
      <select id="api-model"></select>
      <select id="prompt-type"></select>
      <input type="text" id="user-prompt" placeholder="Enter your prompt here" style="flex: 1 1 100%; margin: 5px 0;">
      <button id="toggle-assess" class="button">Enable Click Assessment</button>
      <button id="research-button" class="button">Perform Research</button>
      <button id="clear-console" class="button">Clear</button>
    </div>
    <div id="resize-handle" class="resize-handle"></div>
  `;

  document.body.appendChild(consoleDiv);

  const apiProviderSelect = document.getElementById('api-provider');
  for (let key in apiConfigs) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = apiConfigs[key].name;
    apiProviderSelect.appendChild(option);
  }

  const modelSelect = document.getElementById('api-model');
  function updateModels() {
    const selectedApi = apiProviderSelect.value;
    modelSelect.innerHTML = '';
    apiConfigs[selectedApi].models.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });
  }
  apiProviderSelect.addEventListener('change', updateModels);
  updateModels();

  const promptTypeSelect = document.getElementById('prompt-type');
  for (let key in promptConfigs) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = promptConfigs[key].name;
    promptTypeSelect.appendChild(option);
  }

  document.getElementById('toggle-assess').addEventListener('click', toggleAssessing);
  document.getElementById('research-button').addEventListener('click', performResearch);
  document.getElementById('clear-console').addEventListener('click', clearConsole);

  let isDragging = false, isResizing = false, currentX = 10, currentY = 10, initialX, initialY, initialWidth;
  const header = consoleDiv.querySelector('.console-header');
  const minimizeButton = document.getElementById('minimize-console');
  const output = document.getElementById('console-output');
  const controls = consoleDiv.querySelector('.console-controls');
  const resizeHandle = document.getElementById('resize-handle');

  minimizeButton.addEventListener('click', () => {
    if (output.style.display === 'none') {
      output.style.display = 'block';
      controls.style.display = 'flex';
      minimizeButton.textContent = '-';
    } else {
      output.style.display = 'none';
      controls.style.display = 'none';
      minimizeButton.textContent = '+';
    }
  });

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    initialX = e.clientX - currentX;
    initialY = e.clientY - currentY;
    header.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      consoleDiv.style.left = `${currentX}px`;
      consoleDiv.style.top = `${currentY}px`;
    }
    if (isResizing) {
      const widthDiff = e.clientX - initialX;
      const newWidth = initialWidth + widthDiff;
      if (newWidth >= 200) consoleDiv.style.width = `${newWidth}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    header.style.cursor = 'grab';
  });

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    initialWidth = consoleDiv.offsetWidth;
    initialX = e.clientX;
    e.preventDefault();
  });

  consoleDiv.style.left = `${currentX}px`;
  consoleDiv.style.top = `${currentY}px`;

  consoleVisible = true;
  logToConsole('Console initialized', 'success');
}

// Toggle console
function toggleConsole() {
  const consoleDiv = document.getElementById('truthfulness-console');
  if (consoleDiv) {
    consoleDiv.style.display = consoleDiv.style.display === 'none' ? 'block' : 'none';
    consoleVisible = consoleDiv.style.display === 'block';
    if (!consoleVisible && isAssessingActive) toggleAssessing();
  } else {
    injectConsole();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'toggleConsole') {
    toggleConsole();
    sendResponse({ consoleVisible });
  }
  return true;
});
