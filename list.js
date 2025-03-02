// 向本地存储列表添加数据的函数
async function addDataToList(newData) {
    try {
        // 从本地存储中获取现有的数据列表
        const result = await browser.storage.local.get('uploadList');
        let uploadList = result.uploadList || [];

        // 将新数据添加到列表中
        uploadList.push(newData);

        // 将更新后的列表存回本地存储
        await browser.storage.local.set({ uploadList });
        console.log('Data added successfully:', newData);
    } catch (error) {
        console.error('Error adding data:', error);
    }
}

// 获取本地存储中的上传信息列表
async function getUploadList() {
    try {
        const result = await browser.storage.local.get('uploadList');
        return result.uploadList || [];
    } catch (error) {
        console.error('Error getting upload list:', error);
        return [];
    }
}

// 展示上传信息列表
async function displayUploadList() {
    const uploadList = await getUploadList();
    const listElement = document.getElementById('uploadList');

    uploadList.forEach((info, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `File: ${info.content.path}, SHA: ${info.content.sha}`;

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this file?')) {
                await deleteFileFromGitHub(info.content.path, info.content.sha);
                await removeUploadInfo(index);
                listItem.remove();
            }
        });

        listItem.appendChild(deleteButton);
        listElement.appendChild(listItem);
    });
}

// 从 GitHub 删除文件
async function deleteFileFromGitHub(filePath, sha) {
    const githubConfig = await getGithubConfig();
    const apiUrl = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${filePath}`;

    const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
            'Authorization': `token ${githubConfig.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: 'Delete the file',
            sha: sha
        })
    });

    return await response.json();
}

// 从本地存储中移除上传信息
async function removeUploadInfo(index) {
    try {
        const result = await browser.storage.local.get('uploadList');
        let uploadList = result.uploadList || [];
        uploadList.splice(index, 1);
        await browser.storage.local.set({ uploadList });
        console.log('Upload info removed successfully');
    } catch (error) {
        console.error('Error removing upload info:', error);
    }
}

// 页面加载完成后展示列表
document.addEventListener('DOMContentLoaded', displayUploadList);
