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

/**
 * These icon paths are from the RaphaelJS icon set under the MIT license
 *  which can be found at: http://raphaeljs.com/icons/
 */
const ICONPATH_MAN = 'M21.021,16.349c-0.611-1.104-1.359-1.998-2.109-2.623c-0.875,0.641-1.941,1.031-3.103,1.031c-1.164,0-2.231-0.391-3.105-1.031c-0.75,0.625-1.498,1.519-2.111,2.623c-1.422,2.563-1.578,5.192-0.35,5.874c0.55,0.307,1.127,0.078,1.723-0.496c-0.105,0.582-0.166,1.213-0.166,1.873c0,2.932,1.139,5.307,2.543,5.307c0.846,0,1.265-0.865,1.466-2.189c0.201,1.324,0.62,2.189,1.463,2.189c1.406,0,2.545-2.375,2.545-5.307c0-0.66-0.061-1.291-0.168-1.873c0.598,0.574,1.174,0.803,1.725,0.496C22.602,21.541,22.443,18.912,21.021,16.349zM15.808,13.757c2.362,0,4.278-1.916,4.278-4.279s-1.916-4.279-4.278-4.279c-2.363,0-4.28,1.916-4.28,4.279S13.445,13.757,15.808,13.757z',
  ICONPATH_PEOPLE = 'M21.066,20.667c1.227-0.682,1.068-3.311-0.354-5.874c-0.611-1.104-1.359-1.998-2.109-2.623c-0.875,0.641-1.941,1.031-3.102,1.031c-1.164,0-2.231-0.391-3.104-1.031c-0.75,0.625-1.498,1.519-2.111,2.623c-1.422,2.563-1.578,5.192-0.35,5.874c0.549,0.312,1.127,0.078,1.723-0.496c-0.105,0.582-0.166,1.213-0.166,1.873c0,2.938,1.139,5.312,2.543,5.312c0.846,0,1.265-0.865,1.466-2.188c0.2,1.314,0.62,2.188,1.461,2.188c1.396,0,2.545-2.375,2.545-5.312c0-0.66-0.062-1.291-0.168-1.873C19.939,20.745,20.516,20.983,21.066,20.667zM15.5,12.201c2.361,0,4.277-1.916,4.277-4.279S17.861,3.644,15.5,3.644c-2.363,0-4.28,1.916-4.28,4.279S13.137,12.201,15.5,12.201zM24.094,14.914c1.938,0,3.512-1.573,3.512-3.513c0-1.939-1.573-3.513-3.512-3.513c-1.94,0-3.513,1.573-3.513,3.513C20.581,13.341,22.153,14.914,24.094,14.914zM28.374,17.043c-0.502-0.907-1.116-1.641-1.732-2.154c-0.718,0.526-1.594,0.846-2.546,0.846c-0.756,0-1.459-0.207-2.076-0.55c0.496,1.093,0.803,2.2,0.861,3.19c0.093,1.516-0.381,2.641-1.329,3.165c-0.204,0.117-0.426,0.183-0.653,0.224c-0.056,0.392-0.095,0.801-0.095,1.231c0,2.412,0.935,4.361,2.088,4.361c0.694,0,1.039-0.71,1.204-1.796c0.163,1.079,0.508,1.796,1.199,1.796c1.146,0,2.09-1.95,2.09-4.361c0-0.542-0.052-1.06-0.139-1.538c0.492,0.472,0.966,0.667,1.418,0.407C29.671,21.305,29.541,19.146,28.374,17.043zM6.906,14.914c1.939,0,3.512-1.573,3.512-3.513c0-1.939-1.573-3.513-3.512-3.513c-1.94,0-3.514,1.573-3.514,3.513C3.392,13.341,4.966,14.914,6.906,14.914zM9.441,21.536c-1.593-0.885-1.739-3.524-0.457-6.354c-0.619,0.346-1.322,0.553-2.078,0.553c-0.956,0-1.832-0.321-2.549-0.846c-0.616,0.513-1.229,1.247-1.733,2.154c-1.167,2.104-1.295,4.262-0.287,4.821c0.451,0.257,0.925,0.064,1.414-0.407c-0.086,0.479-0.136,0.996-0.136,1.538c0,2.412,0.935,4.361,2.088,4.361c0.694,0,1.039-0.71,1.204-1.796c0.165,1.079,0.509,1.796,1.201,1.796c1.146,0,2.089-1.95,2.089-4.361c0-0.432-0.04-0.841-0.097-1.233C9.874,21.721,9.651,21.656,9.441,21.536z',
  ICONPATH_PC = 'M29.249,3.14h-9.188l-0.459,0.459v18.225l0.33,2.389H19.57v0.245h-0.307v-0.306h-0.611v0.244h-0.311v-0.367h-0.486v0.307h-1.104l-2.022-0.367v-0.92h0.858l0.302-1.47h2.728c0.188,0,0.339-0.152,0.339-0.339V7.828c0-0.187-0.149-0.338-0.339-0.338H1.591c-0.187,0-0.339,0.152-0.339,0.338V21.24c0,0.187,0.152,0.339,0.339,0.339h3.016l0.199,1.47h1.409l-3.4,3.4L2.11,27.951c0,0,2.941,1.102,6.678,1.102c3.737,0,9.679-0.857,10.476-0.857s4.84,0,4.84,0v-1.225l-0.137-1.068h1.744c-0.2,0.106-0.322,0.244-0.322,0.396v0.979c0,0.341,0.604,0.613,1.352,0.613c0.742,0,1.348-0.272,1.348-0.613v-0.979c0-0.339-0.604-0.611-1.348-0.611c-0.188,0-0.364,0.019-0.525,0.049v-0.17h-2.29l-0.055-0.432h5.382L29.249,3.14L29.249,3.14zM2.478,20.17V8.714h15.07V20.17H2.478z',
  // This is currently hail; I wanted to chop off bits of it to make it a cloud,
  //  but that is ever so hard.
  ICONPATH_CLOUD = 'M25.372,6.912c-0.093-3.925-3.302-7.078-7.248-7.08c-2.638,0.002-4.942,1.412-6.208,3.518c-0.595-0.327-1.28-0.518-2.01-0.518C7.627,2.834,5.773,4.639,5.69,6.898c-2.393,0.786-4.125,3.025-4.127,5.686c0,3.312,2.687,6,6,6v-0.002h15.875c3.312,0,6-2.688,6-6C29.434,9.944,27.732,7.715,25.372,6.912zM23.436,16.584H7.562c-2.209-0.006-3.997-1.793-4.001-4c-0.002-1.983,1.45-3.619,3.35-3.933c0.265-0.043,0.502-0.19,0.657-0.414C7.723,8.015,7.78,7.74,7.731,7.475C7.703,7.326,7.686,7.187,7.686,7.051c0.004-1.225,0.995-2.217,2.22-2.219c0.647,0,1.217,0.278,1.633,0.731c0.233,0.257,0.587,0.375,0.927,0.31c0.342-0.066,0.626-0.308,0.748-0.631c0.749-1.992,2.662-3.412,4.911-3.41c2.898,0.004,5.244,2.351,5.251,5.25c0,0.16-0.009,0.325-0.026,0.496c-0.05,0.518,0.305,0.984,0.814,1.079c1.859,0.345,3.273,1.966,3.271,3.923C27.43,14.791,25.645,16.578,23.436,16.584zM11.503,23.709c-0.784-0.002-1.418-0.636-1.418-1.416c0-0.785,0.634-1.416,1.418-1.418c0.78,0.002,1.413,0.633,1.416,1.418C12.917,23.073,12.284,23.707,11.503,23.709zM19.002,23.709c-0.783-0.002-1.418-0.636-1.418-1.416c0-0.785,0.635-1.416,1.418-1.418c0.779,0.002,1.414,0.633,1.414,1.418C20.417,23.073,19.784,23.707,19.002,23.709zM7.503,28.771c-0.783-0.002-1.417-0.637-1.417-1.418s0.634-1.414,1.417-1.416c0.78,0.002,1.415,0.635,1.415,1.416C8.917,28.135,8.284,28.77,7.503,28.771zM15.001,28.771c-0.782-0.002-1.417-0.637-1.417-1.418s0.634-1.414,1.417-1.416c0.78,0.002,1.413,0.635,1.415,1.416C16.415,28.135,15.784,28.77,15.001,28.771zM22.5,28.771c-0.782-0.002-1.416-0.634-1.416-1.416c0-0.785,0.634-1.418,1.416-1.42c0.781,0.002,1.414,0.635,1.418,1.42C23.915,28.138,23.282,28.77,22.5,28.771z',
  ICONMAP = {
    person: ICONPATH_MAN,
    people: ICONPATH_PEOPLE,
    pc: ICONPATH_PC,
    cloud: ICONPATH_CLOUD,
  };

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an SVG icon of the requested type with the requested dimensions and
 *  color.
 */
