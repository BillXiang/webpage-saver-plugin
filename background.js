let saveDirectory = null;

// 从本地存储中获取之前保存的 GitHub 配置信息
async function getGithubConfig() {
    const { githubConfig } = await browser.storage.local.get('githubConfig');
    return githubConfig;
}

// 保存网页到 GitHub 或本地
async function saveWebpage(tab, filename, githubConfig) {
    const hasGithubConfig = githubConfig && githubConfig.token && githubConfig.username && githubConfig.repo && githubConfig.branch;
    console.log('saveWebpage'); 
    if (hasGithubConfig) {
        // 获取网页内容
        browser.tabs.executeScript(tab.id, { code: 'document.documentElement.outerHTML' }, function (result) {
            if (result && result.length > 0) {
                console.log('saveWebpageToGithub'); 
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
        browser.downloads.download(options).then(function (downloadId) {
            console.log('Download started with ID:', downloadId);
        }).catch(function (error) {
            console.error('Download error:', error);
        });
    }
}

// 监听收藏夹创建事件
browser.bookmarks.onCreated.addListener(async (id, bookmark) => {
    console.log('Bookmark created:', bookmark, bookmark.url); 
    try {
        if (bookmark.url) {
            const githubConfig = await getGithubConfig();
            const tab = await browser.tabs.query({ url: bookmark.url });
            console.log('tab.length:', tab.length);
            if (tab.length > 0) {
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
                saveWebpage(tab[0], finalFilename, githubConfig);
            }
        }
    } catch (error) {
        console.error('Error handling bookmark creation:', error);
    }
});

browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === 'savePage') {
        browser.tabs.query({ active: true, currentWindow: true }).then(async function (tabs) {
            const activeTab = tabs[0];
            const githubConfig = await getGithubConfig();
            const currentDate = new Date();
            const timestamp = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}_${String(currentDate.getHours()).padStart(2, '0')}：${String(currentDate.getMinutes()).padStart(2, '0')}：${String(currentDate.getSeconds()).padStart(2, '0')}`;
            const defaultFilename = `${activeTab.title.replace(/[\/:*?"<>|]/g, '_')}_${timestamp}.html`;
            saveWebpage(activeTab, defaultFilename, githubConfig);
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
