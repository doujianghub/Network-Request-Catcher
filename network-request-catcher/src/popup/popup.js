console.log('Popup script is running');

let isRecording = false;
let currentTabId;
const toggleButton = document.getElementById('toggleRecording');
const clearButton = document.getElementById('clearRequests');
const requestList = document.getElementById('requestList');
const filters = {
  get: document.getElementById('filterGET'),
  post: document.getElementById('filterPOST'),
  other: document.getElementById('filterOTHER'),
  xhr: document.getElementById('filterXHR'),
  document: document.getElementById('filterDOCUMENT'), // 添加 document 过滤器
  media: document.getElementById('filterMEDIA'),
  other_type: document.getElementById('filterOTHER_TYPE')
};

function loadState() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    currentTabId = tabs[0].id;
    chrome.runtime.sendMessage({action: "getRecordingStatus", tabId: currentTabId}, function(response) {
      isRecording = response.isRecording;
      updateToggleButton();
      
      chrome.storage.local.get(['filters_' + currentTabId, 'hasSeenTip'], function(result) {
        const savedFilters = result['filters_' + currentTabId];
        if (savedFilters) {
          Object.keys(savedFilters).forEach(key => {
            if (filters[key]) {
              filters[key].checked = savedFilters[key];
            }
          });
        }
        
        // 检查用户是否已经看过提示
        if (result.hasSeenTip === undefined) {
          showTip();
          chrome.storage.local.set({hasSeenTip: true});
        }
        
        updateRequestList();
      });
    });
  });
}

function saveState() {
  const filterState = {};
  Object.keys(filters).forEach(key => {
    filterState[key] = filters[key].checked;
  });
  chrome.storage.local.set({['filters_' + currentTabId]: filterState});
  chrome.runtime.sendMessage({action: "updateFilters", filters: filterState, tabId: currentTabId});
}

function updateToggleButton() {
  if (isRecording) {
    toggleButton.textContent = chrome.i18n.getMessage("stopButton");
    toggleButton.classList.remove('primary-button');
    toggleButton.classList.add('secondary-button');
  } else {
    toggleButton.textContent = chrome.i18n.getMessage("startButton");
    toggleButton.classList.remove('secondary-button');
    toggleButton.classList.add('primary-button');
  }
}

function updateRequestList() {
  chrome.runtime.sendMessage({action: "getRequests", tabId: currentTabId}, function(response) {
    console.log("Received requests:", response.requests);
    requestList.innerHTML = '';
    if (response.requests && response.requests.length > 0) {
      const filteredRequests = response.requests.filter(request => {
        const methodFilter = (
          (request.method === 'GET' && filters.get.checked) ||
          (request.method === 'POST' && filters.post.checked) ||
          (request.method !== 'GET' && request.method !== 'POST' && filters.other.checked)
        );
        const typeFilter = (
          (request.type === 'xhr' && filters.xhr.checked) ||
          (request.type === 'document' && filters.document.checked) || // 添加 document 过滤
          ((request.type === 'media' || request.url.includes('.m3u8')) && filters.media.checked) ||
          (request.type !== 'xhr' && request.type !== 'document' && request.type !== 'media' && !request.url.includes('.m3u8') && filters.other_type.checked)
        );
        return methodFilter && typeFilter;
      });

      console.log("Filtered requests:", filteredRequests);

      filteredRequests.forEach(function(request) {
        const requestItem = document.createElement('div');
        requestItem.className = 'request-item';
        requestItem.innerHTML = `
          <span class="request-method ${getMethodClass(request.method)}">${request.method}</span>
          <span class="request-url">${request.url}</span>
        `;
        requestItem.addEventListener('click', () => showRequestDetails(request));
        requestList.appendChild(requestItem);
      });

      // 如果过滤后没有请求，显示"暂无数据"
      if (filteredRequests.length === 0) {
        requestList.innerHTML = `<div class="no-data">${chrome.i18n.getMessage("noData")}</div>`;
      }
    } else {
      console.log("No requests received or empty request list");
      requestList.innerHTML = `<div class="no-data">${chrome.i18n.getMessage("noData")}</div>`;
    }

    // 调整 requestList 的高度
    adjustRequestListHeight();
  });
}

// 添加这个新函数来调整 requestList 的高度
function adjustRequestListHeight() {
  const container = document.querySelector('.container');
  const controls = document.getElementById('controls');
  const availableHeight = container.clientHeight - controls.offsetHeight - 40; // 40px for margins
  const requestList = document.getElementById('requestList');
  const requests = requestList.querySelectorAll('.request-item');
  
  if (requests.length === 0) {
    // 如果没有请求，设置一个较小的高度
    requestList.style.height = '30px';
  } else {
    // 如果有请求，设置高度为可用空间或内容高度，取较小值
    const contentHeight = Array.from(requests).reduce((total, item) => total + item.offsetHeight, 0);
    requestList.style.height = `${Math.min(availableHeight, contentHeight)}px`;
  }
}

