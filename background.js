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

// Assess truthfulness based on selected API, model, and prompt type
function assessTruthfulness(text, apiProvider, model, promptType) {
  return new Promise((resolve) => {
    let headers, data, url;

    // Define prompts based on promptType
    let prompt;
    switch (promptType) {
      case 'truthscore':
        prompt = `System Prompt: You are an assistant tasked with evaluating the truthfulness of statements and providing an 'Objective Truth Probability Score' between 0 and 1, where 1 indicates the statement is definitely true, and 0 indicates it is definitely false. Keep in mind that it is almost impossible to assess 0 or 1 probability without directly witnessing or conducting the experiment yourself, and history is difficult to verify. Assume that the statement is intended to be a statement of fact, not an opinion or subjective judgment. To accomplish this, follow these steps: 1. Understand the statement clearly, interpreting it in its most straightforward and common sense meaning. Look at each word in the statement like a function call and consider its meaning in the statement. 2. Search and Think about any relevant facts, data, or knowledge that supports the statement. 3. Search and Think about any relevant facts, data, or knowledge that contradicts or casts doubt on the statement. 4. Evaluate the credibility and reliability of the sources or the basis of your knowledge. 5. Consider if there are any exceptions, nuances, or contexts that might affect the truthfulness of the statement. 6. Ensure that your assessment is unbiased and does not rely on stereotypes. 7. Based on the above, assign a probability score that reflects your confidence in the statement's truthfulness. Finally, output only the score as a floating-point number between 0.01 and 1, rounded to two decimal places. Examples: - Statement: "The capital of France is Paris." 1.00 - Statement: "The moon is made of cheese." 0.01 - Statement: "Albert Einstein was born in 1879." 0.98 - Statement: "Barack Obama was the 44th President of the United States." 1.00 - Statement: "The Great Wall of China is visible from space." 0.62 Note: The score for the last statement is 0.62 because while the Great Wall can be seen from low Earth orbit under certain conditions, it's not visible from farther distances in space, leading to some ambiguity in its truthfulness.\nReturn only the score.\nStatement: "${text}"\nAssistant:`;
        break;
      case 'fullreport':
        prompt = `System Prompt: You are an assistant tasked with providing a detailed analysis of the truthfulness of a statement. Analyze the statement and return a plain text report covering: 1. The interpreted meaning of the statement. 2. Supporting facts or evidence. 3. Contradictory facts or doubts. 4. Source credibility assessment. 5. Contextual nuances. 6. Final Objective Truth Probability Score (0-1) and confidence level (0-1). Output only the report as plain text, with no markdown or JSON formatting. Example: "The statement 'Albert Einstein was born in 1879' means Einstein's birth year is 1879. Historical records confirm he was born on March 14, 1879, in Ulm, Germany. No credible contradictory evidence exists. Sources like biographies and official records are highly reliable. No significant contextual nuances affect this. Final score: 0.98, confidence: 0.99."\nStatement: "${text}"`;
        break;
      case 'sentiment':
        prompt = `Analyze the sentiment of this statement and provide a sentiment label (positive, negative, neutral) with a confidence score between 0 and 1. Format the output as JSON:\n{\n  "sentiment": string,\n  "confidence": float\n}\nStatement: "${text}"`;
        break;
      case 'summary':
        prompt = `Summarize this statement in a concise manner. Output only the summary as plain text.\nStatement: "${text}"`;
        break;
      case 'contradictions':
        prompt = `Identify any potential contradictions or inconsistencies in this statement. Output a brief explanation as plain text, or "No contradictions found" if none are detected.\nStatement: "${text}"`;
        break;
      default:
        resolve({ error: 'Invalid prompt type' });
        return;
    }

    // Hugging Face (Zero-shot or Language)
    if (apiProvider.startsWith('huggingface')) {
      if (!API_KEYS.HUGGINGFACE || API_KEYS.HUGGINGFACE === 'YOUR_HUGGINGFACE_API_KEY') {
        resolve({ error: 'Hugging Face API key not set.' });
        return;
      }
      headers = { 'Authorization': `Bearer ${API_KEYS.HUGGINGFACE}`, 'Content-Type': 'application/json' };
      url = `${API_URLS.HUGGINGFACE}${model}`;

      if (apiProvider === 'huggingface-zero-shot' && promptType === 'truthscore') {
        data = { inputs: text, parameters: { candidate_labels: ['true', 'false'] } };
      } else {
        data = { inputs: prompt, parameters: { max_new_tokens: promptType === 'truthscore' ? 10 : 200, return_full_text: false } };
      }
    }

    // Groq, OpenRouter, Together AI, Cohere, xAI, OpenAI
    else if (['groq', 'openrouter', 'togetherai', 'cohere', 'xai', 'openai'].includes(apiProvider)) {
      const key = apiProvider.toUpperCase();
      if (!API_KEYS[key] || API_KEYS[key] === `YOUR_${key}_API_KEY`) {
        resolve({ error: `${apiProvider} API key not set.` });
        return;
      }
      headers = { 'Authorization': `Bearer ${API_KEYS[key]}`, 'Content-Type': 'application/json' };
      url = API_URLS[key];
      data = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: promptType === 'truthscore' ? 10 : 200
      };
      if (apiProvider === 'cohere') {
        data = { message: prompt, model: model, max_tokens: promptType === 'truthscore' ? 10 : 200 };
      }
    }

    // Google Gemini API
    else if (apiProvider === 'google') {
      if (!API_KEYS.GOOGLE || API_KEYS.GOOGLE === 'YOUR_GOOGLE_API_KEY') {
        resolve({ error: 'Google API key not set.' });
        return;
      }
      headers = { 'Content-Type': 'application/json' };
      url = `${API_URLS.GOOGLE}${model}:generateContent?key=${API_KEYS.GOOGLE}`;
      data = { contents: [{ parts: [{ text: prompt }] }] };
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
        let responseObj = {};

        if (apiProvider === 'huggingface-zero-shot' && promptType === 'truthscore') {
          responseObj.score = result[0].scores[result[0].labels.indexOf('true')];
          responseObj.fullResponse = JSON.stringify(result);
        } else if (apiProvider === 'huggingface-language') {
          const textResult = result[0].generated_text.trim();
          if (promptType === 'truthscore') {
            responseObj.score = parseFloat(textResult);
            if (isNaN(responseObj.score) || responseObj.score < 0 || responseObj.score > 1) throw new Error('Invalid score format');
          } else {
            responseObj.result = textResult;
          }
          responseObj.fullResponse = textResult;
        } else if (apiProvider === 'google') {
          const textResult = result.candidates[0].content.parts[0].text.trim();
          if (promptType === 'truthscore') {
            responseObj.score = parseFloat(textResult);
            if (isNaN(responseObj.score) || responseObj.score < 0 || responseObj.score > 1) throw new Error('Invalid score format');
          } else {
            responseObj.result = textResult;
          }
          responseObj.fullResponse = textResult;
        } else {
          const textResult = apiProvider === 'cohere' ? result.message.content.trim() : result.choices[0].message.content.trim();
          console.log(`Raw API response for ${promptType}:`, textResult); // Debug log
          if (promptType === 'truthscore') {
            responseObj.score = parseFloat(textResult);
            if (isNaN(responseObj.score) || responseObj.score < 0 || responseObj.score > 1) throw new Error('Invalid score format');
          } else if (['sentiment'].includes(promptType)) {
            responseObj.result = JSON.parse(textResult); // Only sentiment expects JSON
          } else {
            responseObj.result = textResult; // Fullreport, summary, contradictions as plain text
          }
          responseObj.fullResponse = textResult;
        }

        resolve(responseObj);
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
    assessTruthfulness(request.text, request.apiProvider, request.model, request.promptType).then((result) => {
      sendResponse(result);
    });
    return true; // Async response
  }
});
