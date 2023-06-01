//============================
// Base
//============================
let uid = GetQueryString("nick");

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

// 屏幕共享
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

// 视频, 音频, 待办事项

function videoView(bool) {
    $("#video").css("display", bool ? "block" : "none")
}

function audioView(bool) {
    $("#audio").css("display", bool ? "block" : "none")
}

function todoView(bool) {
    $("#todo").css("display", bool ? "block" : "none")
}

// emoji
function emojiView() {
    // new
    const pickerOptions = {
        onEmojiSelect: handleEmojiSelect,
        onClickOutside: handleClickOutside
    }
    const picker = new EmojiMart.Picker(pickerOptions)

    let e_b_emoji = document.getElementById('b-emoji')

    //
    const pickers = document.getElementsByTagName('em-emoji-picker');
    if (pickers.length === 0) {
        console.log("DOM还未创建")
        document.body.appendChild(picker)
    }
    const fixedElement = pickers[0];
    fixedElement.style.position = "absolute"
    fixedElement.style.display = "flex"

    // 获取目标元素的位置信息
    const targetRect = e_b_emoji.getBoundingClientRect();

    // 设置固定元素的位置
    fixedElement.style.top = `${targetRect.top - fixedElement.offsetHeight}px`;
    fixedElement.style.left = `${targetRect.left}px`;

    // 在表情选择器中选择表情时将其插入输入框
    picker.addEventListener('emoji', emoji => {
        const input = document.getElementById('sendTextarea');
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.substring(0, start) + emoji.native + input.value.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.native.length;
    });
}

function handleClickOutside(event) {
    const picker = document.getElementsByTagName('em-emoji-picker')[0];
    let e_b_emoji = document.getElementById('b-emoji')

    // 如果点击的不是自己
    if (picker.contains(event.target)) {
        return;
    }

    // 如果点击的是按钮
    if (e_b_emoji.contains(event.target)) {
        return;
    }

    // 最后关闭
    picker.style.display = 'none';

    // 将光标移回到具有焦点的元素
    document.getElementById('sendTextarea').focus();
}

function handleEmojiSelect(emoji) {
    // 在此处添加您的自定义逻辑
    console.log('您选择的表情符号是:', emoji);
    const input = document.getElementById('sendTextarea');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.substring(0, start) + emoji.native + input.value.substring(end);
    input.selectionStart = input.selectionEnd = start + emoji.native.length;
}

// 截图
function screenImageView(bool) {
    let display = bool ? "block" : "none"
    $("#screenImage").css("display", display)
}

function dataURLtoBlob(dataURL) {
    var arr = dataURL.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type: mime});
}

function screenImage() {
    // 获取整个页面的宽度和高度
    const body = document.body;
    const width = body.scrollWidth;
    const height = body.scrollHeight;

    // 创建一个 canvas 元素
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // 获取 canvas 的上下文
    const ctx = canvas.getContext('2d');

    // 记录当前滚动位置
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;

    // 将滚动条置顶，并截取整个页面
    window.scrollTo(0, 0);
    ctx.fillRect(0, 0, width, height);

    // 循环滚动和截图，直到整个页面都被截取
    let i = 0;

    function loop() {
        // 每次滚动页面一定距离
        window.scrollBy(0, window.innerHeight);

        // 等待滚动完成后截图
        setTimeout(() => {
            // 绘制上一次滚动位置到当前位置之间的区域
            ctx.fillRect(0, i * window.innerHeight, width, window.innerHeight);

            // 记录当前滚动位置
            i++;

            // 如果整个页面都已经被截取，则输出 data URL
            if (i * window.innerHeight >= height) {
                const dataUrl = canvas.toDataURL()
                console.log(dataUrl);

                // 解码为二进制数据
                let blob = dataURLtoBlob(dataUrl);

                let url = URL.createObjectURL(blob);

                let link = document.createElement('a');
                link.href = url;
                link.download = 'myImage.png';

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // document.querySelector("#screenImage").chi
                // screenImageView(true)

            } else {
                // 否则继续滚动和截图
                loop();
            }
        }, 200); // 等待 200 毫秒，等待滚动完成后截图
    }

    loop();
}

