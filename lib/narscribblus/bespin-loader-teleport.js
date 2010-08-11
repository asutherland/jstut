var self = require("self");

exports.loadBespin = function loadBespin(doc, callback) {
  var win = doc.defaultView;
  win.onBespinLoad = callback;

  var head = doc.getElementsByTagName('head')[0];
  var link = doc.createElement('link');
  link.setAttribute("id", "bespin_base", "system");
  link.setAttribute("href", self.data.url("bespin/"));
  head.appendChild(link);

  var script = doc.createElement("script");
  script.src = self.data.url("bespin/BespinEmbedded.js");
  head.appendChild(script);
};
