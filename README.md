
```shell
# 初始化git项目
git init

# 添加忽略文件
touch .gitignore

# 
git add .

# 提供commit
git commit -m "Initial commit"

# 设置远程仓库(这里删除了https是因为https方式被墙了, 所以选用git)
git remote add origin https://github.com/qs2042/chat_room.git
git remote rm origin
git remote add origin git@github.com:qs2042/chat_room.git

# 提交到远程仓库的 master 分支
git push --set-upstream origin master

# 切换本地分支到main(如果没有则创建)
git checkout -b main

# 合并 master分支 到 main
git merge master

# 
git pull --rebase origin master

# 将本地的 main分支 推送到远程仓库
git push -u origin master
```