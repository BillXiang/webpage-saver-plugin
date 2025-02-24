let saveDirectory = null;

// 从本地存储中获取之前保存的 GitHub 配置信息
async function getGithubConfig() {
    const { githubConfig } = await browser.storage.local.get('githubConfig');
    return githubConfig;
}

// 保存网页到 GitHub 或本地
async function saveWebpage(tab, filename, githubConfig, saveTo) {
    try {
        if (saveTo === 'github' && githubConfig && githubConfig.token && githubConfig.username && githubConfig.repo && githubConfig.branch) {
            // 获取网页内容
            const result = await browser.tabs.executeScript(tab.id, { code: 'document.documentElement.outerHTML' });
            if (result && result.length > 0) {
                const content = result[0];
                const base64Content = btoa(unescape(encodeURIComponent(content)));
                const apiUrl = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${filename}`;
                const headers = {
                    'Authorization': `token ${githubConfig.token}`,
                    'Content-Type': 'application/json'
                };
                const body = {
                    message: `Save ${filename}`,
                    content: base64Content,
                    branch: githubConfig.branch
                };
                const apiResponse = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: headers,
                    body: JSON.stringify(body)
                });
                const data = await apiResponse.json();
                console.log('GitHub response:', data);
            }
        } else {
            const url = tab.url;
            const options = {
                url: url,
                saveAs: false
            };
            if (saveDirectory) {
                options.filename = `${saveDirectory}/${filename}`;
            } else {
                options.filename = filename;
            }
            const downloadId = await browser.downloads.download(options);
            console.log('Download started with ID:', downloadId);
        }
    } catch (error) {
        console.error('Error saving webpage:', error);
    }
}

// 监听收藏夹创建事件
browser.bookmarks.onCreated.addListener(async (id, bookmark) => {
    try {
        console.log('Bookmark created:', bookmark);
        if (bookmark.url) {
            const githubConfig = await getGithubConfig();
            const tabs = await browser.tabs.query({ url: bookmark.url });
            if (tabs.length > 0) {
                const tab = tabs[0];
                const currentDate = new Date();
                const timestamp = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}_${String(currentDate.getHours()).padStart(2, '0')}：${String(currentDate.getMinutes()).padStart(2, '0')}：${String(currentDate.getSeconds()).padStart(2, '0')}`;
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
                const defaultFilename = `${bookmark.title.replace(/[\/:*?"<>|]/g, '_')}_${timestamp}.html`;
                const finalFilename = fullPath ? `${fullPath}/${defaultFilename}` : defaultFilename;
                // 这里可以根据配置或者默认设置选择保存方式
                const saveTo = 'local'; // 可以修改为动态获取保存方式
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
            const currentDate = new Date();
            const timestamp = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}_${String(currentDate.getHours()).padStart(2, '0')}：${String(currentDate.getMinutes()).padStart(2, '0')}：${String(currentDate.getSeconds()).padStart(2, '0')}`;
            const defaultFilename = `${activeTab.title.replace(/[\/:*?"<>|]/g, '_')}_${timestamp}.html`;
            await saveWebpage(activeTab, defaultFilename, message.githubConfig, message.saveTo);
        }
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
