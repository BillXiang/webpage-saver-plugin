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
            const timestamp = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}_${String(currentDate.getHours()).padStart(2, '0')}：${String(currentDate.getMinutes()).padStart(2, '0')}：${String(currentDate.getSeconds()).padStart(2, '0')}`;
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
