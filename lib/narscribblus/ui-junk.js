/**
 * Common UI logic that makes me feel dirty.  The competing pressures are to be
 *  standalone, but not be ugly, but not invent a new framework either.  We're
 *  currently really pushing the 'not be ugly' boundary.
 **/

var self = require("self");

/**
 * A simple helper to size and position a popup near a triggering element and
 *  make sure that only one popup is active at a time.
 */
function PopupManager() {
  this.padding = 60;
}
PopupManager.prototype = {
  getCss: function() {
    return self.data.load("css/popup.css");
  },
  popupHTML: function(relNode, htmlString) {
    var doc = relNode.ownerDocument;
    var docElem = doc.documentElement;

    var popupElem = doc.getElementById("thepopup");
    if (!popupElem) {
      popupElem = doc.createElement("div");
      popupElem.setAttribute("id", "thepopup");
      popupElem.innerHTML = htmlString;
      docElem.appendChild(popupElem);
    }
    else {
      popupElem.innerHTML = htmlString;
    }

    var neededSpace = popupElem.clientHeight;

    // figure out where to position... (above or below the thing)...
    var bounds = relNode.getBoundingClientRect();
    var topSpace = bounds.top,
        bottomSpace = docElem.clientHeight - bounds.bottom;

    console.log("popup space, top", topSpace, "bottom", bottomSpace);
    if (topSpace > bottomSpace) {
      var bottom = docElem.scrollTop + bounds.top - this.padding;
      popupElem.setAttribute("style",
                             "bottom: " + bottom + "px;");
    }
    else {
      var top = docElem.scrollTop + bounds.bottom + this.padding;
      popupElem.setAttribute("style",
                             "top: " + top + "px;");
    }
  },
};
exports.PopupManager = PopupManager;
