console.log('Background script loaded');

// Hardcoded API keys (users replace these placeholders)
const API_KEYS = {
  HUGGINGFACE: 'YOUR_HUGGINGFACE_API_KEY', // 'YOUR_HUGGINGFACE_API_KEY',
  GROQ: 'YOUR_GROQ_API_KEY', // 'YOUR_GROQ_API_KEY',
  OPENROUTER: 'YOUR_OPENROUTER_API_KEY', // 'YOUR_OPENROUTER_API_KEY',
  TOGETHERAI: 'YOUR_TOGETHERAI_API_KEY', // 'YOUR_TOGETHERAI_API_KEY',
  COHERE: 'YOUR_COHERE_API_KEY', // 'YOUR_COHERE_API_KEY',
  XAI: 'YOUR_XAI_API_KEY', // 'YOUR_XAI_API_KEY',
  OPENAI: 'YOUR_OPENAI_API_KEY', // 'YOUR_OPENAI_API_KEY',
  GOOGLE: 'YOUR_GOOGLE_API_KEY' // 'YOUR_GOOGLE_API_KEY'
};

// API-specific base URLs
const API_URLS = {
  HUGGINGFACE: 'https://api-inference.huggingface.co/models/',
  GROQ: 'https://api.groq.com/openai/v1/chat/completions',
  OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
  TOGETHERAI: 'https://api.together.ai/v1/chat/completions',
  COHERE: 'https://api.cohere.ai/v2/chat',
  XAI: 'https://api.x.ai/v1/chat/completions',
  OPENAI: 'https://api.openai.com/v1/chat/completions',
  GOOGLE: 'https://generativelanguage.googleapis.com/v1beta/models/'
};

