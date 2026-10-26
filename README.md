# V2EX 镜像加速与图片修复

一个用户脚本，用于优化 V2EX 镜像站（`global.v2ex.co`）及第三方搜索站（`sov2ex.com`）的访问体验：替换页面内域名链接，修复 Imgur / Reddit 图片防盗链与 Gravatar 头像加载，并加速帖子与节点背景图。

适用于 [Tampermonkey](https://www.tampermonkey.net/) / [ScriptCat](https://scriptcat.org/)。

## 功能

- **链接替换**：将链接属性中的 `www.v2ex.com` / `v2ex.com` 替换为 `global.v2ex.co`，`cdn.v2ex.com` 替换为 `cdn.v2ex.co`；负向后瞻的正则确保不会误伤邮箱地址或第三方域名。
- **Imgur 图片修复**：`i.imgur.com` 替换为镜像代理并注入 `referrerPolicy="no-referrer"` 绕过防盗链。
- **Reddit 图片镜像**：`i.redd.it` 替换为 WordPress CDN 镜像 `i3.wp.com`，同时覆盖 `srcset` 响应式属性。
- **背景图镜像**：处理内联样式与 `<style>` 规则中的 `static.v2ex.com` 背景图，避免原图站不可达时标签页长时间转圈等待。
- **失败自动重试**：图片加载失败（522 超时、404 等）时追加时间戳绕过缓存重试，最多 2 次。
- **节点头像修复**：在 `<node-sidebar>` 自定义元素升级前改写 light DOM 上的 `nodeAvatar` 属性，使 closed Shadow DOM 内的头像直接使用镜像 URL。
- **动态内容支持**：`MutationObserver` 监听 DOM 变化，覆盖 AJAX 无限滚动加载的回复与翻页内容。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [ScriptCat](https://scriptcat.org/)。
2. 打开 [`v2ex-mirror.user.js`](./v2ex-mirror.user.js)（点击 `Raw`，或点击仓库 About 下方的 Website 链接），扩展会识别元数据并弹出安装提示。
3. 脚本已配置 `@updateURL`，后续版本会自动提示升级。

## 配合重定向

本脚本不在 `v2ex.com` 上运行，如需访问主站时自动跳转到镜像站，建议使用 [Header Editor](https://he.firefoxcn.net/) 扩展在请求层完成重定向：

- Chrome / Edge：[Header Editor Lite](https://chrome.google.com/webstore/detail/header-editor/eningockdidmgiojffjmkdblpjocbhgh)
- Firefox：[Header Editor Lite](https://addons.mozilla.org/zh-CN/firefox/addon/header-editor-lite/)

在 Header Editor 设置中导入仓库中的 [`HE_V2EX-Redirect.json`](./HE_V2EX-Redirect.json) 规则文件。

## 关于 v2ex.co

`v2ex.co` 是 V2EX 官方的备用域名，详见站内讨论：[看到一个排名 15 万名的域名：v2ex.co](https://www.v2ex.com/t/1181463)。

## 技术要点

- **`document-start` 挂载**：背景图写在 body 内的 `<style>` 块里，监听必须早于该样式块的解析——替换 CSS 文本无法取消已挂起的连接。MutationObserver 回调是微任务，可在 `<style>` 插入瞬间完成替换，让原始请求永远不发出。
- **TreeWalker 遍历**：直接修改元素属性，避免 `innerHTML` 重写导致原有事件监听器失效。
- **写入前比较新旧值**：替换后的 URL 仍含原子串，若用 `includes` 判断会反复赋值，相同值的 `textContent` 赋值仍触发 `characterData` 变更，与监听器形成无限回环。
- **幂等性**：图片替换均锚定主机名而非做 `includes` 匹配，否则镜像后的 URL 会一层层叠加代理前缀。
- **`@grant none`**：不使用任何特权 API。

## License

[MIT](./LICENSE)

---

本项目受 [fuxx-V2EX Redirect](https://greasyfork.org/zh-CN/scripts/501048-fuxx-v2ex-v2ex-redirect) 和 [Load Imgur Images](https://shiquda.link/load-imgur-images/) 启发。