// 确保在更新请求列表后调用此函数
function updateRequestList() {
  chrome.runtime.sendMessage({action: "getRequests", tabId: currentTabId}, function(response) {
    console.log("Received requests:", response.requests);
    requestList.innerHTML = '';
    if (response.requests && response.requests.length > 0) {
      const filteredRequests = response.requests.filter(request => {
        const methodFilter = (
          (request.method === 'GET' && filters.get.checked) ||
          (request.method === 'POST' && filters.post.checked) ||
          (request.method !== 'GET' && request.method !== 'POST' && filters.other.checked)
        );
        const typeFilter = (
          (request.type === 'xhr' && filters.xhr.checked) ||
          (request.type === 'document' && filters.document.checked) || // 添加 document 过滤
          ((request.type === 'media' || request.url.includes('.m3u8')) && filters.media.checked) ||
          (request.type !== 'xhr' && request.type !== 'document' && request.type !== 'media' && !request.url.includes('.m3u8') && filters.other_type.checked)
        );
        return methodFilter && typeFilter;
      });

      console.log("Filtered requests:", filteredRequests);

      filteredRequests.forEach(function(request) {
        const requestItem = document.createElement('div');
        requestItem.className = 'request-item';
        requestItem.innerHTML = `
          <span class="request-method ${getMethodClass(request.method)}">${request.method}</span>
          <span class="request-url">${request.url}</span>
        `;
        requestItem.addEventListener('click', () => showRequestDetails(request));
        requestList.appendChild(requestItem);
      });

      // 如果过滤后没有请求，显示"暂无数据"
      if (filteredRequests.length === 0) {
        requestList.innerHTML = `<div class="no-data">${chrome.i18n.getMessage("noData")}</div>`;
      }
    } else {
      console.log("No requests received or empty request list");
      requestList.innerHTML = `<div class="no-data">${chrome.i18n.getMessage("noData")}</div>`;
    }

    // 调整 requestList 的高度
    adjustRequestListHeight();
  });
}

// 在窗口大小改变时调整高度
window.addEventListener('resize', adjustRequestListHeight);

// 在初始化时调用
loadState();
adjustRequestListHeight();

function clearRequests() {
  chrome.runtime.sendMessage({action: "clearRequests", tabId: currentTabId}, function(response) {
    console.log("Requests cleared");
    updateRequestList();
  });
}

toggleButton.addEventListener('click', function() {
  isRecording = !isRecording;
  updateToggleButton();
  chrome.runtime.sendMessage({
    action: isRecording ? "startRecording" : "stopRecording", 
    tabId: currentTabId
  }, function(response) {
    console.log("Recording " + (isRecording ? "started" : "stopped"));
    if (!isRecording) {
      updateRequestList();
    } else {
      // 直接关闭弹出窗口，不显示通知
      window.close();
    }
  });
});

clearButton.addEventListener('click', clearRequests);

Object.values(filters).forEach(filter => {
  filter.addEventListener('change', () => {
    saveState();
    updateRequestList();
  });
});

function showRequestDetails(request) {
  const modal = document.getElementById('requestDetailsModal');
  const detailsContent = document.getElementById('requestDetailsContent');
  
  // 处理请求头
  const headersObj = {};
  request.requestHeaders.forEach(header => {
    headersObj[header.name] = header.value;
  });
  const headersStr = JSON.stringify(headersObj, null, 2);

  let paramsContent = '';
  if (request.method === 'GET') {
    const urlParams = new URLSearchParams(new URL(request.url).search);
    const paramsObj = {};
    for (const [key, value] of urlParams) {
      paramsObj[key] = decodeURIComponent(value);
    }
    if (Object.keys(paramsObj).length > 0) {
      paramsContent = JSON.stringify(paramsObj, null, 2);
    }
  } else if (request.requestBody && Object.keys(request.requestBody).length > 0) {
    paramsContent = JSON.stringify(request.requestBody, null, 2);
  }

  const methodClass = getMethodClass(request.method);

  detailsContent.innerHTML = `
    <div class="detail-row">
      <h3>URL</h3>
      <div class="detail-value">
        <pre class="copyable" data-copy="${escapeHtml(request.url)}"><code><span class="request-method ${methodClass} small-method">${request.method}</span><span class="url-content">${escapeHtml(request.url)}</span></code></pre>
      </div>
    </div>
    <div class="detail-row">
      <h3>Head</h3>
      <div class="detail-value">
        <pre class="copyable" data-copy="${escapeHtml(headersStr)}"><code>${syntaxHighlight(headersStr)}</code></pre>
      </div>
    </div>
    ${paramsContent ? `
    <div class="detail-row">
      <h3>Params</h3>
      <div class="detail-value">
        <pre class="copyable" data-copy="${escapeHtml(paramsContent)}"><code>${syntaxHighlight(paramsContent)}</code></pre>
      </div>
    </div>
    ` : ''}
  `;

  modal.style.display = "block";

  // 获取模态框中的关闭按钮
  const closeButton = modal.querySelector('.close');
  closeButton.onclick = function() {
    modal.style.display = "none";
  }

  // 点击模态框外部时关闭
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  }

  // 为所有可复制元素添加点击事件
  document.querySelectorAll('.copyable').forEach(element => {
    element.addEventListener('click', function() {
      let textToCopy = this.dataset.copy;
      copyWithVisualFeedback(this, textToCopy);
    });
  });

  // 添加复制提示
  const copyHint = document.createElement('div');
  copyHint.className = 'copy-hint';
  copyHint.textContent = chrome.i18n.getMessage("clickToCopy");
  modal.querySelector('.modal-content').insertBefore(copyHint, modal.querySelector('.close'));
}

