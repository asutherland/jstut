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
  this.padding = 40;
  this.lastRelNode = null;
}
PopupManager.prototype = {
  getCss: function() {
    return self.data.load("css/popup.css");
  },
  hidePopup: function(relNode) {
    var doc = relNode.ownerDocument;
    var popupElem = doc.getElementById("thepopup");
    popupElem.parentNode.removeChild(popupElem);
    var connectorElem = doc.getElementById("thepopupconnector");
    connectorElem.parentNode.removeChild(connectorElem);

    this.lastRelNode = null;
  },
  popupHTML: function(relNode, htmlString) {
    var doc = relNode.ownerDocument;
    var docElem = doc.documentElement;
    var bodyElem = docElem.getElementsByTagName("body")[0];

    if (this.lastRelNode) {
      // XXX this obviously is assuming we can clobber "class".  which we can,
      //  but it would be even better not to do this.  sadly, we are faced with
      //  buggy webkit behavior again on other attributes and classList not
      //  being universally available.
      this.lastRelNode.removeAttribute("class");
      if (this.lastRelNode === relNode) {
        this.hidePopup(relNode);
        return;
      }
    }

    this.lastRelNode = relNode;
    relNode.setAttribute("class", "popupsource");

    var popupElem = doc.getElementById("thepopup"), connectorElem;
    if (!popupElem) {
      popupElem = doc.createElement("div");
      popupElem.setAttribute("id", "thepopup");
      popupElem.innerHTML = htmlString;
      bodyElem.appendChild(popupElem);

      connectorElem = doc.createElement("div");
      connectorElem.setAttribute("id", "thepopupconnector");
      bodyElem.appendChild(connectorElem);
    }
    else {
      popupElem.innerHTML = htmlString;
      connectorElem = doc.getElementById("thepopupconnector");
    }

    var neededSpace = popupElem.clientHeight;

    // figure out where to position... (above or below the thing)...
    var bounds = relNode.getBoundingClientRect();
    var topSpace = bounds.top,
        bottomSpace = docElem.clientHeight - bounds.bottom;

    // the connector is centered on the highlighted token.
    var connLeft = (bounds.right - bounds.left) / 2 + bounds.left;
    // the popup wants to be left-aligned with the token unless the popup would
    //  then be off the right side of the screen, in which case we want to
    //  slide it left until it's okay
    var popLeft;
    if (bounds.left + popupElem.clientWidth > bodyElem.clientWidth)
      popLeft = bodyElem.clientWidth - popupElem.clientWidth - 10;
    else
      popLeft = bounds.left;

    var scrollTop = Math.max(docElem.scrollTop, bodyElem.scrollTop);

    var top;
    console.log("top", topSpace, "bottom", bottomSpace);
    if (topSpace > bottomSpace) {
      top = scrollTop + bounds.top - this.padding -
                 popupElem.clientHeight - 1;
      popupElem.setAttribute("style",
        "top: " + top + "px;" +
        "left: " + popLeft + "px;");

      connectorElem.setAttribute("style",
        "left: " + connLeft + "px; " +
        "top: " + (scrollTop + bounds.top - this.padding) + "px;" +
        "height: " + this.padding + "px;"
      );
    }
    else {
      top = scrollTop + bounds.bottom + this.padding;
      popupElem.setAttribute("style",
        "top: " + top + "px;" +
        "left: " + popLeft + "px;"
      );
      connectorElem.setAttribute("style",
        "left: " + connLeft + "px; " +
        "top: " + (scrollTop + bounds.bottom) + "px;" +
        "height: " + this.padding + "px;"
      );
    }
  },
};
exports.PopupManager = PopupManager;
