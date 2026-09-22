#!/usr/bin/env python3
"""本地开发服务器：禁用浏览器缓存，避免旧模块缓存导致游戏加载失败。

端口优先取环境变量 PORT（云平台会注入），本地直接跑则默认 8123。
"""
import http.server
import os


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 云平台要把静态站放进 iframe 预览，这里顺带放开
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8123))
    http.server.ThreadingHTTPServer(('0.0.0.0', port), NoCacheHandler).serve_forever()
