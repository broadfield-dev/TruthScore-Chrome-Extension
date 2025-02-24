console.log('Content script loaded on:', window.location.href);

let isAssessingActive = false;
let clickListener = null;
let consoleVisible = false;

// API configurations for dropdowns
const apiConfigs = {
  'huggingface-zero-shot': {
    name: 'Hugging Face Zero-Shot',
    models: ['facebook/bart-large-mnli', 'typeform/distilbert-base-uncased-mnli']
  },
  'huggingface-language': {
    name: 'Hugging Face Language',
    models: ['meta-llama/Llama-3-70b', 'google/gemma-7b']
  },
  'groq': {
    name: 'Groq',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768']
  },
  'openrouter': {
    name: 'OpenRouter',
    models: ['meta-llama/llama-3-8b-instruct', 'openrouter/deepseek-r1']
  },
  'togetherai': {
    name: 'Together AI',
    models: ['llama-3-8b', 'mistral-7b-instruct-v0.2']
  },
  'cohere': {
    name: 'Cohere',
    models: ['command-r-plus', 'command-light']
  },
  'xai': {
    name: 'xAI (Grok)',
    models: ['grok-beta', 'grok-2']
  },
  'openai': {
    name: 'OpenAI',
    models: ['gpt-3.5-turbo', 'gpt-4']
  },
  'google': {
    name: 'Google Gemini',
    models: ['gemini-1.5-pro', 'gemini-1.0-pro']
  }
};

// Function to draw a red box around the clicked element
function highlightClickedElement(element) {
  const originalOutline = element.style.outline;
  element.style.outline = '2px solid red';
  element.style.zIndex = '10001';
  setTimeout(() => {
    element.style.outline = originalOutline;
  }, 3000);
}

// Function to extract text from the clicked element or its closest block ancestor
function getTextFromClick(event) {
  let element = event.target;
  const blockTags = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'section', 'article', 'aside', 'main', 'nav', 'footer', 'header'];

  function getClosestBlockAncestor(el) {
    while (el && el.nodeName && blockTags.indexOf(el.nodeName.toLowerCase()) === -1) {
      el = el.parentElement;
    }
    return el;
  }

  let block = getClosestBlockAncestor(element);
  if (block && block.textContent.trim() !== '') {
    highlightClickedElement(block);
    return block.textContent.trim();
  }
  return '';
}

// Function to log messages to the console
function logToConsole(message, type = 'info', details = '') {
  const consoleOutput = document.getElementById('console-output');
  if (consoleOutput) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `[${new Date().toISOString()}] ${message}`;
    if (details) {
      logEntry.innerHTML += `<br><span class="log-details">Details: ${details}</span>`;
    }
    consoleOutput.appendChild(logEntry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  } else {
    console.error('Console output element not found:', message, details);
  }
}

// Toggle the assessment feature
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
        logToConsole('Processing text: ' + text.slice(0, 50) + (text.length > 50 ? '...' : ''), 'info');
        chrome.runtime.sendMessage({ 
          action: 'assessTruthfulness', 
          text: text,
          apiProvider: apiProvider,
          model: model
        }, function(response) {
          if (response && response.score !== undefined) {
            const percentageScore = (response.score * 100).toFixed(2);
            const scoreDisplay = document.createElement('div');
            scoreDisplay.textContent = `Objective Truth Probability: ${percentageScore}%`;
            scoreDisplay.style.position = 'absolute';
            scoreDisplay.style.left = `${event.clientX + 10}px`;
            scoreDisplay.style.top = `${event.clientY + 10}px`;
            scoreDisplay.style.backgroundColor = 'rgba(0, 128, 255, 0.9)';
            scoreDisplay.style.color = 'white';
            scoreDisplay.style.padding = '3px 8px';
            scoreDisplay.style.borderRadius = '3px';
            scoreDisplay.style.zIndex = '10000';
            document.body.appendChild(scoreDisplay);
            setTimeout(() => scoreDisplay.remove(), 3000);

            logToConsole(`Objective Truth Probability: ${percentageScore}%`, 'success');
            if (response.fullResponse) {
              logToConsole(`API Response: ${response.fullResponse}`, 'info');
            }
          } else if (response && response.error) {
            logToConsole('Assessment failed', 'error', `Error: ${response.error}`);
            if (response.error.includes('API key not set')) {
              logToConsole('Action required:', 'error', 'Update your API key in background.js and reload the extension.');
            } else if (response.error.includes('API request failed')) {
              logToConsole('Possible causes:', 'error', '1. Invalid API key\n2. Network issues\n3. Rate limit exceeded');
            } else if (response.error.includes('Invalid score format')) {
              logToConsole('Parsing issue:', 'error', 'The API response did not return a valid score between 0 and 1.');
            }
          } else {
            logToConsole('Unexpected response from API', 'error', 'No score or error provided.');
          }
        });
      } else {
        logToConsole('No text found at click location', 'warning', 'Ensure you clicked on a text-containing element.');
      }
    };
    document.addEventListener('click', clickListener, true);
    logToConsole('Click assessment enabled', 'success');
  } else {
    if (clickListener) {
      document.removeEventListener('click', clickListener, true);
      clickListener = null;
    }
    logToConsole('Click assessment disabled', 'info');
  }
}

