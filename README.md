# dsh-lan-plugin

> 我给 [dsh](https://github.com/deepseek-ai/deepseek-harness) 做的一个插件，修局域网访问。挂了 `dsh-plugin` topic（上游明文鼓励的贡献方式）。
>
> 中文说明：[README.zh.md](README.zh.md)

[![dsh-plugin](https://img.shields.io/badge/dsh--plugin-4D6BFE?style=flat-square)](https://github.com/topics/dsh-plugin)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](packages/dsh-lan-fix/LICENSE)

This monorepo ships dsh plugins that follow the official `dsh-plugin` distribution conventions (npm package + `cordis.patch.yml` + profile-node_modules symlink). No `dsh` source is modified.

![Phone accessing dsh web on the LAN — full session list, chat history, and tool palette, no app install](docs/images/lan-phone-screenshot.jpg)

*Real capture: a phone on the same WiFi opening `http://<lan-ip>:3080/` after the LAN fix is installed — same `dsh web` session as the PC's `http://127.0.0.1:3080/`.*

## Why this repo exists

`deepseek-ai/deepseek-harness` is in pre-release. From their `CONTRIBUTING.md`:

> "We are sorry that we cannot accept external pull requests at the moment."

The repo also has `has_pull_requests: false` at the repo level, so external PRs are server-blocked for now. They explicitly recommend the contribution path: publish plugins with the `dsh-plugin` topic — this repo follows that path.

Each plugin here changes very little (often one method, a line or two of fallback), so it slots in cleanly when upstream opens up. The body of every monkey-patch doubles as a draft of the eventual upstream diff.

## Plugins

| Package | What it fixes |
|---|---|
| [`@zynieie/dsh-lan-fix`](packages/dsh-lan-fix/) | Lets `dsh web` load on `http://<lan-ip>:3080/` (insecure context) without the WebSocket abort storm. Patches `AbstractApiClient.mintRpcId` to fall back to `crypto.getRandomValues` when `crypto.randomUUID` is unavailable. |

## Repo layout

```
.
├── packages/
│   └── dsh-lan-fix/          # the LAN access plugin
│       ├── src/index.ts      # plugin entry (monkey-patch)
│       ├── cordis.patch.yml  # Cordis bundle-patch layer
│       ├── package.json      # dsh.bundle.patch → cordis.patch.yml
│       ├── README.md         # English
│       ├── README.zh.md      # 中文
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── tests/            # node --test sanity tests
│       └── LICENSE           # MIT
├── docs/
│   ├── lan-access.md         # long-form write-up (root cause, verification, security)
│   └── images/               # phone screenshot
├── pnpm-workspace.yaml
├── README.md                 # this file
└── .gitignore
```

## Install any plugin

Each plugin ships as an npm package; install it into the `node_modules/` of your dsh profile checkout (or symlink the workspace package in):

```sh
# from inside your dsh profile repo
pnpm add --save-dev /absolute/path/to/dsh-lan-plugin/packages/dsh-lan-fix
# or symlink:
ln -s /absolute/path/to/dsh-lan-plugin/packages/dsh-lan-fix \
      ./node_modules/@zynieie/dsh-lan-fix

pnpm dsh web --host 0.0.0.0
```

The dsh bundle-loader walks patch layers in dependency order. Each plugin's `apply()` runs before any web-app row that would otherwise build an `AbstractApiClient`, so every subclass inherits the patched prototype through the prototype chain.

## Contributing

Open an issue, send a PR to this repo, or open a discussion. The plugins here follow the same shape as upstream's `packages/bundle/*` — small, focused, single-responsibility — so contributions are usually one-method edits in `src/index.ts`.

## License

MIT per package — see [`packages/dsh-lan-fix/LICENSE`](packages/dsh-lan-fix/LICENSE).