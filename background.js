console.log('Background script loaded');

// API keys (replace placeholders with actual keys)
const API_KEYS = {
  HUGGINGFACE: 'YOUR_HUGGINGFACE_API_KEY',
  GROQ: 'YOUR_GROQ_API_KEY',
  OPENROUTER: 'YOUR_OPENROUTER_API_KEY',
  TOGETHERAI: 'YOUR_TOGETHERAI_API_KEY',
  COHERE: 'YOUR_COHERE_API_KEY',
  XAI: 'YOUR_XAI_API_KEY',
  OPENAI: 'YOUR_OPENAI_API_KEY',
  GOOGLE: 'YOUR_GOOGLE_GEMINI_API_KEY',
  HF_SPACES: 'YOUR_HF_SPACES_API_KEY' // for Web Search
};

// API URLs
const API_URLS = {
  HUGGINGFACE: 'https://api-inference.huggingface.co/models/',
  GROQ: 'https://api.groq.com/openai/v1/chat/completions',
  OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
  TOGETHERAI: 'https://api.together.ai/v1/chat/completions',
  COHERE: 'https://api.cohere.ai/v2/chat',
  XAI: 'https://api.x.ai/v1/chat/completions',
  OPENAI: 'https://api.openai.com/v1/chat/completions',
  GOOGLE: 'https://generativelanguage.googleapis.com/v1beta/models/',
  HF_SPACES: 'https://broadfield-dev-search-tool.hf.space/scrape' // for Web Search
};

