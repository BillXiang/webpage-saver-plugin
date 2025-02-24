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
