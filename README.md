<div align="center">

<img src="public/icons/icon-192.png" width="96" height="96" style="border-radius: 20px" />

# MateTrip 伴旅

### 算清一路琐碎，存下全程风景。

*Not just a bill splitter — a keeper of shared travel memories.*

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?style=flat-square&logo=railway)](https://railway.app)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)

[English README](README_EN.md)

</div>

---

## 简介

**MateTrip（伴旅）** 是一个为多人旅行设计的渐进式网页应用（PWA）。无需安装，手机直接访问，集合了共同账单分摊、照片回忆、行程计划和实时群聊，是旅行路上的全能伴侣。

---

## 功能一览

### 🗺 旅程管理
- 创建行程，设置名称、目的地、货币和日期
- 通过 6 位邀请码邀请成员加入
- 房主可踢出成员、**转让房主身份**
- 支持多种货币（日元、马币、美元、泰铢等）

### 🧾 账单
- 📷 拍照扫描账单，自动识别金额、日期、商家（Google Vision OCR）
- 手动填写付款人、参与者、账单分项
- 账单分类标签（餐饮、交通、住宿等）
- 支持上传照片作为账单凭证

### 💰 结算
- 实时计算每位成员的收支余额
- 最优化债务合并算法，减少转账次数
- 一键标记结清，支持撤销
- 行程总消费、人均明细、待结清笔数

### 📷 相册
- 共享相册，所有成员均可上传
- 照片标题与留言
- 按日期分组显示
- 房主可删除任意照片，上传者可删除自己的

### 📅 计划
- 协作日程：添加时间、地点和备注
- 日程可附加 Google Maps 链接
- 导出 `.ics` 文件，直接加入手机日历 / 提醒
- 实时群聊留言
- 🔔 离线推送通知（iOS 16.4+ 添加到主屏后支持）
- 聊天身份可关联旅伴，展示旅伴头像和名字

### 👥 旅伴
- 通过 DiceBear（14 种风格）或上传照片自定义头像
- 将用户账号关联到旅伴档案，聊天中显示旅伴头像
- 房主可管理所有成员的账号关联

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite，部署于 GitHub Pages |
| 后端 | Node.js + Express，部署于 Railway |
| 数据库 | Firebase Firestore（实时同步） |
| 认证 | Firebase Authentication（邮箱 + Google 登录） |
| 媒体 | Cloudinary（照片上传与压缩） |
| OCR | Google Cloud Vision API |
| 推送 | Web Push API + VAPID |

---

## 数据模型

所有行程数据存储于 Firestore 路径 `trips/{tripId}/`，包含以下子集合：

```
trips/{tripId}/
├── receipts/      账单（金额、分项、参与者）
├── people/        旅伴档案（名称、头像、linkedUserId）
├── photos/        相册（Cloudinary URL、标题、上传者）
├── settlements/   结算记录
├── schedule/      日程（日期、时间、地点、地图链接）
└── messages/      群聊（内容、uid、时间戳）

pushSubscriptions/{tripId}_{userId}   推送订阅（顶层集合）
```

---

## 后端接口

| 接口 | 说明 |
|------|------|
| `POST /api/drive/upload` | 上传照片至 Cloudinary |
| `DELETE /api/drive/file/:id` | 删除 Cloudinary 照片 |
| `POST /api/ocr/receipt` | Google Vision 账单识别 |
| `POST /api/push/subscribe` | 注册推送订阅（前端直接写 Firestore） |
| `POST /api/push/send` | 向行程成员发送推送通知 |

---

## 环境配置

### 前端 `.env`

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=          # Railway 后端 URL
VITE_VAPID_PUBLIC_KEY=      # npx web-push generate-vapid-keys 生成
```

### 后端 Railway 环境变量

```env
GOOGLE_SERVICE_ACCOUNT_JSON=   # Google 服务账号完整 JSON
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=                   # mailto:your@email.com
CLIENT_ORIGIN=                 # 允许的前端域名，逗号分隔
```

---

## 部署说明

### 前端（GitHub Pages）

```bash
# vite.config.js 中设置
base: '/trip/'

# 构建并部署
npm run build
# 将 dist/ 部署至 GitHub Pages
```

> PWA 文件：`public/manifest.json`、`public/sw.js`（后台推送）、`public/icons/`

### 后端（Railway）

```bash
# 将 server/ 目录推送至 GitHub
# 在 Railway 连接仓库并配置所有环境变量
# 每次 git push 自动触发重新部署
```

---

## PWA 与推送通知

> 添加到手机主屏幕后，体验与原生 App 相同。

**iOS**
- 需要 iOS 16.4 及以上版本
- 必须通过 Safari →「分享」→「添加到主屏幕」安装
- 推送通知仅在 PWA 模式下有效，Safari 浏览器内不支持

**Android**
- Chrome 完整支持 Web Push，无需以 PWA 模式运行
- 建议通过 Chrome「添加到主屏幕」安装以获得最佳体验

---

## 项目截图

> *(可在此处添加截图)*

---

<div align="center">

**MateTrip 伴旅** · 算清一路琐碎，存下全程风景。

Built with React · Firebase · Railway · Cloudinary

</div>
