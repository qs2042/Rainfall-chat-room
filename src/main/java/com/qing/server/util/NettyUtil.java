package com.qing.server.util;

import io.netty.channel.ChannelHandlerContext;

import java.net.SocketAddress;

public class NettyUtil {
    public static SocketAddress getRemoteAddress(ChannelHandlerContext ctx) {
        return ctx.channel().remoteAddress();
    }
}
