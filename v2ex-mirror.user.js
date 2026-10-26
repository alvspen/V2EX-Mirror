// ==UserScript==
// @name         V2EX 镜像加速与图片修复
// @namespace    https://github.com/alvspen/V2EX-Mirror
// @version      1.5.0
// @description  替换页面内域名链接，修复 Imgur / Reddit 图片防盗链及 Gravatar 头像加载，加速帖子图片与节点背景图。
// @author       alvspen
// @license      MIT
// @match        *://*.v2ex.co/*
// @match        *://*.sov2ex.com/*
// @run-at       document-start
// @grant        none
// @homepageURL  https://github.com/alvspen/V2EX-Mirror
// @supportURL   https://github.com/alvspen/V2EX-Mirror/issues
// @updateURL    https://raw.githubusercontent.com/alvspen/V2EX-Mirror/main/v2ex-mirror.user.js
// @downloadURL  https://raw.githubusercontent.com/alvspen/V2EX-Mirror/main/v2ex-mirror.user.js
// ==/UserScript==

(function () {
  "use strict";

  const hostname = location.hostname;

  // 在镜像站或第三方搜索站执行 DOM 替换逻辑
  if (hostname.endsWith(".v2ex.co") || hostname.endsWith(".sov2ex.com")) {
    // 负向后瞻确保只匹配独立的域名边界，避免误伤第三方域名（sov2ex.com）和邮箱地址
    const domainRegexWww = /(?<![a-zA-Z0-9_.@-])www\.v2ex\.com/g;
    const domainRegex = /(?<![a-zA-Z0-9_.@-])v2ex\.com/g;
    const cdnRegex = /cdn\.v2ex\.com/g;
    // static.v2ex.com 节点背景图按主机名整体镜像（路径不定），限定图片扩展名，
    // 兼容 https://、http:// 与协议相对 // 写法
    const staticAssetRegex = /(?:https?:)?\/\/static\.v2ex\.com\/([^\s"'()]*\.(?:png|jpe?g|gif|webp|bmp|svg|ico|avif)(?:\?[^\s"'()]*)?)/gi;

    // 节点处理核心函数
    const processNode = (node) => {
      // 处理元素节点 (替换 href, src, srcset 等属性)
      if (node.nodeType === Node.ELEMENT_NODE) {
        // 替换超链接属性 (包含 <a> 标签和 mailto 等)
        if (node.href) {
          node.href = node.href
            .replace(domainRegexWww, "global.v2ex.co")
            .replace(domainRegex, "global.v2ex.co")
            .replace(cdnRegex, "cdn.v2ex.co");
        }

        // 修复节点头像：<node-sidebar> 把头像渲染在 closed Shadow DOM 中，
        // 但 nodeAvatar 属性在 light DOM 上；在元素被 customElements.define
        // 升级前改写它，构造函数拿到的就是镜像 URL。
        const nodeAvatar = node.getAttribute("nodeAvatar");
        if (nodeAvatar) {
          const newAvatar = nodeAvatar.replace(cdnRegex, "cdn.v2ex.co");
          if (newAvatar !== nodeAvatar) {
            node.setAttribute("nodeAvatar", newAvatar);
          }
        }

        // 替换帖子背景图（内联样式）至 WordPress CDN 镜像 (i3.wp.com)
        if (node.style && node.style.backgroundImage) {
          const bgImage = node.style.backgroundImage;
          const newBgImage = bgImage
            .replace(staticAssetRegex, "https://i3.wp.com/static.v2ex.com/$1")
            .replace(cdnRegex, "cdn.v2ex.co");
          if (newBgImage !== bgImage) {
            node.style.backgroundImage = newBgImage;
          }
        }

        // 处理 <style> 标签内的背景图规则
        if (node.tagName.toLowerCase() === "style") {
          const cssText = node.textContent;
          const newCssText = cssText
            .replace(staticAssetRegex, "https://i3.wp.com/static.v2ex.com/$1")
            .replace(cdnRegex, "cdn.v2ex.co");
          // 必须比较新旧文本：替换后的 url 仍含原子串，若用 includes 判断，
          // 相同值的赋值仍触发 characterData 变更，会与监听器形成无限回环。
          if (newCssText !== cssText) {
            node.textContent = newCssText;
          }
        }

        // 处理图片及媒体资源 (img, source)
        const tagName = node.tagName.toLowerCase();
        if (tagName === "img" || tagName === "source") {
          // 替换 Gravatar 头像及 CDN 资源域名
          if (node.src && node.src.includes("cdn.v2ex.com")) {
            node.src = node.src.replace(cdnRegex, "cdn.v2ex.co");
          }

          // 锚定主机名而非用 includes 判断：镜像后的 URL 参数中仍含 i.imgur.com
          // 子串，否则会重复代理、一层层套前缀，无法保证幂等。
          if (node.src && /^https?:\/\/i\.imgur\.com\//.test(node.src)) {
            node.src =
              "https://down.nigx.cn/search.pstatic.net/common?src=" +
              encodeURIComponent(node.src);
          }

          // 同上：i3.wp.com/i.redd.it/... 仍含 i.redd.it 子串，必须锚定主机名保证幂等
          if (node.src && /^https?:\/\/i\.redd\.it\//.test(node.src)) {
            node.src =
              "https://i3.wp.com/" + node.src.replace(/^https?:\/\//, "");
          }

          // 帖子正文内的 static.v2ex.com 图片（如 logos/github.png）走 WordPress CDN 镜像
          if (
            node.src &&
            /^https?:\/\/static\.v2ex\.com\/[^\s]*\.(?:png|jpe?g|gif|webp|bmp|svg|ico|avif)(?:\?|$)/i.test(
              node.src,
            )
          ) {
            node.src =
              "https://i3.wp.com/" + node.src.replace(/^https?:\/\//, "");
          }

          // 处理响应式图片的 srcset 属性
          if (node.srcset) {
            let newSrcset = node.srcset;
            if (newSrcset.includes("cdn.v2ex.com")) {
              newSrcset = newSrcset.replace(cdnRegex, "cdn.v2ex.co");
            }
            if (newSrcset.includes("i.imgur.com")) {
              newSrcset = newSrcset.replace(
                /(https?:\/\/i\.imgur\.com\/[^\s,]+)/g,
                (match) => {
                  return (
                    "https://down.nigx.cn/search.pstatic.net/common?src=" +
                    encodeURIComponent(match.trim())
                  );
                },
              );
            }
            if (newSrcset.includes("i.redd.it")) {
              newSrcset = newSrcset.replace(
                /https?:\/\/i\.redd\.it\/([^\s,]+)/g,
                "https://i3.wp.com/i.redd.it/$1",
              );
            }
            if (newSrcset.includes("static.v2ex.com")) {
              newSrcset = newSrcset.replace(
                /https?:\/\/static\.v2ex\.com\/([^\s,]*\.(?:png|jpe?g|gif|webp|bmp|svg|ico|avif)(?:\?[^\s,]*)?)/gi,
                "https://i3.wp.com/static.v2ex.com/$1",
              );
            }
            // 比较新旧值再回写：includes 预检无法识别已代理的 URL，避免空写
            if (newSrcset !== node.srcset) {
              node.srcset = newSrcset;
            }
          }

          // 针对 img 标签的防盗链与自动重试机制
          if (tagName === "img") {
            // 移除 Referer 请求头，绕过镜像站和 Gravatar 的防盗链校验
            node.referrerPolicy = "no-referrer";

            // error 事件处理 522 超时、404 等失败；_retryBound 标记防止重复绑定
            if (!node._retryBound) {
              node._retryBound = true;
              node.addEventListener("error", function handleImgError() {
                const retryCount = parseInt(this.dataset.retryCount || "0", 10);
                if (retryCount < 2) {
                  // 最多重试 2 次，避免网络彻底断开时无限循环
                  this.dataset.retryCount = (retryCount + 1).toString();

                  // 清理旧的 retry 参数，再追加时间戳绕过缓存发起全新请求
                  let cleanSrc = this.src.replace(/[?&]retry=\d+/g, "");
                  const separator = cleanSrc.includes("?") ? "&" : "?";
                  this.src = cleanSrc + separator + "retry=" + Date.now();
                }
              });
            }
          }
        }
      }
    };

    // 必须在 document-start 阶段立即挂载监听：帖子背景图写在 body 内的
    // <style> 块里，若替换晚于解析，浏览器会先对 static.v2ex.com 发起请求，
    // 替换文本无法取消已在挂起的连接，网络不通时会一直挂起至超时。
    // MutationObserver 回调是微任务，可在 <style> 插入瞬间完成替换，
    // 让原始请求永远不发出。
    const initReplacement = () => {
      // document-start 时 documentElement 可能尚未创建，直接监听 document
      // 根节点，<html> 插入后即覆盖其后续全部子树变化
      const root = document.documentElement;
      if (root) {
        // 遍历当前已有的所有 DOM 节点
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_ELEMENT,
          null,
        );
        let currentNode;
        while ((currentNode = walker.nextNode())) {
          processNode(currentNode);
        }
      }

      // 监听 DOM 变化，覆盖 AJAX 动态插入的内容（无限滚动加载回复、翻页等）
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const subWalker = document.createTreeWalker(
                node,
                NodeFilter.SHOW_ELEMENT,
                null,
              );
              let subNode;
              processNode(node);
              while ((subNode = subWalker.nextNode())) {
                processNode(subNode);
              }
            }
          });

          // <style> 文本可能随流式解析分块到达，需监听文本变化重新处理
          if (
            mutation.type === "characterData" &&
            mutation.target.parentElement &&
            mutation.target.parentElement.tagName.toLowerCase() === "style"
          ) {
            processNode(mutation.target.parentElement);
          }
        });
      });

      observer.observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };

    initReplacement();
  }
})();
