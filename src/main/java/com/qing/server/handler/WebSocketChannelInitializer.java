package com.qing.server.handler;

import io.netty.channel.ChannelInitializer;
import io.netty.channel.socket.SocketChannel;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.stream.ChunkedWriteHandler;
import lombok.val;

public class WebSocketChannelInitializer extends ChannelInitializer<SocketChannel> {
    @Override
    protected void initChannel(SocketChannel socketChannel) throws Exception {
        val pipeline = socketChannel.pipeline();

        // pipeline.addLast(new WebSocketServerProtocolHandler("/myim", null, true, Integer.MAX_VALUE, false));
        /*pipeline.addLast(new MessageToMessageCodec<TextWebSocketFrame, String>() {
            @Override
            protected void decode(ChannelHandlerContext ctx, TextWebSocketFrame frame, List<Object> list) throws Exception {
                list.add(frame.text());
            }

            @Override
            protected void encode(ChannelHandlerContext ctx, String msg, List<Object> list)
                    throws Exception {
                list.add(new TextWebSocketFrame(msg));
            }
        });*/

        pipeline
                // 请求解码器
                .addLast("http-codec", new HttpServerCodec())

                // 将多个消息转换成单一的消息对象
                .addLast("aggregator", new HttpObjectAggregator(65536))

                // 支持异步发送大的码流，一般用于发送文件流
                .addLast("http-chunked", new ChunkedWriteHandler())

                // 处理 websocket 和处理消息的发送
                .addLast("handler", new WebSocketSimpleChannelInboundHandler());
    }
}
