#!/usr/bin/python

from __future__ import print_function

try:
    import SocketServer
except ImportError:
    import socketserver as SocketServer
try:
    import SimpleHTTPServer
except ImportError:
    import http.server as SimpleHTTPServer
import webbrowser
import json
import os
import os.path

PAPERS = "data/v2_papers"
    
class PaperHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/list_papers":
            ret = []
            for year in os.listdir(PAPERS):
                for name in os.listdir(os.path.join(PAPERS, year)):
                    ret.append(os.path.join(PAPERS, year, name))
            data = json.dumps(ret)
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data.encode('utf8', 'surrogateescape'))
        else:
            SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)

    def do_PUT(self):
        if not self.path.startswith('/'+PAPERS) or '..' in self.path or not self.path.endswith('.json'):
            send_error(403, "can only upload papers")
        length = int(self.headers['Content-Length'])
        if not os.path.isdir(os.path.dirname(self.path[1:])):
            os.mkdir(os.path.dirname(self.path[1:]))
        with open(self.path[1:], 'wb') as f:
            f.write(self.rfile.read(length))
            f.write(b'\n')
        self.send_response(200)
        self.end_headers()

httpd = SocketServer.TCPServer(("127.0.0.1", 0), PaperHandler)

print("serving at port", httpd.server_address)
webbrowser.open("http://{}:{}/editor/".format(*httpd.server_address))
httpd.serve_forever()
