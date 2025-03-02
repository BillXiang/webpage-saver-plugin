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

// 保存网页到 GitHub 或本地
async function saveWebpage(tab, filename, githubConfig, saveTo) {
    try {
        const isPdf = tab.url.endsWith('.pdf');
        const tabId = tab.id;
        let content;
        if (!isPdf) {
            // 获取网页内容
            let htmlContent;
            await browser.tabs.executeScript(tabId, 
                { code: 'document.documentElement.outerHTML' }
            ).then((result) => {
                htmlContent = result[0];
            });

            await browser.tabs.executeScript(tabId, { code: `
                function readFileAsDataURL(file) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = function () {
                            if (this.readyState === FileReader.DONE) {
                                resolve(this.result);
                            }
                        };
                        reader.onerror = function () {
                            reject(new Error('文件读取出错'));
                        };
                        reader.readAsDataURL(file);
                    });
                };
                (async function() {
                    // 处理图片，将图片的 src 替换为 data URL
                    let content = '${htmlContent.replace(/'/g, "\\'").replace(/\n/g, '\\n')}';

                    const images = document.querySelectorAll('img');
                    for (const img of images) {
                        const response = await fetch(img.src);
                        const blob = await response.blob();

                        try {
                            let dataUrl;
                            await readFileAsDataURL(blob)
                                .then((result) => {
                                    dataUrl = result;
                                });
                            content = content.replace(img.getAttribute('src'), dataUrl);
                        } catch (error) {
                            console.error('读取文件时出错:', error);
                        }
                    }
                    return content;
                })();
            `}).then((result) => {
                htmlContent = result[0];
            }).catch(error => {
                console.log("executeScript error:", error)
            });

            let styleTags = '';
            await browser.tabs.executeScript(tabId, { code: `
                // 处理样式表，将样式表内容嵌入到 HTML 中
                let styleTags = '';
                const styleSheets = document.styleSheets;
                for (const styleSheet of styleSheets) {
                    try {
                        const cssRules = styleSheet.cssRules;
                        let cssText = '';
                        for (const rule of cssRules) {
                            cssText += rule.cssText;
                        }
                        const styleTag = '<style>' + cssText + '</style>';
                        styleTags += styleTag;
                        
                    } catch (error) {
                        console.error('读取样式表时出错:', error);
                    }
                    styleTags
                }
            `}).then((result) => {
                styleTags = result[0];
            }).catch(error => {
                console.log("executeScript error:", error)
            });

            htmlContent = htmlContent.replace('</head>', styleTags + '</head>');


            const summary = await getSummary(browser, tabId);
            let headInfo = `<!-- Filename: ${filename}\n Page saved with X-Webpage-Conserve \n url: ${tab.url}\n`;
            if (summary) {
                headInfo += ` Summary: ${summary}\n-->\n`
            } else {
                headInfo += ' Summary: \n-->\n'
            }
            if (htmlContent && htmlContent.length > 0) {
                content = headInfo + htmlContent;
            }
        }

        if (saveTo === 'github' && githubConfig && githubConfig.token && githubConfig.username && githubConfig.repo && githubConfig.branch) {
            console.log("progressDiv 开始上传到 GitHub...")
            if (isPdf) {
                browser.notifications.create({
                    type: 'basic',
                    title: `PDF ${filename} save progress`,
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
            
            // 调用函数添加数据
            addDataToList(data);

            if (isPdf) {
                browser.notifications.create({
                    type: 'basic',
                    title: `PDF ${filename} save progress`,
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
                console.log("content", content);
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