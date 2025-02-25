# x-webpage-conserve

# 火狐浏览器插件开发：网页保存至本地及 GitHub 仓库

## 目录
1. [项目概述](#项目概述)
2. [项目结构](#项目结构)
3. [详细代码实现](#详细代码实现)
    1. [manifest.json](#manifestjson)
    2. [popup.html](#popuphtml)
    3. [popup.css](#popupcss)
    4. [popup.js](#popupjs)
    5. [background.js](#backgroundjs)
4. [功能实现步骤](#功能实现步骤)
    1. [保存网页到本地](#保存网页到本地)
    2. [配置 GitHub 信息并保存到本地存储](#配置-github-信息并保存到本地存储)
    3. [将网页提交到 GitHub 仓库](#将网页提交到-github-仓库)
5. [常见问题及解决办法](#常见问题及解决办法)
    1. [prompt 没有弹框](#prompt-没有弹框)
    2. [弹窗太小文件名显示不下](#弹窗太小文件名显示不下)
    3. [browser.storage is undefined](#browserstorage-is-undefined)

## 项目概述
开发一个火狐浏览器插件，实现将当前打开的网页保存成单一 HTML 文件的功能。用户可以设置保存目录，还能配置 GitHub 访问令牌、用户名、仓库名和分支名，将网页文件提交到 GitHub 仓库。配置信息会保存到本地，每次打开插件时可获取之前的配置。

## 项目结构
```
x-webpage-conserve/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background.js
```

## 详细代码实现

### manifest.json
```json
{
    "manifest_version": 2,
    "name": "Webpage Saver",
    "version": "1.0",
    "description": "Save the current web page as a single HTML file and set the save directory.",
    "browser_action": {
        "default_icon": {
            "16": "icon16.png",
            "32": "icon32.png"
        },
        "default_title": "Save Webpage",
        "default_popup": "popup/popup.html"
    },
    "permissions": [
        "activeTab",
        "downloads",
        "storage"
    ],
    "background": {
        "scripts": ["background.js"]
    }
}
```

### popup.html
```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="popup.css">
    <title>Webpage Saver</title>
    <style>
       .modal {
            display: none;
            position: fixed;
            z-index: 1;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0, 0, 0, 0.4);
        }

       .modal-content {
            background-color: #fefefe;
            margin: 15% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 80%;
            max-width: 600px;
        }

       .close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
        }

       .close:hover,
       .close:focus {
            color: black;
            text-decoration: none;
            cursor: pointer;
        }
    </style>
</head>

<body>
    <button id="saveButton">Save Current Page</button>
    <button id="setDirectoryButton">Set Save Directory</button>
    <button id="configureGithubButton">Configure GitHub</button>

    <!-- 模态框 -->
    <div id="myModal" class="modal">
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>Confirm File Name</h2>
            <input type="text" id="filenameInput" style="width: 100%;">
            <button id="confirmButton">Confirm</button>
        </div>
    </div>

    <!-- GitHub 配置模态框 -->
    <div id="githubConfigModal" class="modal">
        <div class="modal-content">
            <span class="close" id="closeGithubConfig">&times;</span>
            <h2>GitHub Configuration</h2>
            <label for="githubToken">Access Token:</label>
            <input type="text" id="githubToken" style="width: 100%;"><br>
            <label for="githubUsername">Username:</label>
            <input type="text" id="githubUsername" style="width: 100%;"><br>
            <label for="githubRepo">Repository Name:</label>
            <input type="text" id="githubRepo" style="width: 100%;"><br>
            <label for="githubBranch">Branch Name:</label>
            <input type="text" id="githubBranch" style="width: 100%;"><br>
            <button id="saveGithubConfigButton">Save Configuration</button>
        </div>
    </div>

    <script src="popup.js"></script>
</body>

</html>
```

### popup.css
```css
body {
    width: 200px;
    padding: 20px;
    font-family: Arial, sans-serif;
}

button {
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
    background-color: #007BFF;
    color: white;
    border: none;
    cursor: pointer;
}

button:hover {
    background-color: #0056b3;
}
```

### popup.js
```javascript
document.addEventListener('DOMContentLoaded', async function () {
    const saveButton = document.getElementById('saveButton');
    const setDirectoryButton = document.getElementById('setDirectoryButton');
    const configureGithubButton = document.getElementById('configureGithubButton');
    const modal = document.getElementById('myModal');
    const closeBtn = document.getElementsByClassName('close')[0];
    const confirmButton = document.getElementById('confirmButton');
    const filenameInput = document.getElementById('filenameInput');
    const githubConfigModal = document.getElementById('githubConfigModal');
    const closeGithubConfig = document.getElementById('closeGithubConfig');
    const saveGithubConfigButton = document.getElementById('saveGithubConfigButton');
    const githubTokenInput = document.getElementById('githubToken');
    const githubUsernameInput = document.getElementById('githubUsername');
    const githubRepoInput = document.getElementById('githubRepo');
    const githubBranchInput = document.getElementById('githubBranch');

    // 从本地存储中获取之前的 GitHub 配置信息
    const { githubConfig } = await browser.storage.local.get('githubConfig');
    if (githubConfig) {
        githubTokenInput.value = githubConfig.token;
        githubUsernameInput.value = githubConfig.username;
        githubRepoInput.value = githubConfig.repo;
        githubBranchInput.value = githubConfig.branch;
    }

    saveButton.addEventListener('click', function () {
        browser.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
            const activeTab = tabs[0];
            const currentDate = new Date();
            const timestamp = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}_${String(currentDate.getHours()).padStart(2, '0')}-${String(currentDate.getMinutes()).padStart(2, '0')}-${String(currentDate.getSeconds()).padStart(2, '0')}`;
            const defaultFilename = `${activeTab.title.replace(/[\/:*?"<>|]/g, '_')}_${timestamp}.html`;

            filenameInput.value = defaultFilename;
            modal.style.display = "block";
        }).catch(function (error) {
            console.error('Tab query error:', error);
        });
    });

    closeBtn.onclick = function () {
        modal.style.display = "none";
    }

    confirmButton.addEventListener('click', function () {
        const userInput = filenameInput.value;
        if (userInput) {
            const githubConfig = {
                token: githubTokenInput.value,
                username: githubUsernameInput.value,
                repo: githubRepoInput.value,
                branch: githubBranchInput.value
            };
            browser.runtime.sendMessage({ action: 'savePage', filename: userInput, githubConfig });
            modal.style.display = "none";
        }
    });

    setDirectoryButton.addEventListener('click', function () {
        browser.runtime.sendMessage({ action: 'setSaveDirectory' });
    });

    configureGithubButton.addEventListener('click', function () {
        githubConfigModal.style.display = "block";
    });

    closeGithubConfig.onclick = function () {
        githubConfigModal.style.display = "none";
    }

    saveGithubConfigButton.addEventListener('click', async function () {
        const githubConfig = {
            token: githubTokenInput.value,
            username: githubUsernameInput.value,
            repo: githubRepoInput.value,
            branch: githubBranchInput.value
        };
        // 将 GitHub 配置信息保存到本地存储
        await browser.storage.local.set({ githubConfig });
        githubConfigModal.style.display = "none";
    });
});
```

### background.js
```javascript
let saveDirectory = null;

browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === 'savePage') {
        browser.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
            const activeTab = tabs[0];
            const hasGithubConfig = message.githubConfig && message.githubConfig.token && message.githubConfig.username && message.githubConfig.repo && message.githubConfig.branch;

            if (hasGithubConfig) {
                // 获取网页内容
                browser.tabs.executeScript(activeTab.id, { code: 'document.documentElement.outerHTML' }, function (result) {
                    if (result && result.length > 0) {
                        const content = result[0];
                        const base64Content = btoa(unescape(encodeURIComponent(content)));
                        const apiUrl = `https://api.github.com/repos/${message.githubConfig.username}/${message.githubConfig.repo}/contents/${message.filename}`;
                        const headers = {
                            'Authorization': `token ${message.githubConfig.token}`,
                            'Content-Type': 'application/json'
                        };
                        const body = {
                            message: `Save ${message.filename}`,
                            content: base64Content,
                            branch: message.githubConfig.branch
                        };
                        fetch(apiUrl, {
                            method: 'PUT',
                            headers: headers,
                            body: JSON.stringify(body)
                        }).then(response => response.json())
                          .then(data => console.log('GitHub response:', data))
                          .catch(error => console.error('GitHub error:', error));
                    }
                });
            } else {
                const url = activeTab.url;
                const options = {
                    url: url,
                    saveAs: false
                };
                if (saveDirectory) {
                    options.filename = `${saveDirectory}/${message.filename}`;
                } else {
                    options.filename = message.filename;
                }
                browser.downloads.download(options).then(function (downloadId) {
                    console.log('Download started with ID:', downloadId);
                }).catch(function (error) {
                    console.error('Download error:', error);
                });
            }
        }).catch(function (error) {
            console.error('Tab query error:', error);
        });
    } else if (message.action === 'setSaveDirectory') {
        browser.downloads.showDefaultFolder().then(() => {
            browser.downloads.setShelfEnabled(false);
            browser.downloads.onDeterminingFilename.addListener(function (item, suggest) {
                saveDirectory = item.filename.split('/').slice(0, -1).join('/');
                suggest({ filename: item.filename });
                browser.downloads.setShelfEnabled(true);
                return true;
            });
        });
    }
});
```

## 功能实现步骤

### 保存网页到本地
1. 用户点击 “Save Current Page” 按钮。
2. 弹出模态框，显示默认文件名（网页标题 + 时间戳），用户可确认或修改文件名。
3. 若未配置 GitHub 信息，将网页文件保存到本地指定目录（若设置了保存目录）或默认下载目录。

### 配置 GitHub 信息并保存到本地存储
1. 用户点击 “Configure GitHub” 按钮，弹出 GitHub 配置模态框。
2. 用户输入 GitHub 访问令牌、用户名、仓库名和分支名。
3. 点击 “Save Configuration” 按钮，将配置信息保存到本地存储。

### 将网页提交到 GitHub 仓库
1. 用户点击 “Save Current Page” 按钮，弹出文件名确认模态框。
2. 若已配置有效的 GitHub 信息，获取当前网页的 HTML 内容，将其转换为 Base64 编码。
3. 使用 GitHub API 的 `PUT` 请求将内容提交到指定的 GitHub 仓库和分支。

## 常见问题及解决办法

### prompt 没有弹框
- **代码执行环境问题**：将与用户交互的部分逻辑移到 `popup.js` 中，因为 `background.js` 是在后台运行的，没有直接的用户界面交互。
- **浏览器安全策略限制**：确保 `prompt` 是在用户点击按钮等明确的交互操作之后被调用的。
- **代码逻辑问题**：添加日志输出，确认代码是否执行到了 `prompt` 这一行。

### 弹窗太小文件名显示不下
- **使用自定义模态框替代 `prompt`**：在 `popup.html` 中创建自定义模态框，更好地控制其样式和大小。
- **优化文件名显示**：对文件名进行截断处理，并添加提示信息，让用户知道文件名被截断了。

### browser.storage is undefined
- **确保 `manifest.json` 中添加了 `storage` 权限**：在 `permissions` 中添加 `"storage"`。
- **检查代码运行环境**：确保代码是在支持 `browser` 对象的环境中运行。
- **检查代码是否正确引入和加载**：确保 `popup.js` 文件正确引入到 `popup.html` 中。
- **兼容性处理（可选）**：添加代码判断 `window.browser` 是否存在，若不存在则使用 `window.chrome`。

## 将插件发布到火狐市场主要有以下步骤：
1. **注册开发者账号**：访问[Firefox开发者中心](https://addons.mozilla.org/zh-CN/developers/)，首次使用会自动打开注册登录页，按照提示完成注册流程。注册过程中可能需要进行两步验证，可根据个人情况选择验证方式，如使用手机令牌工具等。
2. **准备插件文件**
    - **确保代码规范**：编写的插件代码要符合Firefox扩展的开发规范，遵循WebExtension API标准等，保证插件功能正常且稳定，没有明显的漏洞和错误。
    - **打包文件**：将插件代码打包成.zip格式。注意压缩包里面应该是manifest.json这一层文件目录，不能在manifest.json外再包一层目录。
3. **提交插件**
    - **登录开发者中心**：注册登录后点击“提交你的第一个附加组件”。
    - **选择发布形式**：接收协议及进行人机身份验证，然后根据个人情况选择发布形式，点击“继续”。
    - **上传文件**：按要求选择需要发布的.zip文件进行上传。
4. **填写插件信息**：提交成功后进入等待审核状态，可以在编辑产品页面，编辑描述附加组件、图像、附加信息和技术信息等，如插件的功能介绍、使用说明、适用的Firefox版本等，以便用户更好地了解和使用插件。
5. **等待审核**：提交后，Firefox官方团队会对插件进行审核，审核内容包括插件的功能、安全性、兼容性等方面。审核时间可能会有所不同，需耐心等待。审核通过后，插件就会成功发布到火狐市场。

Powered by [Doubao](https://www.doubao.com)