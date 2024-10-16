console.log('Background script is running');

function debugLog(...args) {
  console.log('[DEBUG]', ...args);
}

let isRecording = {};
let requests = {};
let filters = {};

function shouldRecordRequest(details, tabId) {
  const type = getRequestType(details);
  const method = details.method.toLowerCase();

  return (
    (type === 'xhr' && filters[tabId].xhr) ||
    (type === 'document' && filters[tabId].document) ||
    (type === 'media' && filters[tabId].media) ||
    (type === 'other' && filters[tabId].other_type)
  ) && (
    (method === 'get' && filters[tabId].get) ||
    (method === 'post' && filters[tabId].post) ||
    (method !== 'get' && method !== 'post' && filters[tabId].other)
  );
}

function getRequestType(details) {
  if (details.type === 'main_frame' || details.type === 'sub_frame') return 'document';
  if (details.type === 'xmlhttprequest' || details.type === 'fetch') return 'xhr';
  if (details.type === 'image' || details.type === 'media' || details.url.includes('.m3u8')) return 'media';
  return 'other';
}

function setIconColor(tabId, isRecordingForTab) {
  const path = {
    16: isRecordingForTab ? '/assets/icon_active_16.png' : '/assets/icon_inactive_16.png',
    48: isRecordingForTab ? '/assets/icon_active_48.png' : '/assets/icon_inactive_48.png',
    128: isRecordingForTab ? '/assets/icon_active_128.png' : '/assets/icon_inactive_128.png'
  };
  chrome.action.setIcon({ path: path, tabId: tabId });
}

chrome.tabs.onCreated.addListener((tab) => {
  isRecording[tab.id] = false;
  requests[tab.id] = [];
  filters[tab.id] = {
    xhr: true,
    document: true,
    media: true,
    other_type: true,
    get: true,
    post: true,
    other: true
  };
  setIconColor(tab.id, false);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete isRecording[tabId];
  delete requests[tabId];
  delete filters[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    setIconColor(tabId, isRecording[tabId] || false);
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const tabId = details.tabId;
    debugLog("Captured request:", details.url, "Method:", details.method, "Type:", details.type, "TabId:", tabId);
    if (isRecording[tabId] && (details.url.startsWith('http://') || details.url.startsWith('https://'))) {
      debugLog("Recording request:", details.url);
      let requestBody = details.requestBody;
      if (details.method === 'POST' && details.requestBody) {
        if (details.requestBody.formData) {
          requestBody = details.requestBody.formData;
        } else if (details.requestBody.raw) {
          try {
            const rawData = new TextDecoder("utf-8").decode(new Uint8Array(details.requestBody.raw[0].bytes));
            requestBody = JSON.parse(rawData);
          } catch (e) {
            requestBody = { raw: btoa(String.fromCharCode.apply(null, new Uint8Array(details.requestBody.raw[0].bytes))) };
          }
        }
      }
      if (!requests[tabId]) {
        requests[tabId] = [];
      }
      requests[tabId].push({
        id: details.requestId,
        url: details.url,
        method: details.method,
        type: getRequestType(details),
        timestamp: new Date().toISOString(),
        requestHeaders: {},
        requestBody: requestBody
      });
      debugLog("Requests for tab", tabId, ":", requests[tabId]);
    }
  },
  {urls: ["<all_urls>"]},
  ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    const tabId = details.tabId;
    if (isRecording[tabId] && (details.url.startsWith('http://') || details.url.startsWith('https://'))) {
      const request = requests[tabId].find(r => r.id === details.requestId);
      if (request) {
        request.requestHeaders = details.requestHeaders;
        console.log("Captured headers:", request.requestHeaders);
      }
    }
  },
  {urls: ["<all_urls>"]},
  ["requestHeaders", "extraHeaders"]
);

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    const tabId = sender.tab ? sender.tab.id : request.tabId;
    debugLog("Received message:", request.action, "TabId:", tabId);
    switch(request.action) {
      case "startRecording":
        isRecording[tabId] = true;
        requests[tabId] = [];
        setIconColor(tabId, true);
        debugLog("Started recording for tab", tabId);
        sendResponse({status: "started"});
        break;
      case "stopRecording":
        isRecording[tabId] = false;
        setIconColor(tabId, false);
        debugLog("Stopped recording for tab", tabId);
        sendResponse({status: "stopped"});
        break;
      case "getRequests":
        debugLog("Sending requests for tab", tabId, "Total requests:", requests[tabId] ? requests[tabId].length : 0);
        sendResponse({requests: requests[tabId] || []});
        break;
      case "getRecordingStatus":
        sendResponse({isRecording: isRecording[tabId] || false});
        break;
      case "clearRequests":
        requests[tabId] = [];
        debugLog("Cleared requests for tab", tabId);
        sendResponse({status: "cleared"});
        break;
      case "updateFilters":
        filters[tabId] = request.filters;
        debugLog("Updated filters for tab", tabId, filters[tabId]);
        sendResponse({status: "updated"});
        break;
    }
    return true;
  }
);

function initializeAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!isRecording[tab.id]) {
        isRecording[tab.id] = false;
      }
      if (!requests[tab.id]) {
        requests[tab.id] = [];
      }
      if (!filters[tab.id]) {
        filters[tab.id] = {
          xhr: true,
          script: true,
          image: true,
          other: true,
          get: true,
          post: true
        };
      }
      setIconColor(tab.id, isRecording[tab.id]);
    });
  });
}

initializeAllTabs();

self.addEventListener('error', (event) => {
  console.error('Error in service worker:', event.message, 'at', event.filename, event.lineno, event.colno, event.error);
});