function makeIconElem(doc, iconName, color, width, height) {
  var svgNode = doc.createElementNS(SVG_NS, 'svg'),
      pathNode = doc.createElementNS(SVG_NS, 'path');

  svgNode.setAttribute('width', width);
  svgNode.setAttribute('height', height);
  svgNode.setAttribute('version', 1.1);
  pathNode.setAttribute('d', ICONMAP[iconName]);
  pathNode.setAttribute('fill', color);
  pathNode.setAttribute('transform',
                        'scale(' + (Math.min(width, height) / 32) + ')');

  svgNode.appendChild(pathNode);
  return svgNode;
}

wy.defineWidget({
  name: "netproto",
  doc: "network protocol container",
  constraint: {
    type: "stream",
    obj: { kind: "proto" },
  },
  focus: wy.focus.container.vertical("stream"),
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
  focus: wy.focus.container.vertical("fields"),
  structure: {
    fields: wy.vertList({type: "descriptor", detail: "expandable"},
                        wy.dictAsList("childrenByName")),
  },
});

wy.defineWidget({
  name: "action",
  constraint: {
    type: "stream",
    obj: { kind: "proto-action" },
  },
  focus: wy.focus.container.vertical("steps"),
  structure: {
    name: wy.bind("name"),
    steps: wy.vertList({ type: "proto-action-step" }, "steps"),
  },
});


