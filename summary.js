async function getSummary(browser, tabId) {
    const summary = await browser.tabs.executeScript(tabId, { code: `
        (function() {
            // 获取Shadow宿主元素
            let orbitElement = document.querySelector('orbit-wrapper');
            
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
                    return targetParagraph[0].textContent;
                } else {
                    console.log('Target paragraph not found.');
                }
            }
        })();
    `});
    return summary;
}