// Clear the console output
function clearConsole() {
  const consoleOutput = document.getElementById('console-output');
  if (consoleOutput) {
    consoleOutput.innerHTML = '';
    logToConsole('Console cleared', 'info');
  }
}

// Inject the console UI with dropdowns
function injectConsole() {
  if (document.getElementById('truthfulness-console')) return;

  const consoleDiv = document.createElement('div');
  consoleDiv.id = 'truthfulness-console';
  consoleDiv.className = 'debug-visible';
  consoleDiv.innerHTML = `
    <div class="console-header">
      <span>Truthfulness Assessor Console</span>
      <button id="minimize-console">-</button>
    </div>
    <div id="console-output"></div>
    <div class="console-controls">
      <select id="api-provider"></select>
      <select id="api-model"></select>
      <button id="toggle-assess" class="button">Enable Click Assessment</button>
      <button id="clear-console" class="button">Clear</button>
    </div>
  `;

  const target = document.body || document.documentElement;
  if (target) {
    target.appendChild(consoleDiv);
  } else {
    console.error('No suitable DOM target found for console injection');
    return;
  }

  // Populate API provider dropdown
  const apiProviderSelect = document.getElementById('api-provider');
  for (let key in apiConfigs) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = apiConfigs[key].name;
    apiProviderSelect.appendChild(option);
  }

  // Populate model dropdown based on selected API
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
  updateModels(); // Initial population

  document.getElementById('toggle-assess').addEventListener('click', toggleAssessing);
  document.getElementById('clear-console').addEventListener('click', clearConsole);

  const minimizeButton = document.getElementById('minimize-console');
  const output = document.getElementById('console-output');
  const controls = consoleDiv.querySelector('.console-controls');
  minimizeButton.addEventListener('click', () => {
    if (output.style.display === 'none') {
      output.style.display = 'block';
      controls.style.display = 'flex';
      minimizeButton.textContent = '-';
      consoleDiv.style.height = '500px';
    } else {
      output.style.display = 'none';
      controls.style.display = 'none';
      minimizeButton.textContent = '+';
      consoleDiv.style.height = 'auto';
    }
  });

  let isDragging = false;
  let currentX = 10;
  let currentY = 10;
  let initialX, initialY;
  const header = consoleDiv.querySelector('.console-header');
  
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
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    header.style.cursor = 'grab';
  });

  consoleDiv.style.left = `${currentX}px`;
  consoleDiv.style.top = `${currentY}px`;

  consoleVisible = true;
  logToConsole('Console initialized', 'success');
}

// Toggle the console visibility
function toggleConsole() {
  const consoleDiv = document.getElementById('truthfulness-console');
  console.log('Toggling console, current state:', consoleDiv ? consoleDiv.style.display : 'Not found');
  if (consoleDiv) {
    consoleDiv.style.display = consoleDiv.style.display === 'none' ? 'block' : 'none';
    consoleVisible = consoleDiv.style.display === 'block';
    if (!consoleVisible && isAssessingActive) {
      toggleAssessing();
    }
    logToConsole(`Console toggled to ${consoleDiv.style.display}`);
  } else {
    injectConsole();
    consoleVisible = true;
    logToConsole('Console injected on toggle');
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'toggleConsole') {
    console.log('Received toggleConsole message in content script');
    toggleConsole();
    sendResponse({ consoleVisible: consoleVisible });
  }
  return true;
});
