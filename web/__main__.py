"""
A super simple web server; taken from d3
https://github.com/mbostock/d3/
"""

import os
import tornado.httpserver
import tornado.ioloop
import tornado.options
import tornado.web

tornado.options.define("port", default=8765, type=int)

if __name__ == "__main__":
  tornado.options.parse_command_line()
  application = tornado.web.Application([], **{
    "static_path": ".",
    "static_url_prefix": "/"
  })
  http_server = tornado.httpserver.HTTPServer(application)
  http_server.listen(tornado.options.options.port)
  print "http://0.0.0.0:%d/examples/index.html" % tornado.options.options.port
  tornado.ioloop.IOLoop.instance().start()
