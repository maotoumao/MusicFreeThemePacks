# MusicFree 桌面版的主题包
本项目只是个人学习记录一下

## 使用方法
1. 下载 [主题包](https://www.lanzoub.com/irK5a226qnyj)，并解压

2. 点击 + 号安装主题，安装解压文件夹内的 .mftheme 文件

3. 软件内切换主题即可

##  运行项目
项目运行前提确保设备已经安装nodejs
        npm install
        npm run publish


##  自己制作
1.  新建文件夹，文件名尽量与自己主题名保持一致
2.  文件夹中一定要包含`config.json`和`index.css`两个文件
3.  如果需要指向本地的图片，可以通过 `@/` 表示主题包的路径；preview、iframes、以及 iframes 指向的 html 文件都会把 `@/` 替换为 主题包路径
4.  制作完成使用`npm run publish`运行项目，新的主题文件生成存放在`.publish`文件夹下
<br/>

<img src="https://github.com/Hopelsz/MusicFreeThemePacks/assets/48856718/cee6a3fc-e96d-44c7-8f5b-b731a328c48f" width = 70% height = 70%/>
<br/>
<img src="https://github.com/Hopelsz/MusicFreeThemePacks/assets/48856718/8384fcf7-581a-43fa-987b-14280ce588b9)" width = 70% height = 70%/>
<br/>


本项目复刻自maotoumao的项目https://github.com/maotoumao/MusicFreeThemePacks
