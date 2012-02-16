/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Network protocol langbits display.  Be aware that not all langbits instances
 *  are displayed inline at their definition point.  Instead, they are displayed
 *  at their usage sites.
 **/

define(
  [
    "wmsy/wmsy",
    "text!./netproto.css",
    "exports"
  ],
  function(
    $wmsy,
    $_css,
    exports
  ) {

var wy = exports.wy = new $wmsy.WmsyDomain({id: "netproto",
                                            domain: "jstut",
                                            css: $_css});

wy.defineWidget({
  name: "netproto",
  doc: "network protocol container",
  constraint: {
    type: "stream",
    obj: { kind: "proto" },
  },
  structure: {
    stream: wy.stream({ type: "stream" }, "docStream"),
  },
});

wy.defineWidget({
  name: "message",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: { kind: "message" },
  },
  structure: {
  },
});

}); // end define