function syntaxHighlight(str) {
  if (typeof str === 'object') {
    str = JSON.stringify(str, null, 2);
  }
  // 将 JSON 格式转换为 Python 字典格式
  str = str.replace(/"([^"]+)":/g, "'$1':")  // 所有键都用单引号
           .replace(/: "([^"]+)"/g, ": '$1'")  // 将值的双引号改为单引号
           .replace(/null/g, "None")  // null 转换为 None
           .replace(/true/g, "True")  // true 转换为 True
           .replace(/false/g, "False");  // false 转换为 False

  return str.replace(/('.*?'|[{}\[\]]|\b(?:None|True|False)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    var cls = 'number';
    if (/^'/.test(match)) {
      cls = 'string';
    } else if (/[{}[\]]/.test(match)) {
      cls = 'bracket';
    } else if (/None|True|False/.test(match)) {
      cls = 'boolean';
    } else if (/:$/.test(match)) {
      cls = 'key';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

function toPythonDict(obj) {
  let result = '{\n';
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      result += `    ${JSON.stringify(key)}: ${toPythonDict(value)},\n`;
    } else {
      result += `    ${JSON.stringify(key)}: ${JSON.stringify(value)},\n`;
    }
  }
  result += '}';
  return result;
}

function copyWithVisualFeedback(element, textToCopy) {
  // 创建一个临时的 textarea 元素
  const tempTextArea = document.createElement('textarea');
  tempTextArea.value = textToCopy;
  tempTextArea.style.position = 'absolute';
  tempTextArea.style.left = '-9999px';
  document.body.appendChild(tempTextArea);

  // 选择文本
  tempTextArea.select();
  tempTextArea.setSelectionRange(0, 99999); // 对于移动设备

  // 复制文本
  document.execCommand('copy');

  // 移除临时元素
  document.body.removeChild(tempTextArea);

  // 视觉反馈
  const originalColor = element.style.backgroundColor;
  element.style.backgroundColor = '#4CAF50';  // 绿色
  setTimeout(() => {
    element.style.backgroundColor = originalColor;
  }, 200);  // 200毫秒后恢复原色
}

function getMethodClass(method) {
  switch (method.toUpperCase()) {
    case 'GET': return 'method-get';
    case 'POST': return 'method-post';
    case 'PUT': return 'method-put';
    case 'DELETE': return 'method-delete';
    default: return 'method-other';
  }
}

// 初始化
loadState();

// 每秒更新请求列表
setInterval(updateRequestList, 1000);

// 添加这个辅助函数来转义 HTML 特殊字符
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 初始化按钮文本
function initializeButtonText() {
  toggleButton.textContent = chrome.i18n.getMessage("startButton");
  clearButton.textContent = chrome.i18n.getMessage("clearButton");
}

// 添加这个函数来显示提示框
function showTip() {
  const toggleButton = document.getElementById('toggleRecording');
  const tipElement = document.createElement('div');
  tipElement.className = 'tip';
  tipElement.textContent = chrome.i18n.getMessage("firstTimeTip");
  toggleButton.parentNode.appendChild(tipElement);

  // 调整提示框的位置
  const buttonRect = toggleButton.getBoundingClientRect();
  const tipRect = tipElement.getBoundingClientRect();
  tipElement.style.left = `${Math.max(0, buttonRect.left - tipRect.width + 40)}px`;
  tipElement.style.top = `${buttonRect.bottom + 10}px`;

  // 5秒后自动隐藏提示
  setTimeout(() => {
    tipElement.style.opacity = '0';
    setTimeout(() => tipElement.remove(), 300);
  }, 5000);
}

// 确保在 DOMContentLoaded 事件中调用 loadState
document.addEventListener('DOMContentLoaded', function() {
  loadState();
  adjustRequestListHeight();
  initializeButtonText();
});
