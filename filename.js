// 生成文件名，修改时间戳格式
function generateFilename(title, isPdf = false) {
    const currentDate = new Date();
    const timestamp = `(${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')} ${String(currentDate.getHours()).padStart(2, '0')}：${String(currentDate.getMinutes()).padStart(2, '0')}：${String(currentDate.getSeconds()).padStart(2, '0')})`;
    const fileExtension = isPdf ? '.pdf' : '.html';
    return `${ title.replace(/[\/:*?"<>|]()/g, '_').substring(0, 126)} ${timestamp}${fileExtension}`;
}