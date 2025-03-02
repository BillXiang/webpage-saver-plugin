// 从本地存储中获取之前保存的 GitHub 配置信息
async function getGithubConfig() {
    const { githubConfig } = await browser.storage.local.get('githubConfig');
    return githubConfig;
}