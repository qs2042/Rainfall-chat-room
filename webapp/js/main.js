//============================
// Base
//============================
let uid = GetQueryString("nick");

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


//============================
// functions
//============================
const dom = {
    // 本地视频预览
    localVideo: document.querySelector('#localVideo'),
    // 视频列表区域
    videos: document.querySelector('#videos'),

    // 同屏视频预览
    screenVideo: document.querySelector('#screenVideo'),
    // 同屏视频列表区域
    screenVideos: document.querySelector('#screenVideos')
}

// 存储通信方信息
const remotes = {}

// socket发送消息
function sendMsg(tid, msg) {
    msg.t = 2;
    msg.tid = tid;
    msg.uid = uid;
    ws.send(JSON.stringify(msg))
}

function getUid() {
    return uid;
}

// 屏幕共享: 页面, 打开, 关闭
function screenView(bool) {
    let display = bool ? "block" : "none"
    $("#screen").css("display", display)
}

function startScreen() {
    let id = getUid();

    if (id !== uid) {
        ws.send(JSON.stringify({t: "2", tid: id, uid: uid, type: 'startScreen'}))
        return false;
    }
    if (!dom.screenVideo.srcObject) {
        let options = {audio: false, video: true};
        navigator.mediaDevices.getDisplayMedia(options)
            .then(stream => {
                screenVideo.srcObject = stream;
                for (let i in remotes) {
                    onmessage({uid: i, t: 2, type: 's_join'});
                }
                stream.getVideoTracks()[0].addEventListener('ended', () => {
                    closeScreen();
                });
            })
    }
}

function closeScreen(id, ot) {
    id = getUid();
    ot = (ot ? ot : 1);
    // 判断ID
    if (id !== uid) {
        if (ot == 1 && remotes[id].screenVideo) {
            remotes[id].screenVideo.srcObject = null;
        } else {
            sendMsg(id, {type: 'closeScreen', ot: 2})
        }
        return false;
    }

    if (dom.screenVideo.srcObject && ot === 1) {
        dom.screenVideo.srcObject.getVideoTracks()[0].stop()
        for (let i in remotes) {
            sendMsg(i, {type: 'closeScreen', ot: ot})
        }
        dom.screenVideo.srcObject = null;
    }
}

function videoView(bool) {
    $("#video").css("display", bool ? "block" : "none")
}

function audioView(bool) {
    $("#audio").css("display", bool ? "block" : "none")
}

function todoView(bool) {
    $("#todo").css("display", bool ? "block" : "none")
}


//============================
// ws
//============================
let MESSAGE_CODE = {
    HEART_BEAT: 0,      // 心跳(客户)
    PRIVATE_CHAT: 1,    // 私聊(客户)
    GROUP_CHAT: 2,      // 群聊(客户)
    PING: 3,            // ping(服务)
    PONG: 4,            // pong(客户)
    SYSTEM: 5,          // 系统(服务)
}
let wsUrl = 'ws://127.0.0.1:7979/websocket?userId=' + uid

let ws;
webSocketInit()
webSocketLoad()

// 用户列表
let userList = []
// 当前窗口状态
let chatUserActive = ""

// ws的初始化 + 加载
function webSocketInit() {
    if (!window.WebSocket) {
        window.WebSocket = window.MozWebSocket;
    }
    if (!window.WebSocket) {
        alert("您的浏览器不支持WebSocket");
        return;
    }
    ws = new WebSocket(wsUrl);
}

// 回显消息
function responseShow(data, userId) {
    let nick = GetQueryString('nick')
    let receiverUserId = data.receiverUserId

    let response = userId === null ? $("#responseContent") : $("#responseContent-" + userId)

    if (data.sendUserId !== nick) {
        // 特殊情况: 如果是私聊
        if (receiverUserId !== undefined) {
            response = $("#responseContent-" + data.sendUserId)
        }
        response.append(`
        <div class="d-flex mb-sm-2">
            <img class="rounded-2" src="../img/19.png" height="50" width="50" alt="">
            <div class="ms-sm-2">
                <div>
                    <span class="fw-bold">${data.username}</span> <span class="opacity-25">${data.sendTime}</span>
                </div>
                <div>
                    <span class="rounded-1 pt-1 pb-1 ps-2 pe-2" style="background-color: #b2e281">${data.msg}</span>
                </div>
            </div>
        </div>
    `)
    } else {
        // 特殊情况: 如果是私聊
        if (receiverUserId !== undefined) {
            response = $("#responseContent-" + data.receiverUserId)
        }
        response.append(`
        <div class="d-flex justify-content-end mb-sm-2">
            <div>
                <div>
                    <span class="opacity-25">${data.sendTime}</span> <span class="fw-bold">${data.username}</span>
                </div>
                <div>
                    <span class=" pt-1 pb-1 ps-2 pe-2 rounded-1 float-end" style="background-color: #b2e281">${data.msg}</span>
                </div>
            </div>
            <img class="rounded-2 ms-sm-2" src="../img/10.png" height="50" width="50" alt="">
        </div>
    `)
    }
}

