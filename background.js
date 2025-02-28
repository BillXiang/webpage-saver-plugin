// 从本地存储中获取之前保存的 GitHub 配置信息
async function getGithubConfig() {
    const { githubConfig } = await browser.storage.local.get('githubConfig');
    return githubConfig;
}

// 生成文件名，修改时间戳格式
function generateFilename(title, isPdf = false) {
    const currentDate = new Date();
    const timestamp = `(${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')} ${String(currentDate.getHours()).padStart(2, '0')}：${String(currentDate.getMinutes()).padStart(2, '0')}：${String(currentDate.getSeconds()).padStart(2, '0')})`;
    const fileExtension = isPdf ? '.pdf' : '.html';
    return `${ title.replace(/[\/:*?"<>|]()/g, '_').substring(0, 126)} ${timestamp}${fileExtension}`;
}

// 保存网页到 GitHub 或本地
async function saveWebpage(tab, filename, githubConfig, saveTo) {
    try {
        const isPdf = tab.url.endsWith('.pdf');
        const tabId = tab.id;
        let content;
        if (!isPdf) {
            // 获取网页内容
           const result = await browser.tabs.executeScript(tabId, { code: 'document.documentElement.outerHTML' });
           const shadowContent = await browser.tabs.executeScript(tabId, { code: `
                // 获取Shadow宿主元素
                const orbitElement = document.querySelector('orbit-wrapper');
                
                if (orbitElement && orbitElement.shadowRoot) {
                    const shadowRoot = orbitElement.shadowRoot;
                    const shadowContent = shadowRoot.innerHTML; // 获取Shadow DOM内容
                    // 创建一个临时的 div 元素
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = shadowContent;

                    // 在临时 div 中查找特定元素
                    const targetParagraph = tempDiv.getElementsByClassName('orbit-chat-answer');
                    if (targetParagraph[0]) {
                        //console.log('Found target paragraph:', targetParagraph[0].textContent);
                        targetParagraph[0].textContent;
                    } else {
                        console.log('Target paragraph not found.');
                    }
                }
            `});
            console.log(shadowContent);
            let headInfo = `<!-- Filename: ${filename}\n Page saved with X-Webpage-Conserve \n url: ${tab.url}\n`;
            if (shadowContent) {
                headInfo += ` Summary: ${shadowContent}\n-->\n`
            } else {
                headInfo += ' Summary: \n-->\n'
            }
            if (result && result.length > 0) {
                content = headInfo + result[0];
            }
        }

        if (saveTo === 'github' && githubConfig && githubConfig.token && githubConfig.username && githubConfig.repo && githubConfig.branch) {
            console.log("progressDiv 开始上传到 GitHub...")
            if (isPdf) {
                browser.notifications.create({
                    type: 'basic',
                    title: 'PDF save progress',
                    message: 'Start'
                });
                // 获取 PDF 文件的二进制数据
                const response = await fetch(tab.url);
                const blob = await response.blob();
                const reader = new FileReader();
                await new Promise((resolve, reject) => {
                    reader.onloadend = () => {
                        const arrayBuffer = reader.result;
                        const uint8Array = new Uint8Array(arrayBuffer);
                        let binary = '';
                        for (let i = 0; i < uint8Array.length; i++) {
                            binary += String.fromCharCode(uint8Array[i]);
                        }
                        content = btoa(binary);
                        resolve();
                    };
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(blob);
                });
            } else {
                content = btoa(unescape(encodeURIComponent(content)));
                //show upload progress
                browser.tabs.executeScript(tabId, {
                    code: `
                        let progressDiv = document.getElementById('github-upload-progress');
                        console.log('github-upload-progress:', progressDiv);
                        if (!progressDiv) {
                            progressDiv = document.createElement('div');
                            progressDiv.id = 'github-upload-progress';
                            progressDiv.style.position = 'fixed';
                            progressDiv.style.top = '10px';
                            progressDiv.style.left = '10px';
                            progressDiv.style.backgroundColor = '#ffc107';
                            progressDiv.style.padding = '10px';
                            progressDiv.style.border = '1px solid #ccc';
                            progressDiv.style.zIndex = '9999';
                            progressDiv.textContent = '开始上传到 GitHub...';
                        } else {
                            progressDiv.textContent = '开始上传到 GitHub...';
                        }
                        document.body.appendChild(progressDiv);
                        progressDiv.id;
                    `
                }).then(result => {
                    console.log("executeScript success");
                }).catch(error => {
                    console.log("executeScript error:", error)
                });
            }

            const apiUrl = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${filename}`;
            const headers = {
                'Authorization': `token ${githubConfig.token}`,
                'Content-Type': 'application/json'
            };
            const body = {
                message: `Save ${filename}`,
                content: content,
                branch: githubConfig.branch
            };
            const apiResponse = await fetch(apiUrl, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(body)
            });
            const data = await apiResponse.json();
            console.log('GitHub response:', data);
            if (isPdf) {
                browser.notifications.create({
                    type: 'basic',
                    title: 'PDF save progress',
                    message: 'Success'
                });
            } else {
                browser.tabs.executeScript(tabId, {
                    code: `
                        console.log('github-upload-progress2');
                        progressDiv = document.getElementById('github-upload-progress');
                        console.log('github-upload-progress2:', progressDiv);
                        if (progressDiv) {
                            progressDiv.textContent = '${apiResponse && apiResponse.ok ? '上传到 GitHub 成功！' : '上传到 GitHub 失败，请检查配置和网络。'}';
                        }
                    `
                }).then(result => {
                    console.log("executeScript success");
                }).catch(error => {
                    console.log("executeScript error:", error)
                });
            }
            return { success: apiResponse.ok };
        } else {//saveTo === 'local'
            if (isPdf) {
                const url = tab.url;
                const options = {
                    url: url,
                    saveAs: false,
                    filename: filename
                };
                const downloadId = await browser.downloads.download(options);
                console.log('Download started with ID:', downloadId);
                return { success: true };
            } else {// download content with head info
                // 将数据转换为Blob对象
                var blob = new Blob([content], { type: 'text/html' });
                // 创建一个指向该Blob的URL
                var url = window.URL.createObjectURL(blob);
                // 创建一个a元素用于下载
                var downloadLink = document.createElement('a');
                // 设置下载属性和文件名
                downloadLink.href = url;
                downloadLink.download = filename;
                // 触发下载
                downloadLink.click();
                // 释放创建的URL
                window.URL.revokeObjectURL(url);
            }
        }
    } catch (error) {
        console.error('Error saving webpage:', error);
        return { success: false };
    }
}

// 监听收藏夹创建事件
browser.bookmarks.onCreated.addListener(async (id, bookmark) => {
    try {
        console.log('Bookmark created:', bookmark);
        if (bookmark.url) {
            const githubConfig = await getGithubConfig();
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                const tab = tabs[0];
                const isPdf = bookmark.url.endsWith('.pdf');
                const defaultFilename = generateFilename(bookmark.title, isPdf);
                let fullPath = '';
                let parentId = bookmark.parentId;
                const pathSegments = [];
                while (parentId) {
                    const parentBookmark = await browser.bookmarks.get(parentId);
                    if (parentBookmark.length > 0 && parentBookmark[0].title) {
                        pathSegments.unshift(parentBookmark[0].title.replace(/[\/:*?"<>|]/g, '_'));
                    }
                    parentId = parentBookmark[0].parentId;
                }
                fullPath = pathSegments.join('/');
                const finalFilename = fullPath ? `${fullPath}/${defaultFilename}` : defaultFilename;

                // 从本地存储中获取上次选择的保存位置
                const { lastSaveLocation } = await browser.storage.local.get('lastSaveLocation');
                const saveTo = lastSaveLocation || 'local';

                await saveWebpage(tab, finalFilename, githubConfig, saveTo);
            }
        }
    } catch (error) {
        console.error('Error handling bookmark creation:', error);
    }
});

browser.runtime.onMessage.addListener(async function (message, sender, sendResponse) {
    if (message.action === 'savePage') {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
            const activeTab = tabs[0];
            const result = await saveWebpage(activeTab, message.filename, message.githubConfig, message.saveTo);
            sendResponse(result);
            return true;
        }
    }
});
