/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const {Cc,Ci,Cr} = require("chrome");

var xpcom = require("xpcom");

function AboutProtocol(name, beSystem, bounceUrl) {
  memory.track(this);

  var self = this;
  var contractID = "@mozilla.org/network/protocol/about;1?what=" + name;
  var ios = Cc["@mozilla.org/network/io-service;1"]
            .getService(Ci.nsIIOService);

  try {
    xpcom.getClass(contractID);
    throw new Error("protocol already registered: " + name);
  } catch (e if e.result == Cr.NS_ERROR_FACTORY_NOT_REGISTERED) {}

  self.unload = function unload() {
    handler.unregister();
    handler = null;
  };

  var principal;
  if (beSystem) {
    principal = Cc["@mozilla.org/systemprincipal;1"]
                  .createInstance(Ci.nsIPrincipal);
  }
  else {
    var secman = Cc["@mozilla.org/scriptsecuritymanager;1"]
                   .getService(Ci.nsIScriptSecurityManager);
    principal = secman.getCodebasePrincipal(ios.newURI(bounceUrl, null, null));
  }
  
  function AboutProtocolHandler() {
    memory.track(this);
    this.wrappedJSObject = this;
  }

  AboutProtocolHandler.prototype = {
    getURIFlags: function(URI) {
      return Ci.nsIAboutModule.ALLOW_SCRIPT |
             Ci.nsIAboutModule.HIDE_FROM_ABOUTABOUT;
    },
    
    newChannel: function newChannel(URI) {
      var channel = ios.newChannelFromURI(ios.newURI(bounceUrl, null, null));

      channel.originalURI = URI;
      channel.owner = principal;
      return channel;
    },
    QueryInterface: xpcom.utils.generateQI([Ci.nsISupports,
                                            Ci.nsISupportsWeakReference,
                                            Ci.nsIAboutModule]),
    jid: packaging.jetpackID,
  };

  var handler = xpcom.register({name: "about:" + name,
                                contractID: contractID,
                                create: AboutProtocolHandler});

  require("unload").ensure(this);
};

exports.register = function register(name, beSystem, bounceUrl, optArgs) {
  return new AboutProtocol(name, beSystem, bounceUrl);
};
