#!/usr/bin/env python3
"""本地开发服务器：禁用浏览器缓存，避免旧模块缓存导致游戏加载失败。"""
import http.server


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('0.0.0.0', 8123), NoCacheHandler).serve_forever()
