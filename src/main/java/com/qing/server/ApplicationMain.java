package com.qing.server;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import com.qing.server.constant.WebSocketConstant;
import com.qing.server.handler.WebSocketChannelInitializer;
import com.qing.server.service.WebSocketInfoService;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import lombok.extern.slf4j.Slf4j;

// 服务启动类
@Slf4j
public class ApplicationMain {
    // 使用多Reactor多线程模型
    // EventLoopGroup相当于线程池，内部维护一个或多个线程（EventLoop）
    // 而每个EventLoop又可以处理多个Channel（单线程处理多个IO任务）

    // 创建主线程组EventLoopGroup，专门负责建立连接
    private static EventLoopGroup bossGroup = new NioEventLoopGroup(1);
    // 创建子线程组，专门负责IO任务的处理
    private static EventLoopGroup workGroup = new NioEventLoopGroup();

    private static Channel ch;
    private static ChannelFuture chf;

    public static void main(String[] args) {
        startNettyServer();
    }

    private static void startNettyServer() {
        try {
            // 启动服务
            ServerBootstrap b = new ServerBootstrap();

            // 设置组
            b.group(bossGroup, workGroup);

            // 设置频道
            b.channel(NioServerSocketChannel.class);

            // 设置子处理
            b.childHandler(new WebSocketChannelInitializer());

            // 绑定 chf = b.bind(WebSocketConstant.WEB_SOCKET_PORT).sync();
            ch = b.bind(WebSocketConstant.WEB_SOCKET_PORT).sync().channel();

            // 创建一个定长线程池，支持定时及周期性任务执行
            ScheduledExecutorService executorService = Executors.newScheduledThreadPool(3);

            // 创建业务逻辑类
            WebSocketInfoService webSocketInfoService = new WebSocketInfoService();

            // 定时任务: 扫描所有的Channel, 并关闭失效的Channel
            executorService.scheduleAtFixedRate(
                    webSocketInfoService::scanNotActiveChannel,
                    3,
                    60,
                    TimeUnit.SECONDS
            );

            // 定时任务: 向所有客户端发送Ping消息(让客户端返回Pong消息, 以此来保持心跳)
            executorService.scheduleAtFixedRate(
                    webSocketInfoService::sendPing,
                    3,
                    50,
                    TimeUnit.SECONDS
            );

            ch.closeFuture().sync();

        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            // 退出程序
            shutdown();
        }
    }

    private static void shutdown() {
        if (ch != null) {
            ch.close().syncUninterruptibly();
        }
        if (chf != null) {
            chf.channel().close().syncUninterruptibly();
        }
        if ((bossGroup != null) && (!bossGroup.isShutdown())) {
            bossGroup.shutdownGracefully();
        }
        if ((workGroup != null) && (!workGroup.isShutdown())) {
            workGroup.shutdownGracefully();
        }
    }
}