wy.defineWidget({
  name: "participants",
  doc: "holds/displays the (ordered) list of participants",
  constraint: {
    type: "stream",
    obj: { kind: "proto-participants" },
  },
  focus: wy.focus.container.vertical("participants"),
  structure: {
    participants: wy.vertList({ type: "proto-actor-def" }, "participants"),
  },
});


wy.defineWidget({
  name: "actor-def",
  constraint: {
    type: "proto-actor-def",
  },
  focus: wy.focus.item,
  structure: {
    header: {
      icon: {},
      label: wy.bind("name"),
    },
    description: wy.stream({ type: "steam" }, "docStream"),
  },
  impl: {
    postInitUpdate: function() {
      var actor = this.obj;
      this.icon_element.appendChild(
        makeIconElem(this.domNode.ownerDocument,
                     actor.icon, '#333', 32, 32));
    },
  },
});

wy.defineWidget({
  name: "actor-usage",
  constraint: {
    type: "proto-actor",
  },
  structure: {
    icon: {},
    label: wy.bind("name"),
  },
  impl: {
    postInitUpdate: function() {
      var actor = this.obj;
      this.icon_element.appendChild(
        makeIconElem(this.domNode.ownerDocument,
                     actor.icon, '#333', 32, 32));
    },
  },
});

wy.defineWidget({
  name: "proto-message",
  constraint: {
    type: "proto-message",
  },
  structure: {
    name: wy.bind("name"),
  },
});

wy.defineWidget({
  name: "proto-action-send",
  doc: "message sending action step",
  constraint: {
    type: "proto-action-step",
    obj: { kind: "proto-action-send" },
  },
  focus: wy.focus.nestedItem.vertical("expanded"),
  structure: {
    header: {
      sender: wy.widget({ type: "proto-actor" }, "sender"),
      arrowShaft: "───",
      message: wy.widget({ type: "proto-message" }, "message"),
      arrowHeader: "──⟶",
      recipient: wy.widget({ type: "proto-actor" }, "recipient"),
    },
    expanded: wy.widget({ type: "type", detail: "expanded"}, wy.NONE),
  },
  impl: {
    postInit: function() {
      this.isExpanded = false;
    },
    toggle:function() {
      this.isExpanded = !this.isExpanded;
      this.expanded_set(this.isExpanded ? this.obj.message : null);
      this.FOCUS.bindingResized(this);
    },
  },
  events: {
    root: {
      enter_key: function() {
        this.toggle();
      },
    },
    header: {
      click: function() {
        this.toggle();
      },
    }
  },
});


}); // end define
