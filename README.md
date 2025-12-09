# 网页版微信应用 (WeChat Web)

这是一个基于 MERN 技术栈 (MongoDB, Express, React, Node.js) 构建的网页版微信克隆应用，使用 Socket.io 实现实时通信功能。

## 功能特性

- **用户认证**：注册/登录，JWT 身份验证
- **实时聊天**：私聊与群聊，Socket.io 实时消息
- **图片消息**：支持图片发送与展示（Base64 简版）
- **未读计数**：登录拉取未读，进房自动清零
- **好友系统**：搜索用户、发起/接受/拒绝好友请求
- **群组管理**：创建群、拉人入群、移除成员、设/撤管理员、退群（群主不可退）
- **系统消息**：群邀请/移除/权限变更的系统消息广播
- **头像与昵称**：默认头像（颜色 token）与自定义上传；资料更新全网同步
- **表情输入**：基础表情面板，插入并发送表情

## 环境要求

- Node.js (v16 或更高版本)
- MongoDB (本地安装或使用 Atlas 云数据库)

## 项目结构

- `server/`: 后端 API 和 WebSocket 服务器代码。
- `client/`: 基于 React 的前端应用代码。

## 安装与运行

### 1. 后端设置 (Server)

进入 server 目录并安装依赖：
```bash
cd server
npm install
```

在 `server` 目录下创建一个 `.env` 文件，填入以下配置：
```env
MONGODB_URI=mongodb://localhost:27017/wechat-clone
JWT_SECRET=your_jwt_secret_key
PORT=5001
```
*注意：请确保你的 MongoDB 服务已启动，或者将 URI 替换为你的云数据库地址。*

启动后端服务器：
```bash
npm run dev
```

### 2. 前端设置 (Client)

进入 client 目录并安装依赖：
```bash
cd client
npm install
```

启动前端开发服务器：
```bash
npm run dev
```

> 端口与代理：前端 Vite 代理会将 `/api` 请求转发到 `http://localhost:5001`。如需修改，请在 `client/vite.config.js` 更新 `server.proxy`。

## 使用说明

1. 打开浏览器访问前端地址（例如 `http://localhost:5173` 或 `5174`）
2. 注册并登录账号
3. 进入“通讯录 → 新的朋友”搜索用户并添加好友；或在“群信息”中拉人入群
4. 在聊天页发送文本、表情或图片消息；未读计数会在列表显示

## 常见问题

- 500 错误（搜索接口）：检查前端代理是否指向后端端口 `5001`
- Socket 未连接：确保后端已启动在 `5001`，前端连接地址为 `http://<hostname>:5001`

## 技术栈

- **前端**: React, Vite, TailwindCSS, Socket.io-client, React Router.
- **后端**: Node.js, Express, Socket.io, Mongoose, JWT, Bcrypt.