function webSocketLoad() {
    // 消息
    ws.onmessage = function (event) {
        console.log(event.data);
        let data = JSON.parse(event.data);
        let nick = GetQueryString('nick')
        switch (data.code) {
            // 群聊
            case MESSAGE_CODE.GROUP_CHAT:
                // 写入数据
                responseShow(data, null)
                // 红点提醒
                updateRedPoint()
                // 将组件的滚动条置底
                boxScroll(document.getElementById("responseContent"))
                break;
            // 私聊
            case MESSAGE_CODE.PRIVATE_CHAT:
                // 写入数据
                responseShow(data, data.receiverUserId)
                // 红点提醒
                updateRedPoint()
                // 将组件的滚动条置底
                boxScroll(document.getElementById("responseContent"))
                break;
            // 系统
            case MESSAGE_CODE.SYSTEM:
                // 如果有用户离开
                /*remotes[id].pc.close()
                videos.removeChild(remotes[id].video)
                if (remotes[id].s_pc) {
                    remotes[id].s_pc.close()
                    if (remotes[id].screenVideo)
                        screenVideos.removeChild(remotes[id].screenVideo)
                }
                delete remotes[id]*/

                // 有人离开或者加入
                if (data.type === 3) {
                    // 获取数据
                    let users = data.ext.userList
                    userList = users

                    // 更新在线人数
                    $("#online").text(userList.length)

                    // 消息提示
                    if (data.ext.user !== uid) {
                        $("#responseContent").append(`<div class="align-self-center opacity-75">${data.ext.user}加入了聊天室</div>`)
                    }
                    // 更新好友栏
                    let nick = GetQueryString('nick')
                    let eUserList = $("#userList")
                    eUserList.text("")
                    eUserList.append(`
                    <div class="d-flex mb-3 user" onclick="chooseUser(null)">
                        <img src="../img/chatroom.png" class="rounded-5" alt="">
                        <div class="ms-sm-2 text-white text-truncate">公共频道</div>
                    </div>`)
                    for (let i in userList) {
                        let userId = userList[i]
                        eUserList.append(`
                            <div class="d-flex mb-3 user" onclick="chooseUser('${userId}')">
                                <img src="../img/${i}.png" class="rounded-5" alt="">
                                <div class="ms-sm-2 fw-bold text-${userId === nick ? 'success' : 'white'} text-truncate">${userId}</div>
                            </div>
                        `)
                    }
                }

                break;
            // PING
            case MESSAGE_CODE.PING:
                // 返回PONG
                let object = {"code": 4};
                ws.send(JSON.stringify(object));
                break;
        }
    }

    // 连接
    ws.onopen = function () {
        let object = {"code": 1000, "username": uid};
        ws.send(JSON.stringify(object))

        navigator.mediaDevices
            .getUserMedia({
                audio: true, // 本地测试防止回声
                video: true
            })
            .then(stream => {
                dom.localVideo.srcObject = stream;
                ws.send(JSON.stringify({t: 1, uid: uid}));
                ws.onmessage = function (event) {
                    onmessage(JSON.parse(event.data));
                }
            })
    };

    // 关闭
    ws.onclose = function () {
        let object = {"code": 1001, "username": uid};
        ws.send(JSON.stringify(object))
    };
}

function chooseUser(userId) {
    let title = $("#title")
    let responseContent = $("#responseContent")

    // 如果要跳转到公共频道
    if (userId === null) {
        chatUserActive = ""
        title.text("聊天室(公共频道)")
        responseContent.removeClass("d-none");
        userList.forEach(v => $("#responseContent-" + v).addClass("d-none"));
        return;
    } else {
        responseContent.addClass("d-none");
    }

    // 如果聊天框未创建那就创建
    chatUserActive = userId
    let e = $("#responseContent-" + userId)
    if (e.length === 0) {
        $("#response").append(`<div id="responseContent-${userId}" class="p-2 d-flex flex-column" style="min-height: 60vh"></div>`)
    }
    // 将其他的都隐藏掉
    userList
        .filter(v => v !== userId)
        .forEach(v => $("#responseContent-" + v).addClass("d-none"))
    // 更改标题
    $("#title").text(`聊天室(${userId})`)
    // 显示
    e.removeClass("d-none");
}

// 主动发请求保持心跳(以保持ws连接)
function heartBeat() {
    let bean = {code: 0}
    setInterval(() => {
        ws.send(JSON.stringify(bean))
    }, 3000);
}

// 红点提醒
function updateRedPoint() {
}

function updateRedPointPro(id) {
    if (id == null && currentChatUserNick !== groupChatName) {
        $("#redPoint").css("display", "block");
    } else if (currentChatUserId !== id && id !== me.id) {
        $("#redPoint-" + id).css("display", "block");
    }
}


// 发送信息
function sendMessage() {
    let message = $("#sendTextarea").val()
    if (message === "" || message == null) {
        alert("信息不能为空~");
        return;
    }

    let object;
    // 如果是群聊
    if (chatUserActive === "") {
        object = { "code": 2, "username": uid, "msg": message, "sendUserId": uid };
    } else {
        object = { "code": 1, "username": uid, "msg": message, "sendUserId": uid, receiverUserId: chatUserActive };
    }
    $('#sendTextarea').val("");
    ws.send(JSON.stringify(object));
}


