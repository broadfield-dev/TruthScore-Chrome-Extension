console.log('Background script loaded');

async function sendToGroqAPI(text) {
  const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const API_KEY = 'your_Groq_key'; // Replace with your Groq API key

  const prompt = `System Prompt: You are an assistant tasked with evaluating the truthfulness of statements and providing an 'Objective Truth Probability Score' between 0 and 1, where 1 indicates the statement is definitely true, and 0 indicates it is definitely false. Keep in mind that it is almost impossible to assess 0 or 1 probability without directly witnessing or conducting the experiment yourself, and history is difficult to verify. Assume that the statement is intended to be a statement of fact, not an opinion or subjective judgment. To accomplish this, follow these steps: 1. Understand the statement clearly, interpreting it in its most straightforward and common sense meaning. Look at each word in the statement like a function call and consider its meaning in the statement. 2. Search and Think about any relevant facts, data, or knowledge that supports the statement. 3. Search and Think about any relevant facts, data, or knowledge that contradicts or casts doubt on the statement. 4. Evaluate the credibility and reliability of the sources or the basis of your knowledge. 5. Consider if there are any exceptions, nuances, or contexts that might affect the truthfulness of the statement. 6. Ensure that your assessment is unbiased and does not rely on stereotypes. 7. Based on the above, assign a probability score that reflects your confidence in the statement's truthfulness. Finally, output only the score as a floating-point number between 0.01 and 1, rounded to two decimal places. Examples: - Statement: "The capital of France is Paris." 1.00 - Statement: "The moon is made of cheese." 0.01 - Statement: "Albert Einstein was born in 1879." 0.98 - Statement: "Barack Obama was the 44th President of the United States." 1.00 - Statement: "The Great Wall of China is visible from space." 0.62 Note: The score for the last statement is 0.62 because while the Great Wall can be seen from low Earth orbit under certain conditions, it's not visible from farther distances in space, leading to some ambiguity in its truthfulness.\nReturn only the score.\nStatement: ${text}\nAssistant:`;

  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  };
  const data = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 10
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const result = await response.json();
    return result.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error with Groq API:', error);
    return null;
  }
}

function parseScoreFromResponse(response) {
  if (!response) return null;
  const match = response.match(/^\d*\.\d{2}$/); // Match float with exactly 2 decimal places (e.g., 0.98, 1.00)
  if (match) {
    const score = parseFloat(match[0]);
    return score >= 0.01 && score <= 1 ? score : null; // Validate range
  }
  return null;
}

// Toggle console when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.url);

  // Check if the tab URL is injectable (http or https)
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('file://')) {
    console.log('Cannot toggle console on this page:', tab.url || 'No URL');
    return;
  }

  // Since content script is in manifest, it should already be loaded on matching pages.
  // Send the toggle message directly, but inject if needed as a fallback.
  chrome.tabs.sendMessage(tab.id, { type: 'toggleConsole' }, (response) => {
    console.log('Sent toggleConsole message, response:', response);
    if (chrome.runtime.lastError) {
      // If message fails (e.g., content script not loaded), inject it
      console.log('Content script not responding, injecting now...');
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error injecting content script:', chrome.runtime.lastError.message);
        } else {
          // Retry sending the toggle message after injection
          chrome.tabs.sendMessage(tab.id, { type: 'toggleConsole' }, (retryResponse) => {
            console.log('Retry toggleConsole response:', retryResponse);
            if (chrome.runtime.lastError) {
              console.error('Retry failed:', chrome.runtime.lastError.message);
            } else {
              console.log('Console toggled, now visible:', retryResponse?.consoleVisible);
            }
          });
        }
      });
    } else {
      console.log('Console toggled, now visible:', response?.consoleVisible);
    }
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'assessTruthfulness') {
    const text = request.text;
    sendToGroqAPI(text).then(response => {
      const score = parseScoreFromResponse(response);
      if (score !== null) {
        sendResponse({ 
          score: score,
          fullResponse: response
        });
      } else {
        sendResponse({ error: 'Unable to determine score' });
      }
    }).catch(error => {
      sendResponse({ error: 'API request failed' });
    });
    return true; // Async response
  }
});
