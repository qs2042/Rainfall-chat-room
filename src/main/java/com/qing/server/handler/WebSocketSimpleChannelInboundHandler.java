package com.qing.server.handler;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.alibaba.fastjson.JSONException;
import com.qing.server.util.NettyUtil;
import lombok.extern.slf4j.Slf4j;

import com.alibaba.fastjson.JSONObject;
import com.qing.server.constant.MessageCodeConstant;
import com.qing.server.constant.MessageTypeConstant;
import com.qing.server.constant.WebSocketConstant;
import com.qing.server.entity.WsMessage;
import com.qing.server.service.WebSocketInfoService;
import com.qing.server.util.DateUtils;
import com.qing.server.util.NettyAttrUtil;
import com.qing.server.util.RequestParamUtil;
import com.qing.server.global.SessionHolder;

import io.netty.channel.Channel;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.handler.codec.http.websocketx.CloseWebSocketFrame;
import io.netty.handler.codec.http.websocketx.PingWebSocketFrame;
import io.netty.handler.codec.http.websocketx.PongWebSocketFrame;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketServerHandshaker;
import io.netty.handler.codec.http.websocketx.WebSocketServerHandshakerFactory;
import lombok.val;


/**
 * Netty ChannelHandler
 * 用来处理客户端和服务端的会话生命周期事件（握手、建立连接、断开连接、收消息等）
 * 接收请求，接收 WebSocket 信息的控制类
 */
@Slf4j
public class WebSocketSimpleChannelInboundHandler extends SimpleChannelInboundHandler<Object> {
    // WebSocket 握手工厂类
    private WebSocketServerHandshakerFactory factory = new WebSocketServerHandshakerFactory(WebSocketConstant.WEB_SOCKET_URL, null, false);
    private WebSocketServerHandshaker handShaker;

    // 业务逻辑
    private final WebSocketInfoService websocketInfoService = new WebSocketInfoService();

    // 事件: 客户端和服务端创建连接
    @Override
    public void channelActive(ChannelHandlerContext ctx) {
        log.info("{} 和服务端创建了连接", NettyUtil.getRemoteAddress(ctx));

        // 设置高水位
        // ctx.channel().config().setWriteBufferHighWaterMark();

        // 设置低水位
        // ctx.channel().config().setWriteBufferLowWaterMark();
    }

    // 事件: 客户端和服务端断开连接
    @Override
    public void channelInactive(ChannelHandlerContext ctx) {
        log.info("{} 和服务端断开连接", NettyUtil.getRemoteAddress(ctx));
        websocketInfoService.clearSession(ctx.channel());
    }

    // 事件: 服务端接收完客户端发送过来的数据结束之后
    @Override
    public void channelReadComplete(ChannelHandlerContext ctx) {
        ctx.flush();
    }

