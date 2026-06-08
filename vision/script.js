let currentBase64 = null;
let mcpPostEndpoint = null;
let messageId = 1;
const pendingRequests = new Map();

// Initialize MCP SSE Connection
function initMCP() {
    const statusText = document.getElementById('statusText');
    statusText.style.display = 'block';
    statusText.innerText = "连接到 MCP Server...";

    // Connect to our worker's MCP SSE endpoint
    const evtSource = new EventSource("/mcp/sse");

    // MCP Protocol specifies an 'endpoint' event which gives us the URL to POST messages to
    evtSource.addEventListener("endpoint", (event) => {
        // The URL might be relative or absolute, Cloudflare worker handles this
        mcpPostEndpoint = event.data;
        statusText.innerText = "MCP Server 连接成功，已准备好分析。";
        console.log("MCP Endpoint received:", mcpPostEndpoint);
    });

    // Handle incoming JSON-RPC messages from the server
    evtSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.id && pendingRequests.has(data.id)) {
                const { resolve, reject } = pendingRequests.get(data.id);
                pendingRequests.delete(data.id);
                
                if (data.error) {
                    reject(data.error);
                } else {
                    resolve(data.result);
                }
            }
        } catch (e) {
            console.error("Failed to parse MCP message", e, event.data);
        }
    };

    evtSource.onerror = (error) => {
        console.error("SSE Error:", error);
        statusText.innerText = "MCP Server 连接断开或出错，请刷新重试。";
        statusText.style.color = "#e74c3c";
    };
}

// Upload area drag-and-drop & click handling
const uploadArea = document.getElementById('uploadArea');
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "#2ecc71";
});
uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "rgba(255, 255, 255, 0.2)";
});
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "rgba(255, 255, 255, 0.2)";
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
    }
});

function handleFileSelect(event) {
    if (event.target.files && event.target.files[0]) {
        processFile(event.target.files[0]);
    }
}

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件！');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentBase64 = e.target.result;
        
        // Update UI
        document.getElementById('uploadIcon').style.display = 'none';
        document.getElementById('uploadText').style.display = 'none';
        
        const preview = document.getElementById('previewImage');
        preview.src = currentBase64;
        preview.style.display = 'block';
        
        document.getElementById('resultArea').innerText = "图片已就绪，点击开始分析。";
    };
    reader.readAsDataURL(file);
}

// Call MCP Tool
async function analyzeImage() {
    if (!currentBase64) {
        alert("请先上传一张图片！");
        return;
    }
    if (!mcpPostEndpoint) {
        alert("MCP 服务端仍在连接中，请稍后重试！");
        return;
    }

    const promptText = document.getElementById('promptInput').value || "描述这张图片";
    const btn = document.getElementById('analyzeBtn');
    const resultArea = document.getElementById('resultArea');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 分析中...';
    resultArea.innerHTML = "正在呼叫 MCP Server 执行视觉分析...";

    const id = messageId++;
    
    // JSON-RPC 2.0 Payload for calling MCP tool
    const payload = {
        jsonrpc: "2.0",
        id: id,
        method: "tools/call",
        params: {
            name: "analyze_image",
            arguments: {
                image_base64: currentBase64,
                prompt: promptText
            }
        }
    };

    // Prepare promise for the response via SSE
    const resultPromise = new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
    });

    try {
        // Send POST to the endpoint provided by the SSE 'endpoint' event
        const response = await fetch(mcpPostEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        // Wait for the JSON-RPC response via SSE
        const rpcResult = await resultPromise;
        
        if (rpcResult.isError) {
            resultArea.innerText = `分析出错：\n${rpcResult.content[0].text}`;
        } else {
            // Success! Render text
            resultArea.innerText = rpcResult.content[0].text;
        }

    } catch (e) {
        console.error(e);
        resultArea.innerText = `请求失败：${e.message}\n请检查控制台了解详情。`;
        pendingRequests.delete(id);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 开始分析';
    }
}

// Init when script loads
initMCP();