// 选图
function imageView(bool) {
    $("#image").css("display", bool ? "block" : "none")
}


//============================
// ws
//============================
let MESSAGE_CODE = {
    HEART_BEAT: 0,              // 心跳(客户)
    PRIVATE_CHAT: 1,            // 私聊(客户)
    GROUP_CHAT: 2,              // 群聊(客户)
    PING: 3,                    // ping(服务)
    PONG: 4,                    // pong(客户)
    SYSTEM: 5,                  // 系统(服务)
    SCREEN_CODE: 6,             // 屏幕共享
    VIDEO_CHAT_CODE: 7,         // 视频聊天
    AUDIO_CHAT_CODE: 8,         // 语音聊天
    FILE_CODE: 9,               // 文件
    USER_JOIN_CHAT_ROOM: 5,     // 有人加入
    USER_LEAVE_CHAT_ROOM: 6,    // 有人退出
}
let MESSAGE_TYPE_CODE = {
    NORMAL_SYSTEM_MESSAGE: 1,               // 普通系统消息
    UPDATE_USER_LIST_SYSTEM_MESSAGE: 3,     // 更新在线用户列表
    PERSONAL_SYSTEM_MESSAGE: 4,             // 个人系统消息
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

// 回显消息, 红点提醒
function responseShow(data, userId) {
    let nick = GetQueryString('nick')
    let receiverUserId = data.receiverUserId

    let response = userId === null ? $("#responseContent") : $("#responseContent-" + userId)

    if (data.username !== nick) {
        // 特殊情况: 如果是私聊
        if (receiverUserId !== undefined) {
            response = $("#responseContent-" + data.username)
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

function updateRedPoint(data) {
    // 如果是群聊

    // 如果是私聊
}

function webSocketLoad() {
    // 消息
    ws.onmessage = function (event) {
        console.log(event.data);
        let data = JSON.parse(event.data);
        switch (data.code) {
            // 群聊
            case MESSAGE_CODE.GROUP_CHAT:
                // 写入数据
                responseShow(data, null)
                // 红点提醒
                updateRedPoint(data)
                // 将组件的滚动条置底
                boxScroll(document.getElementById("responseContent"))
                break;
            // 私聊
            case MESSAGE_CODE.PRIVATE_CHAT:
                // 写入数据
                responseShow(data, data.receiverUserId)
                // 红点提醒
                updateRedPoint(data)
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
                    userList = data.ext.userList

                    // 更新在线人数
                    $("#online").text(userList.length)

                    // 群员变动提示
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
        let object = { "code": MESSAGE_CODE.USER_JOIN_CHAT_ROOM, "username": uid };
        ws.send(JSON.stringify(object))

        // 发送图片测试
        // var ws = new WebSocket("ws://localhost:8080/myHandler");
        /*let fileInput = document.getElementById("fileInput");
        fileInput.addEventListener("change", function(event) {
            var file = event.target.files[0];
            var reader = new FileReader();
            reader.onload = function(event) {
                var arrayBuffer = event.target.result;
                ws.send(arrayBuffer);
            };
            reader.readAsArrayBuffer(file);
        });*/

        /*navigator.mediaDevices
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
            })*/
    };

    // 关闭
    ws.onclose = function () {
        let object = { "code": MESSAGE_CODE.USER_LEAVE_CHAT_ROOM, "username": uid };
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
        object = { "code": MESSAGE_CODE.GROUP_CHAT, "username": uid, "msg": message };
    } else {
        object = { "code": MESSAGE_CODE.PRIVATE_CHAT, "username": uid, "msg": message, receiverUserId: chatUserActive };
    }
    $('#sendTextarea').val("");
    ws.send(JSON.stringify(object));
}