    // 事件: 出现异常
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
        log.error("{} 出现异常: {}", NettyUtil.getRemoteAddress(ctx), cause);
        ctx.close();
    }

    // 核心事件: 处理来自客户端的请求
    @Override
    protected void channelRead0(ChannelHandlerContext channelHandlerContext, Object o) {
        if (o instanceof FullHttpRequest) {
            // 处理客户端向服务端发起 http 请求的业务
            // FullHttpRequest req = (FullHttpRequest) o;
            // 如果是图片业务 req.uri().equals("/image");
            // 如果是握手业务 req.uri().equals("/");
            handHttpRequest(channelHandlerContext, (FullHttpRequest) o);
        } else if (o instanceof WebSocketFrame) {
            // 处理客户端与服务端之间的 websocket 业务
            handWebsocketFrame(channelHandlerContext, (WebSocketFrame) o);
        } else {
            // 如果没有符合处理消息的模块, 则将其传递给下一个ChannelInboundHandler
            channelHandlerContext.fireChannelRead(o);
        }

    }

    // 事件分发: 处理 websocket 业务
    private void handWebsocketFrame(ChannelHandlerContext ctx, WebSocketFrame frame) {
        // 判断是否为: 关闭 websocket 的指令
        if (frame instanceof CloseWebSocketFrame) {
            // 关闭握手
            handShaker.close(ctx.channel(), (CloseWebSocketFrame) frame.retain());
            websocketInfoService.clearSession(ctx.channel());
            return;
        }

        // 判断是否为: ping消息, Pong消息, 二进制消息
        if (frame instanceof PingWebSocketFrame) {
            ctx.channel().write(new PongWebSocketFrame(frame.content().retain()));
            return;
        }
        if (frame instanceof PongWebSocketFrame) {
            ctx.writeAndFlush(new PongWebSocketFrame(frame.content().retain()));
            return;
        }
        if (!(frame instanceof TextWebSocketFrame)) {
            ctx.channel().write(new PongWebSocketFrame(frame.content().retain()));
            throw new RuntimeException("【" + this.getClass().getName() + "】不支持消息");
        }

        // 获取客户端向服务端发送的消息
        String message = ((TextWebSocketFrame) frame).text();
        log.info("{}: {}", ctx.channel().remoteAddress(), message);

        // 判断是否为: JSON格式
        JSONObject json;
        try {
            json = JSONObject.parseObject(message);
        } catch (JSONException e) {
            SessionHolder.channelGroup.writeAndFlush(new TextWebSocketFrame("不支持该消息的类型"));
            return;
        }

        json.put("msgId", UUID.randomUUID().toString());
        json.put("sendTime", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        val code = json.getIntValue("code");
        val username = json.getString("username");
        val msg = JSONObject.toJSONString(json);

        switch (code) {
            // 心跳
            case MessageCodeConstant.HEART_BEAT:
                // 更新心跳时间
                NettyAttrUtil.refreshLastHeartBeatTime(ctx.channel());
                break;
            // 私聊
            case MessageCodeConstant.PRIVATE_CHAT_CODE:
                // 接收人id
                String receiveUserId = json.getString("receiverUserId");

                // 点对点挨个给接收人发送消息
                for (Map.Entry<String, Channel> entry : SessionHolder.channelMap.entrySet()) {
                    String userId = entry.getKey();
                    Channel channel = entry.getValue();
                    if (receiveUserId.equals(userId)) {
                        channel.writeAndFlush(new TextWebSocketFrame(msg));
                    }
                }

                // 如果发给别人，给自己也发一条
                if (!receiveUserId.equals(username)) {
                    SessionHolder.channelMap.get(username).writeAndFlush(new TextWebSocketFrame(msg));
                }
                break;
            // 群聊
            case MessageCodeConstant.GROUP_CHAT_CODE:
                // 向连接上来的客户端广播消息
                SessionHolder.channelGroup.writeAndFlush(new TextWebSocketFrame(JSONObject.toJSONString(json)));
                break;
            // 系统消息
            case MessageCodeConstant.SYSTEM_MESSAGE_CODE:
                // 向连接上来的客户端广播消息
                SessionHolder.channelGroup.writeAndFlush(new TextWebSocketFrame(JSONObject.toJSONString(json)));
                break;
            // pong消息
            case MessageCodeConstant.PONG_CHAT_CODE:
                // 更新心跳时间
                NettyAttrUtil.refreshLastHeartBeatTime(ctx.channel());
                break;
            default:
                log.warn("有可能是脱离客户端发送的消息");
                break;
        }
    }

    /**
     * 事件分发: 处理 http 业务
     * <p>
     * WebSocket在建立握手时, 数据是通过HTTP传输的
     * 但是建立之后，后面的传输时候是不需要HTTP协议的
     * <p>
     * WebSocket 连接过程
     * 0. 客户端发起http请求，经过3次握手后，建立起TCP连接
     * http请求里存放WebSocket支持的版本号等信息
     * 如：Upgrade、Connection、WebSocket-Version等
     * 1. 服务器收到客户端的握手请求后，同样采用HTTP协议回馈数据
     * 2. 客户端收到连接成功的消息后，开始借助于TCP传输信道进行全双工通信
     */
    private void handHttpRequest(ChannelHandlerContext ctx, FullHttpRequest request) {
        // 如果请求失败 或 该请求不是客户端向服务端发起的 http 请求
        if (!request.decoderResult().isSuccess() || !("websocket".equals(request.headers().get("Upgrade")))) {
            websocketInfoService.sendHttpResponse(
                    ctx,
                    new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.BAD_REQUEST)
            );
            return;
        }

        // 新建一个握手
        handShaker = factory.newHandshaker(request);

        // 如果为空, 说明是不受支持的 websocket 版本
        if (handShaker == null) {
            WebSocketServerHandshakerFactory.sendUnsupportedVersionResponse(ctx.channel());
            return;
        }

        // 从uri中获取参数
        Map<String, String> params = RequestParamUtil.urlSplit(request.uri());

        // 获取userId
        String userId = params.get("userId");
        if (userId == null) {
            log.info("握手失败: {}", request.uri());
            WebSocketServerHandshakerFactory.sendUnsupportedVersionResponse(ctx.channel());
            return;
        }
        log.info("握手成功: {}", request.uri());

        // ...
        Channel channel = ctx.channel();
        NettyAttrUtil.setUserId(channel, userId);
        NettyAttrUtil.refreshLastHeartBeatTime(channel);

        // ...
        handShaker.handshake(ctx.channel(), request);
        SessionHolder.channelGroup.add(ctx.channel());
        SessionHolder.channelMap.put(userId, ctx.channel());

        // 推送用户上线消息，更新客户端在线用户列表
        Set<String> userList = SessionHolder.channelMap.keySet();
        WsMessage msg = new WsMessage() {{
            setExt(new HashMap<String, Object>() {{
                put("userList", userList);
                put("user", userId);
            }});
            setCode(MessageCodeConstant.SYSTEM_MESSAGE_CODE);
            setType(MessageTypeConstant.UPDATE_USER_LIST_SYSTEM_MESSAGE);
        }};
        SessionHolder.channelGroup.writeAndFlush(new TextWebSocketFrame(JSONObject.toJSONString(msg)));
    }

}
