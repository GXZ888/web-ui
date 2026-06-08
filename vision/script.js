let currentBase64 = null;

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

// Call Simple API
async function analyzeImage() {
    if (!currentBase64) {
        alert("请先上传一张图片！");
        return;
    }

    const promptText = document.getElementById('promptInput').value || "描述这张图片";
    const btn = document.getElementById('analyzeBtn');
    const resultArea = document.getElementById('resultArea');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 分析中...';
    resultArea.innerHTML = "正在呼叫云端视觉分析服务...";

    try {
        const response = await fetch("/api/analyze", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_base64: currentBase64,
                prompt: promptText
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HTTP Error: ${response.status} ${err}`);
        }

        const resultText = await response.text();
        resultArea.innerText = resultText;

    } catch (e) {
        console.error(e);
        resultArea.innerText = `请求失败：${e.message}\n请刷新页面重试。`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 开始分析';
    }
}
