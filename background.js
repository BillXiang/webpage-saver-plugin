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