// Assess truthfulness based on selected API and model
function assessTruthfulness(text, apiProvider, model) {
  return new Promise((resolve) => {
    let headers, data, url;

    // Standard prompt for chat-based APIs
    const chatPrompt = `Evaluate the truthfulness of this statement and provide an 'Objective Truth Probability Score' between 0 and 1, where 1 is definitely true and 0 is definitely false. Consider facts, contradictions, and context. Output only the score as a float with two decimal places.\nStatement: "${text}"`;

    // Hugging Face (Zero-shot or Language)
    if (apiProvider.startsWith('huggingface')) {
      if (!API_KEYS.HUGGINGFACE || API_KEYS.HUGGINGFACE === 'YOUR_HUGGINGFACE_API_KEY') {
        resolve({ error: 'Hugging Face API key not set.' });
        return;
      }
      headers = { 'Authorization': `Bearer ${API_KEYS.HUGGINGFACE}`, 'Content-Type': 'application/json' };
      url = `${API_URLS.HUGGINGFACE}${model}`;

      if (apiProvider === 'huggingface-zero-shot') {
        data = { inputs: text, parameters: { candidate_labels: ['true', 'false'] } };
      } else if (apiProvider === 'huggingface-language') {
        data = { inputs: chatPrompt, parameters: { max_new_tokens: 10, return_full_text: false } };
      }
    }

    // Groq
    else if (apiProvider === 'groq') {
      if (!API_KEYS.GROQ || API_KEYS.GROQ === 'YOUR_GROQ_API_KEY') {
        resolve({ error: 'Groq API key not set.' });
        return;
      }
      headers = { 'Authorization': `Bearer ${API_KEYS.GROQ}`, 'Content-Type': 'application/json' };
      url = API_URLS.GROQ;
      data = { model: model, messages: [{ role: 'user', content: chatPrompt }], max_tokens: 10 };
    }

    // OpenRouter
    else if (apiProvider === 'openrouter') {
      if (!API_KEYS.OPENROUTER || API_KEYS.OPENROUTER === 'YOUR_OPENROUTER_API_KEY') {
        resolve({ error: 'OpenRouter API key not set.' });
        return;
      }
      headers = { 'Authorization': `Bearer ${API_KEYS.OPENROUTER}`, 'Content-Type': 'application/json' };
      url = API_URLS.OPENROUTER;
      data = { model: model, messages: [{ role: 'user', content: chatPrompt }], max_tokens: 10 };
    }

    // Together AI
    else if (apiProvider === 'togetherai') {
      if (!API_KEYS.TOGETHERAI || API_KEYS.TOGETHERAI === 'YOUR_TOGETHERAI_API_KEY') {
        resolve({ error: 'Together AI API key not set.' });
        return;
      }
      headers = { 'Authorization': `Bearer ${API_KEYS.TOGETHERAI}`, 'Content-Type': 'application/json' };
      url = API_URLS.TOGETHERAI;
      data = { model: model, messages: [{ role: 'user', content: chatPrompt }], max_tokens: 10 };
    }

    // Cohere
    else if (apiProvider === 'cohere') {
      if (!API_KEYS.COHERE || API_KEYS.COHERE === 'YOUR_COHERE_API_KEY') {
        resolve({ error: 'Cohere API key not set.' });
        return;
      }
      headers = { 'Authorization': `Bearer ${API_KEYS.COHERE}`, 'Content-Type': 'application/json' };
      url = API_URLS.COHERE;
      data = { message: chatPrompt, model: model, max_tokens: 10 };
    }

    // xAI (Grok API)
    else if (apiProvider === 'xai') {
      if (!API_KEYS.XAI || API_KEYS.XAI === 'YOUR_XAI_API_KEY') {
        resolve({ error: 'xAI API key not set.' });
        return;
      }
      headers = { 'Authorization': `Bearer ${API_KEYS.XAI}`, 'Content-Type': 'application/json' };
      url = API_URLS.XAI;
      data = { model: model, messages: [{ role: 'user', content: chatPrompt }], max_tokens: 10 };
    }

    // OpenAI
    else if (apiProvider === 'openai') {
      if (!API_KEYS.OPENAI || API_KEYS.OPENAI === 'YOUR_OPENAI_API_KEY') {
        resolve({ error: 'OpenAI API key not set.' });
        return;
      }
      headers = { 'Authorization': `Bearer ${API_KEYS.OPENAI}`, 'Content-Type': 'application/json' };
      url = API_URLS.OPENAI;
      data = { model: model, messages: [{ role: 'user', content: chatPrompt }], max_tokens: 10 };
    }

    // Google Gemini API
    else if (apiProvider === 'google') {
      if (!API_KEYS.GOOGLE || API_KEYS.GOOGLE === 'YOUR_GOOGLE_API_KEY') {
        resolve({ error: 'Google API key not set.' });
        return;
      }
      headers = { 'Content-Type': 'application/json' };
      url = `${API_URLS.GOOGLE}${model}:generateContent?key=${API_KEYS.GOOGLE}`;
      data = { contents: [{ parts: [{ text: chatPrompt }] }] };
    }

    else {
      resolve({ error: 'Unsupported API provider.' });
      return;
    }

    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
      })
      .then(result => {
        let score, fullResponse;

        if (apiProvider === 'huggingface-zero-shot') {
          score = result[0].scores[result[0].labels.indexOf('true')];
          fullResponse = JSON.stringify(result);
        } else if (apiProvider === 'huggingface-language') {
          score = parseFloat(result[0].generated_text.trim());
          fullResponse = result[0].generated_text.trim();
        } else if (apiProvider === 'google') {
          score = parseFloat(result.candidates[0].content.parts[0].text.trim());
          fullResponse = result.candidates[0].content.parts[0].text.trim();
        } else {
          // Groq, OpenRouter, Together AI, Cohere, xAI, OpenAI
          score = parseFloat(result.choices[0].message.content.trim());
          fullResponse = result.choices[0].message.content.trim();
        }

        if (isNaN(score) || score < 0 || score > 1) throw new Error('Invalid score format');
        resolve({ score, fullResponse });
      })
      .catch(error => {
        console.error('API Error:', error);
        resolve({ error: `API request failed: ${error.message}` });
      });
  });
}

// Toggle console when icon clicked
chrome.action.onClicked.addListener((tab) => {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('file://')) {
    console.log('Cannot toggle console on this page:', tab.url || 'No URL');
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'toggleConsole' }, (response) => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => {
        chrome.tabs.sendMessage(tab.id, { type: 'toggleConsole' });
      });
    }
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'assessTruthfulness') {
    assessTruthfulness(request.text, request.apiProvider, request.model).then((result) => {
      sendResponse(result);
    });
    return true; // Async response
  }
});
