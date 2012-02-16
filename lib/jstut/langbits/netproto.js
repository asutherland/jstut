/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Network protocol documentation / definition support.
 **/

define(
  [
    'jstut/readers/scribble-syntax',
    'jstut/typerep',
    'jstut/typeref',
    'jstut/langbits/jsdoc',
    'exports'
  ],
  function(
    $syn,
    $typerep,
    $typeref,
    $jsdoc,
    exports
  ) {

var Identifier = syn.Identifier, Keyword = syn.Keyword;
var coerceString = syn.coerceString;

function NetworkProtocol(lifestory) {
  this._name = null;
  this.actions = [];
  this.participants = {};

  /**
   * All of our message types end up in here.
   */
  this.typeNamespace = new $typerep.Namespace(this._name, lifestory);

  this.docStream = null;
}
NetworkProtocol.prototype = {
  kind: 'proto',

  get name() {
    return this._name;
  },
  set name(name) {
    this._name = name;
    this.namespace.name = name;
  },
};

/**
 * A singular entity that participants in network protocols.
 */
function Actor(name, role) {
  this.name = name;
  this.role = role;
}
Actor.prototype = {
};

/**
 * A named group of of `Actor`s
 */
function ActorGroup(name, members) {
  this.name = name;
  this.members = members;
}
ActorGroup.prototype = {
};

function MessageDef() {
  this.name = null;
  this.sender = null;
  this.recipient = null;
  this.parentType = null;
  this.encryptedType = null;

  this.childrenByName = {};
  this.childCount = 0;
}
MessageDef.prototype = {
  kind: 'message',
  isType: true,
  traverseChild: $typerep.commonTraverseChild,

  isAnonymous: false,
  isSimple: false,

  hasGroups: false,
};

/**
 * The meta-type for an asymmetric encryption key.
 */
function AsymCryptoKey(name) {
}
AsymCryptoKey.prototype = {
};

/**
 * The meta-type for a crypto signing key.
 */
function SigningKey(name) {
}
SigningKey.prototype = {
};

/**
 * A shallow named type that exists just to say that we encrypted our payload
 *  type with the sender's private key (using its meta type) intended for some
 *  recipient's public key (using its meta type).
 */
function AsymEncryptedType(name, payloadType) {
  this.name = name;
  this.senderKey = null;
  this.recipientKey = null;
  this.payloadType = payloadType;
}
AsymEncryptedType.prototype = {
  kind: 'encrypted',
};

function ProtocolAction(name, steps, docStream) {
  this.name = name;
  this.steps = [];
  this.docStream = docStream;
}
ProtocolAction.prototype = {
  kind: 'proto-action',
};

/**
 * A "send message" step in a `ProtocolAction`.  The assumption is that the
 *  message transmission substrate operates successfully and the recipient
 *  receives the message immediately.
 */
function ActionStepSend(sender, recipient, message, docStream) {
  this.sender = sender;
  this.recipient = recipient;
  this.message = message;

  this.docStream = docStream;
}
ActionStepSend.prototype = {
  kind: 'proto-action-send',
};

////////////////////////////////////////////////////////////////////////////////
// Lookup Helper Functions
//
// These all assume that all types are fully available to us.  Contrast with
//  our jsdoc implementation which creates type references that are not
//  resolved until the processing phase on an on-demand basis.

/**
 * Lookup a type by name as provided by the current document or any
 *  of the documents it requires.
 */
function lookupType(ctx, nameSval, checkClass) {
  var name = coerceString(nameSval),
      type = ctx.options.docInfo.resolveType(name);
  if (!type)
    throw new Error("Unable to find message type: " + name);
  if (checkClass && !(type instanceof checkClass))
    throw new Error("Not of the right type (" + checkClass + "): " + name);
  return type;
}

function defineType(ctx, type) {
  ctx.options.docInfo.exportNS.childrenByName[type.name] = type;
}

////////////////////////////////////////////////////////////////////////////////

exports.jstutPreExecFuncs = {
  /**
   * The over-arching container for a network protocol.  The idea is that
   *  this wraps a giant text-stream and that we use named contexts to
   *  gather all our constituent definitions that don't need a strict
   *  organizational structure.
   */
  netProtocol: function(tagName, ctx, index) {
    var lifestory = new $typerep.LifeStory(ctx.options.moduleInfo, -index);
    var netproto = new NetworkProtocol(lifestory);
    ctx.pushNamedContext('netproto-info', {});
    ctx.pushNamedContext('netproto-actions', netproto.actions);
    ctx.pushNamedContext('lexicalTypeScope', netproto);
    return netproto;
  },

  /**
   * A dictionary data-type (although we could support strict marshaled things
   *  in a non-JS world) that has associated sender/receiver semantics.
   */
  message: function(tagName, ctx) {
    var msg = new MessageDef();

    ctx.pushNamedContext("dict-all", msg.childrenByName);
    // throw this away, we don't care about grouping.
    ctx.pushNamedContext("dict-group", {});
    ctx.pushNamedContext("lexicalTypeScope", dict);
  },
  /**
   * Define a message whose encryption scheme is related to its contents.  A
   *  message that just gets sent over the transport layer (encrypted or not)
   *  without anything extra should just be a `message`.
   *
   * Two typed byproducts are produced for an input name of "Foo".  We create
   *  the message type "Foo" and the encrypted "BoxedFoo" type.
   */
  boxedMessage: function(tagName, ctx) {
    return this.message(tagName, ctx);
  },
};

exports.jstutExecFuncs = {
  /**
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  realm: function(tagName, svals, tvals, ctx) {
  },
  /**
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  trustLevel: function(tagName, svals, tvals, ctx) {
  },
  /**
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  role: function(tagName, svals, tvals, ctx) {
  },

  /**
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  netProtocol: function(tagName, svals, tvals, ctx, netproto) {
    netproto.name = coerceString(svals[0]);
    netproto.docStream = ctx.formatTextStream(tvals);

    var netProtoInfo = ctx.popNamedContext('netproto-info');

    ctx.popNamedContext('netproto-actions');
    ctx.popNamedContext('lexicalTypeScope');
  },

  //////////////////////////////////////////////////////////////////////////////
  // Participants

  /**
   * Define all the actors participating in the protocol and their roles.
   *
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  protoParticipants: function(tagName, svals, tvals, ctx) {

    ctx.namedContextAdd('netproto-info', participantInfo, 'participants');
  },
  /**
   * Define a singular actor with the given name whose type is role.
   *
   * @args[
   *   @param[svals @list[
   *     @param[name]
   *     @param[role]
   *   ]]
   * ]
   */
  actor: function(tagName, svals, tvals, ctx) {
  },
  /**
   * Define a named group of actors plus a singular actor that belongs to the
   *  group and serves as an exemplar.  We create the plural by appending "s"
   *  to the name; extend this to allow custom plurals if you need it.
   *
   * I'm not sure what to do if more than one exemplar is required; should we
   *  fabricate numbered actors on demand?  Ex: Contestant#1 Contestant#2.
   *
   * @args[
   *   @param[svals @list[
   *     @param[singularName]
   *     @param[role]
   *   ]]
   * ]
   */
  pluralActor: function(tagName, svals, tvals, ctx) {
    var singularName = coerceString(svals[0]),
        pluralName = singularName + "s",
        role = lookupType(ctx, svals[1], Role),
        actor = new Actor(singularName, role),
        group = new ActorGroup(pluralName, [actor]);
  },
  /**
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  actorGroup: function(tagName, svals, tvals, ctx) {
  },

  //////////////////////////////////////////////////////////////////////////////
  // Actions

  /**
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  protoAction: function(tagName, svals, tvals, ctx) {
    var name = coerceString(svals[0]), idx = 1,
        steps = svals.slice(idx);

    var action = new ProtocolAction(name, steps, ctx.formatTextStream(tvals));
    ctx.namedContextAdd('netproto-actions', action);
    return action;
  },
  /**
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  send: function(tagName, svals, tvals, ctx) {
    var idx = 0, sender, recipient, message;
    while (oneOfKeywords(svals[idx], 'sender', 'recipient', 'message')) {
      var keyword = svals[idx++].keyword;
      switch (keyword) {
        case 'sender':
          sender = lookupType(ctx, svals[idx++], Actor);
          break;
        case 'recipient':
          recipient = lookupType(ctx, svals[idx++], Actor);
          break;
        case 'message':
          message = lookupType(ctx, svals[idx++], MessageDef);
          break;
      }
    }

    if (!sender || !recipient || !message)
      throw new Exception("sender, recipient, and message all required!");

    var step = new ActionStepSend(sender, recipient, message,
                                  ctx.formatTextStream(tvals));
    return step;
  },

  /**
   * @args[
   *   @param[svals @list[
   *     @param["sender" #:optional]
   *     @param["senderKey" #:optional]
   *     @param["recipient" #:optional]
   *     @param["recipientKey" #:optional]
   *     @param["extends" #:optional]
   *   ]]
   * ]
   */
  boxedMessage: function(tagName, svals, tvals, ctx, msg) {
    var boxedType = null;
    msg.name = coerceString(svals[0]);
    // (we could also be the 'message' reuse case
    if (tagName === 'boxedMessage') {
      boxedType = new AsymEncryptedType('Boxed' + msg.name, msg);
      msg.encryptedType = boxedType;
      defineType(ctx, boxedType);
    }

    var idx = 1;
    while (oneOfKeywords(svals[idx], 'sender', 'senderKey',
                         'recipient', 'recipientKey', 'extends')) {
      var keyword = svals[idx++].keyword;
      switch (keyword) {
        case 'sender':
          msg.sender = lookupType(ctx, svals[idx++], Actor);
          break;
        case 'recipient':
          msg.recipient = lookupType(ctx, svals[idx++], Actor);
          break;
        case 'senderKey':
          if (!boxedType)
            throw new Error('Only valid for boxed messages');
          boxedType.senderKey = lookupType(ctx, svals[idx++], AsymCryptoKey);
          break;

        case 'recipientKey':
          if (!boxedType)
            throw new Error('Only valid for boxed messages');
          boxedType.recipientKey = lookupType(ctx, svals[idx++], AsymCryptoKey);
          break;


        case 'extends':
          msg.parentType = lookupType(ctx, svals[idx++], MessageDef);
          // - copy-down any unspecified attributes
          if (!msg.sender && msg.parentType.sender)
            msg.sender = msg.parentType.sender;
          if (!msg.recipient && msg.parentType.recipient)
            msg.recipient = msg.parentType.recipient;
          if (boxedType && !boxedType.senderKey &&
              msg.parentType.encryptedType &&
              msg.parentType.encryptedType.senderKey)
            boxedType.senderKey = msg.parentType.encryptedType.senderKey;
          if (boxedType && !boxedType.recipientKey &&
              msg.parentType.encryptedType &&
              msg.parentType.encryptedType.recipientKey)
            boxedType.recipientKey = msg.parentType.encryptedType.recipientKey;

          // XXX merge copy/down parent type dict entries. (this would be easier
          //  if we didn't use the named context magic for collection.)
          break;
      }
    }

    var key;
    for (key in dict.childrenByName) dict.childCount++;

    ctx.popNamedContext('dict-all');
    ctx.popNamedContext('groups-container');
    ctx.popNamedContext('dict-group');
    ctx.popNamedContext('lexicalTypeScope');

    defineType(msg);
    return msg;
  },

  /**
   * Define an asymmetric encryption key type with three variations.  For the
   *  name "Foo", we create:
   * - A meta-type "Foo" that describes the semantics of the key and any
   *    meta-data such as a color to use when conveying use of the key to
   *    encrypt messsages, etc.
   * - A type "FooPriv" for places where the private key with these semantics is
   *    used in data structures.
   * - A type "FooPub" for places where the public key with these semantics is
   *    used in data structures.
   *
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  boxingKey: function(tagName, svals, tvals, ctx) {
    var name = coerceString(svals[0]);
    var keyMetaType = new AsymCryptoKey(name);

    var pubType = new $typerep.Typedef(name + "Pub",
                                       new $typeref.TypeRef('String', ctx.pkg),
                                       [keyMetaType, ' public key']),
        privType = new $typerep.Typedef(name + "Priv",
                                        new $typeref.TypeRef('String', ctx.pkg),
                                        [keyMetaType, ' private key']);
    defineType(ctx, keyMetaType);
    defineType(ctx, pubType);
    defineType(ctx, privType);
  },
  /**
   * Define an asymmetric signing key type with there variations.  For the
   *  name "Foo" we create:
   * - A meta-type "Foo" that describes the semantics of the key and any
   *    meta-data such as a color to use when conveying use of the key to
   *    sign messsages, etc.
   * - A type "FooPriv" for places where the private key with these semantics is
   *    used in data structures.
   * - A type "FooPub" for places where the public key with these semantics is
   *    used in data structures.
   *
   * The actual type for the keys are assumed to be strings for now.  If key
   *  handles/identifiers come into the picture for private types, we may need
   *  to allow that to be specified as a parameter.
   *
   * @args[
   *   @param[svals @list[
   *   ]]
   * ]
   */
  signingKey: function(tagName, svals, tvals, ctx) {
    var name = coerceString(svals[0]);
    var keyMetaType = new SigningKey(name);

    var pubType = new $typerep.Typedef(name + "Pub",
                                       new $typeref.TypeRef('String', ctx.pkg),
                                       [keyMetaType, ' public key']),
        privType = new $typerep.Typedef(name + "Priv",
                                        new $typeref.TypeRef('String', ctx.pkg),
                                        [keyMetaType, ' private key']);
    defineType(ctx, keyMetaType);
    defineType(ctx, pubType);
    defineType(ctx, privType);
  },

};
exports.jstutExecFuncs.message = exports.jstutExecFuncs.boxedMessage;

}); // end define
