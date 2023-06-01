// 滚动条置底
function boxScroll(html_element) {
    html_element.scrollTop = html_element.scrollHeight;
}

// 获取URL中的参数
function GetQueryString(name) {
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    const r = window.location.search.substr(1).match(reg);
    if (r !== null) {
        return unescape(decodeURI(decodeURI(r[2])));
    }
    return null;
}