// Generic API call function for AI models
async function callAIModel(apiProvider, model, prompt, maxTokens = 200) {
  const keyName = apiProvider.toUpperCase();
  if (!API_KEYS[keyName] || API_KEYS[keyName] === `YOUR_${keyName}_API_KEY`) {
    throw new Error(`${apiProvider} API key not set.`);
  }

  let headers = { 'Content-Type': 'application/json' };
  let url, data;

  if (apiProvider.startsWith('huggingface')) {
    headers['Authorization'] = `Bearer ${API_KEYS.HUGGINGFACE}`;
    url = `${API_URLS.HUGGINGFACE}${model}`;
    data = { inputs: prompt, parameters: { max_new_tokens: maxTokens, return_full_text: false } };
  } else if (['groq', 'openrouter', 'togetherai', 'xai', 'openai'].includes(apiProvider)) {
    headers['Authorization'] = `Bearer ${API_KEYS[keyName]}`;
    url = API_URLS[keyName];
    data = { model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens };
  } else if (apiProvider === 'cohere') {
    headers['Authorization'] = `Bearer ${API_KEYS.COHERE}`;
    url = API_URLS.COHERE;
    data = { message: prompt, model, max_tokens: maxTokens };
  } else if (apiProvider === 'google') {
    url = `${API_URLS.GOOGLE}${model}:generateContent?key=${API_KEYS.GOOGLE}`;
    data = { contents: [{ parts: [{ text: prompt }] }] };
  } else {
    throw new Error('Unsupported API provider.');
  }

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

// Assess truthfulness (unchanged)
async function assessTruthfulness(text, apiProvider, model, promptType, userPrompt = '') {
  let prompt = userPrompt ? `${userPrompt}\n\nText to analyze: "${text}"` : '';
  switch (promptType) {
    case 'truthscore':
      prompt += `\nSystem Prompt: Evaluate the truthfulness of the statement and return only a score (0-1, two decimal places).\nStatement: "${text}"`;
      break;
    case 'fullreport':
      prompt += `\nSystem Prompt: Provide a detailed analysis of the statement's truthfulness as plain text.\nStatement: "${text}"`;
      break;
    case 'sentiment':
      prompt += `\nAnalyze the sentiment of this statement and return JSON: {"sentiment": "positive/negative/neutral", "confidence": float}.\nStatement: "${text}"`;
      break;
    case 'summary':
      prompt += `\nSummarize this statement concisely as plain text.\nStatement: "${text}"`;
      break;
    case 'contradictions':
      prompt += `\nIdentify contradictions in this statement as plain text, or "No contradictions found".\nStatement: "${text}"`;
      break;
    case 'logicalargument':
      prompt += `\nAnalyze this statement for logical fallacies as plain text.\nStatement: "${text}"`;
      break;
    default:
      return { error: 'Invalid prompt type' };
  }

  try {
    let result;
    if (apiProvider === 'huggingface-zero-shot' && promptType === 'truthscore') {
      result = await callAIModel(apiProvider, model, text, 10);
      return { score: result[0].scores[result[0].labels.indexOf('true')] };
    } else {
      result = await callAIModel(apiProvider, model, prompt, promptType === 'truthscore' ? 10 : 200);
      const textResult = apiProvider === 'google' ? result.candidates[0].content.parts[0].text.trim() :
                       apiProvider === 'cohere' ? result.message.content.trim() :
                       result.choices ? result.choices[0].message.content.trim() : result[0].generated_text.trim();
      if (promptType === 'truthscore') {
        const score = parseFloat(textResult);
        if (isNaN(score) || score < 0 || score > 1) throw new Error('Invalid score format');
        return { score };
      } else if (promptType === 'sentiment') {
        return { result: JSON.parse(textResult) };
      } else {
        return { result: textResult };
      }
    }
  } catch (error) {
    console.error('API Error:', error);
    return { error: `API request failed: ${error.message}` };
  }
}

// Perform research with Hugging Face Spaces scraping API, searching 5 sources
async function performResearch(text, apiProvider, model) {
  try {
    // Step 1: Generate search query
    const queryPrompt = `Generate a concise search query (max 10 words) based on this input for factual research:\n"${text}"`;
    const queryResult = await callAIModel(apiProvider, model, queryPrompt, 20);
    const searchQuery = apiProvider === 'google' ? queryResult.candidates[0].content.parts[0].text.trim() :
                        apiProvider === 'cohere' ? queryResult.message.content.trim() :
                        queryResult.choices ? queryResult.choices[0].message.content.trim() : queryResult[0].generated_text.trim();

    let resultText = `**Search Query:** ${searchQuery}\n\n`;

    // Step 2: Use LLM to suggest 5 unique URLs to scrape
    const urlPrompt = `Given the question: "${text}", suggest exactly 5 unique URLs from different domains that would likely contain relevant information to answer it. Return only the URLs, one per line.`;
    const urlResult = await callAIModel(apiProvider, model, urlPrompt, 100);
    const urlText = apiProvider === 'google' ? urlResult.candidates[0].content.parts[0].text.trim() :
                    apiProvider === 'cohere' ? urlResult.message.content.trim() :
                    urlResult.choices ? urlResult.choices[0].message.content.trim() : urlResult[0].generated_text.trim();
    const targetUrls = urlText.split('\n').slice(0, 5).filter(url => url.trim()); // Ensure we get up to 5 valid URLs

    if (targetUrls.length < 1) {
      throw new Error('No valid URLs provided by LLM');
    }

    resultText += `**Selected URLs:**\n${targetUrls.join('\n')}\n\n`;

    // Step 3: Scrape each URL using Hugging Face Spaces API and collate results
    let allScrapedContent = '';
    let headers = { 'Content-Type': 'application/json' };
    if (API_KEYS.HF_SPACES && API_KEYS.HF_SPACES !== 'YOUR_HF_SPACES_API_KEY') {
      headers['Authorization'] = `Bearer ${API_KEYS.HF_SPACES}`;
    }

    for (const [index, url] of targetUrls.entries()) {
      const scrapePayload = {
        url: url,
        query: searchQuery,
        element: 'p',
        max_length: 1000
      };

      try {
        const scrapeResponse = await fetch(API_URLS.HF_SPACES, {
          method: 'POST',
          headers,
          body: JSON.stringify(scrapePayload)
        });

        if (!scrapeResponse.ok) {
          throw new Error(`HF Spaces API error for ${url}! Status: ${scrapeResponse.status}`);
        }

        const scrapeData = await scrapeResponse.json();
        if (scrapeData.error) {
          throw new Error(scrapeData.error);
        }

        const scrapedContent = scrapeData.results.map(r => r.text).join('\n');
        allScrapedContent += `**Source ${index + 1} (${url}):**\n${scrapedContent}\n\n`;
        resultText += `**Scraped Content Preview from ${url}:** ${scrapedContent.slice(0, 200)}...\n`;
      } catch (error) {
        resultText += `**Error scraping ${url}:** ${error.message}\n`;
        console.error(`Scraping error for ${url}:`, error);
      }
    }

    resultText += `\n**Collated Scraped Content:**\n${allScrapedContent.slice(0, 4000)}...\n\n`; // Limit to avoid overflow

    // Step 4: Process collated scraped content with LLM
    const processPrompt = `Given the question: "${text}", and the following scraped content from multiple sources, provide a concise answer:\n${allScrapedContent.slice(0, 2000)}`; // Limit to avoid token overflow
    const finalResult = await callAIModel(apiProvider, model, processPrompt, 200);
    const finalAnswer = apiProvider === 'google' ? finalResult.candidates[0].content.parts[0].text.trim() :
                        apiProvider === 'cohere' ? finalResult.message.content.trim() :
                        finalResult.choices ? finalResult.choices[0].message.content.trim() : finalResult[0].generated_text.trim();

    resultText += `**Final Answer from LLM:** ${finalAnswer}`;
    return { result: resultText };

  } catch (error) {
    console.error('Research Error:', error);
    return { error: `Research failed: ${error.message}` };
  }
}

// Toggle console (unchanged)
chrome.action.onClicked.addListener((tab) => {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('file://')) return;
  chrome.tabs.sendMessage(tab.id, { type: 'toggleConsole' }, (response) => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => chrome.tabs.sendMessage(tab.id, { type: 'toggleConsole' }));
    }
  });
});

// Handle messages (unchanged)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'assessTruthfulness') {
    assessTruthfulness(request.text, request.apiProvider, request.model, request.promptType, request.userPrompt)
      .then(sendResponse);
    return true;
  } else if (request.action === 'performResearch') {
    performResearch(request.text, request.apiProvider, request.model)
      .then(sendResponse);
    return true;
  }
});
