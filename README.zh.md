# dsh-lan-plugin（中文版）

> 我给 [dsh](https://github.com/deepseek-ai/deepseek-harness) 写的一个插件——修局域网访问。挂了 `dsh-plugin` topic（上游明文鼓励的贡献方式）。
>
> English README: [README.md](README.md)

[![dsh-plugin](https://img.shields.io/badge/dsh--plugin-4D6BFE?style=flat-square)](https://github.com/topics/dsh-plugin)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](packages/dsh-lan-fix/LICENSE)

这个 monorepo 发的是符合官方 `dsh-plugin` 规范（npm 包 + `cordis.patch.yml` + profile node_modules 软链接）的 dsh 插件。**不改 dsh 任何源码**。

![手机通过局域网访问 dsh web 的截图](docs/images/lan-phone-screenshot.jpg)

*实拍：手机连同一个 WiFi，打开 `http://<lan-ip>:3080/`，session 列表 / 聊天记录 / 工具栏跟电脑 `http://127.0.0.1:3080/` 上看到的一模一样，不用装任何 app。*

---

## 为什么有这个仓库

`deepseek-ai/deepseek-harness` 还在 pre-release，他们的 `CONTRIBUTING.md` 写得直白：

> "We are sorry that we cannot accept external pull requests at the moment."

仓库层面也设了 `has_pull_requests: false`，外部 PR 暂时走不通。他们明文推荐的贡献方式就是发带 `dsh-plugin` topic 的独立插件——这条仓库就专门走那条路。

每个 plugin 实际改的就那么点东西（常常是一个方法、一两行 fallback），上游哪天开门直接就是 compatible 的 diff。这边 monkey-patch 的函数体，留着当未来 upstream PR 的草稿也合适。

---

## 插件列表

| 包 | 修什么 |
|---|---|
| [`@zynieie/dsh-lan-fix`](packages/dsh-lan-fix/) | 让 `dsh web` 在 `http://<lan-ip>:3080/`（insecure context）下能加载，不再卡空白。monkey-patch `AbstractApiClient.mintRpcId`，没有 `crypto.randomUUID` 时回落到 `crypto.getRandomValues`。 |

---

## 仓库结构

```
.
├── packages/
│   └── dsh-lan-fix/          # 局域网访问插件
│       ├── src/index.ts      # plugin 入口（monkey-patch）
│       ├── cordis.patch.yml  # Cordis bundle-patch 层
│       ├── package.json      # dsh.bundle.patch → cordis.patch.yml
│       ├── README.md         # 英文包说明
│       ├── README.zh.md      # 中文包说明
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── tests/            # node --test 基础单测
│       └── LICENSE           # MIT
├── docs/
│   ├── lan-access.md         # 长文档（根因 / 验证 / 安全）
│   └── images/               # 手机截图
├── pnpm-workspace.yaml
├── README.md                 # 仓库主页英文版
├── README.zh.md              # 仓库主页中文版（本文件）
└── .gitignore
```

---

## 安装任意 plugin

每个 plugin 是 npm 包；装到你 dsh profile 仓库的 `node_modules/` 里（或者 symlink 工作区包）：

```sh
# 在你的 dsh profile 仓库里
pnpm add --save-dev /absolute/path/to/dsh-lan-plugin/packages/dsh-lan-fix
# 或者 symlink：
ln -s /absolute/path/to/dsh-lan-plugin/packages/dsh-lan-fix \
      ./node_modules/@zynieie/dsh-lan-fix

pnpm dsh web --host 0.0.0.0
```

dsh bundle-loader 按依赖顺序走 patch 层。每个 plugin 的 `apply()` 在 web-app 任何构造 `AbstractApiClient` 的 row 之前执行，所以所有子类通过原型链都拿到补丁。

---

## 贡献

提 issue、发 PR、开 discussion 都行。这里的 plugin 沿用上游 `packages/bundle/*` 的形态——小、专注、单职责——所以贡献通常就是 `src/index.ts` 里一个方法的小改。

## 许可证

每个包都是 MIT——见 [`packages/dsh-lan-fix/LICENSE`](packages/dsh-lan-fix/LICENSE)。