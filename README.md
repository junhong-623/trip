<div align="center">

<img src="public/icons/icon-192.png" width="96" height="96" style="border-radius: 20px" />

# 伴旅 MateTrip

### 算清一路琐碎，存下全程风景。

*Not just a bill splitter — a keeper of shared travel memories.*

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?style=flat-square&logo=railway)](https://railway.app)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)

[English README](README_EN.md)

[To Know More](https://www.jeeprod.com/matetrip/intro)

[Offical Website](https://www.jeeprod.com/matetrip/)

</div>

---

## 伴旅是什么？

每一次结伴旅行，都有一堆琐碎：谁付了这顿、该还给谁、那张照片在谁手机里……

**伴旅**想做的，是把这些琐碎变成旅途的一部分——而不是麻烦。

它是一个为多人旅行设计的 PWA（渐进式网页应用），无需安装，打开即用。账单分摊、照片共享、行程协作、实时群聊……你需要的，都在这里。而它留下的，是一本属于你们这趟旅程的回忆账本。

---

## ✨ 伴旅能做什么

### 🗺 旅程 · 从一声邀约开始
- 创建一个行程，定好目的地、货币和日期
- 生成 6 位暗号（比如 **#Q6D2N8**），发给旅伴，他们就加入了
- 发起人可以转让“启程者”身份，也可以悄悄送走不靠谱的伙伴（偶尔需要）

### 🧾 账单 · 不只是数字
- 📷 拍下小票，OCR 自动识别金额、日期、商家——不用手输
- 谁付的、谁吃了这顿拉面、谁没喝那杯啤酒，清清楚楚
- 给每一笔加上标签：🍣 美食、🚄 交通、🏡 住宿……后来翻起来，像在读日记

### 💰 结算 · 体面地谈钱
- 实时算出每个人的收支，谁该补谁一目了然
- 债务合并算法，让转账次数最少——朋友间不用为了几块钱转来转去
- 一笔结清，轻轻打上 ✓ 已还清，谁都不尴尬

### 📷 相册 · 照片会讲故事
- 共享相册，每个人都能上传，标题、留言、日期分组
- 发起人可以整理，谁拍的都能删——只要是为了大家好看
- 以后翻起来，每一张都知道是谁拍的、在哪天、吃了什么

### 📅 计划 · 走着走着就有了默契
- 协作日程：几点、去哪、地图链接、备注
- 一键导出 `.ics`，放进手机日历，提醒不会忘
- 群里聊着聊着，就把第二天定下来了

### 👥 旅伴 · 头像、名字、故事
- 用 DiceBear 或自己上传，每个人都有一个喜欢的头像
- 把账号和旅伴档案关联起来——聊天时看到的是那张熟悉的脸
- 发起人可以管理所有关联，谁是谁，不会乱

### 🔔 离线通知 · 不打扰的提醒
- iOS 16.4+ 添加到主屏后，推送通知会轻轻告诉你：有人付了钱、有人发了照片、明天几点出发
- 不用一直挂着 App，该知道的事不会错过

---

## 🛠 怎么造的

| 那部分 | 用了什么 |
|--------|----------|
| 前端 | React 18 + Vite，住在 GitHub Pages |
| 后端 | Node.js + Express，住在 Railway |
| 数据库 | Firebase Firestore，实时同步 |
| 登录 | Firebase Auth（邮箱 / Google） |
| 照片 | Cloudinary，存、压、删一条龙 |
| 扫小票 | Google Cloud Vision，认出金额和字 |
| 推送 | Web Push + VAPID，iOS 和 Android 都能用 |

---

## 📁 数据怎么存的

一个旅程，就是一个 Firestore 路径：`trips/{tripId}/`

里面装着这一路的所有：
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


---

## 🌐 后端干了什么

| 接口 | 做什么 |
|------|--------|
| `POST /api/drive/upload` | 收照片，发给 Cloudinary |
| `DELETE /api/drive/file/:id` | 删照片，不留痕迹 |
| `POST /api/ocr/receipt` | 看小票，读出金额和字 |
| `POST /api/push/subscribe` | 记下谁想收推送 |
| `POST /api/push/send` | 告诉所有人：有新动静 |

---

## 🔧 想自己跑起来？

### 前端 `.env`

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=          # 后端地址（比如 railway 那个）
VITE_VAPID_PUBLIC_KEY=      # npx web-push generate-vapid-keys 生成
```

### 后端 Railway 环境变量

```env
GOOGLE_SERVICE_ACCOUNT_JSON=   # Google 服务账号的完整 JSON
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=                   # mailto:your@email.com
CLIENT_ORIGIN=                 # 允许的前端域名，逗号隔开
```

---

## 🚀 部署一下？

### 前端（GitHub Pages）

```bash
# vite.config.js 里设好 base
base: '/trip/'

# 构建
npm run build
# 把 dist/ 扔到 GitHub Pages
```

> PWA 文件：`public/manifest.json`、`public/sw.js`（后台推送）、`public/icons/`

### 后端（Railway）

```bash
# 把 server/ 推上 GitHub
# 在 Railway 连上仓库，配好环境变量
# 每次 git push 它自己就重新跑了
```

---

## 📱 PWA 和推送 · 说给 iOS 和 Android 听

> 添加到手机主屏幕后，体验与原生 App 相同。

**iOS**
- 需要 iOS 16.4 及以上版本
- 必须通过 Safari →「分享」→「添加到主屏幕」安装
- 推送通知仅在 PWA 模式下有效，Safari 浏览器内不支持

**Android**
- Chrome 完整支持 Web Push，无需以 PWA 模式运行
- 建议通过 Chrome「添加到主屏幕」安装以获得最佳体验

---

<div align="center">

**MateTrip 伴旅** · 算清一路琐碎，存下全程风景。

Built with React · Firebase · Cloudinary

</div>
