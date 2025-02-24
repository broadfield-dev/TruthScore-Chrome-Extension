console.log('Content script loaded on:', window.location.href);

let isAssessingActive = false;
let clickListener = null;
let consoleVisible = false;

// Function to draw a red box around the clicked element
function highlightClickedElement(element) {
  const originalOutline = element.style.outline;
  element.style.outline = '2px solid red';
  element.style.zIndex = '10001'; // Ensure it’s above other elements
  setTimeout(() => {
    element.style.outline = originalOutline;
  }, 3000); // Remove after 3 seconds
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
    highlightClickedElement(block); // Draw red box around the block
    return block.textContent.trim();
  }
  return '';
}

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
        logToConsole('Processing text: ' + text.slice(0, 50) + (text.length > 50 ? '...' : ''), 'info');
        chrome.runtime.sendMessage({ 
          action: 'assessTruthfulness', 
          text: text 
        }, function(response) {
          if (response && response.score !== undefined) {
            // Convert 0–1 probability to percentage for display (e.g., 0.98 → 98.00%)
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
              logToConsole(`LLM Response: ${response.fullResponse}`, 'info');
            }
          } else if (response && response.error) {
            logToConsole('Assessment failed', 'error', `Error: ${response.error}`);
            if (response.error.includes('API request failed')) {
              logToConsole('Possible causes:', 'error', '1. Invalid Groq API key\n2. Network issues\n3. Rate limit exceeded (check Hugging Face/Groq usage)');
            } else if (response.error.includes('Unable to determine score')) {
              logToConsole('Parsing issue:', 'error', 'The LLM response did not return a valid number between 0.01 and 1.00. Check the full response for formatting.');
            }
          } else {
            logToConsole('Unexpected response from API', 'error', 'No score or error provided. Check console for network issues.');
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

function clearConsole() {
  const consoleOutput = document.getElementById('console-output');
  if (consoleOutput) {
    consoleOutput.innerHTML = '';
    logToConsole('Console cleared', 'info');
  }
}

function injectConsole() {
  if (document.getElementById('truthfulness-console')) return;

  const consoleDiv = document.createElement('div');
  consoleDiv.id = 'truthfulness-console';
  consoleDiv.className = 'debug-visible'; // Add debug class for testing
  consoleDiv.innerHTML = `
    <div class="console-header">
      <span>Truthfulness Assessor Console</span>
      <button id="minimize-console">-</button>
    </div>
    <div id="console-output"></div>
    <div class="console-controls">
      <button id="toggle-assess" class="button">Enable Click Assessment</button>
      <button id="clear-console" class="button">Clear</button>
    </div>
  `;

  // Fallback for document.body
  const target = document.body || document.documentElement;
  if (target) {
    target.appendChild(consoleDiv);
  } else {
    console.error('No suitable DOM target found for console injection');
    return;
  }

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
      consoleDiv.style.height = '500px'; // Match your CSS height
    } else {
      output.style.display = 'none';
      controls.style.display = 'none';
      minimizeButton.textContent = '+';
      consoleDiv.style.height = 'auto';
    }
  });

  let isDragging = false;
  let currentX = 10; // Match your CSS left: 10px
  let currentY = 10; // Match your CSS top: 10px
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
  console.log('Console injected, checking visibility:', consoleDiv.style.display, consoleDiv.style.visibility);
}

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
    console.log('Console toggled, new display:', consoleDiv.style.display, 'visibility:', consoleDiv.style.visibility);
  } else {
    injectConsole();
    consoleVisible = true;
    logToConsole('Console injected on toggle');
    console.log('Console injected, checking visibility:', consoleDiv.style.display, consoleDiv.style.visibility);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'toggleConsole') {
    console.log('Received toggleConsole message in content script');
    toggleConsole();
    sendResponse({ consoleVisible: consoleVisible });
  }
  return true;
});
