# goindex
Google Drive Directory Index

## 功能：
部署在 CloudFlare Workers的小程序。  
可以将 Google Drive 文件以目录形式列出，并直连下载。  
流量走 CloudFlare ，网速由 CloudFlare 决定。

## Demo
[https://index.gd.workers.dev/](https://index.gd.workers.dev/)  

## 安装运行

1、访问[https://install.gd.workers.dev/](https://install.gd.workers.dev/)  
2、授权认证后，生成部署代码。  
3、复制代码 到 CloudFlare 部署。  

## 更新内容
1.文件大小显示修改（bytes,KB,MB,GB）  
2.列表以文件名排序  
3.文件修改时间修改（YYYY-MM-DD hh:mm:ss）  
4.用户名密码认证功能
