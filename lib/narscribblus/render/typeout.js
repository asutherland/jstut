/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at:
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Messaging Code.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/**
 * Htmlification logic for typerep.
 **/

require.def("narscribblus/render/typeout",
  [
    "exports",
    "narscribblus/render/html",
  ],
  function(
    exports,
    html
  ) {

/**
 * @protocol[OutputtableType]
 *
 *
 */
var OutputtableType = {
  /**
   * Indicates whether the type is anonymous and must therefore be recursively
   *  expanded (true), or can just be hyperlinked.
   */
  isAnonymous: null,
  /**
   * Indicates whether the type is sufficiently simple that it makes sense to
   *  expand it inline rather than require the user to take some action to
   *  see it in its (short) entirety.
   */
  isSimple: null,

  /**
   * Provide a snippet of HTML for use where you only want the type name without
   *  a discourse on the type.
   *
   * @args[
   *   @param[options]
   *   @param[expandedNearby Boolean]{
   *     Will the type be expanded in its entirety somewhere close by?  This
   *     affects whether we emit a global link or a local scrolling link.
   *   }
   * ]
   * @return[String]
   */
  citeTypeHTML: function(options, expandedNearby) {
  },

  /**
   * Provide a snippet of HTML that briefly describes the type.  Examples:
   * @itemize[
   *   @item{
   *     A function would include the function signature with all arguments
   *     named and their type names cited, but no expansions of the type or
   *     descriptions of the purposes of the arguments unless they are
   *     anonymous.
   *    }
   *   @item{
   *     A heterogeneous dictionary object would name the list of keys and cite
   *     their types (potentially still clustering by groups) but not expand
   *     the types or their descriptions.
   *   }
   * ]
   * @return[String]
   */
  briefTypeExpansionHTML: function(options) {
  },

  /**
   * Provides a detailed HTML expansion of the type.  Non-anonymous, non-simple
   *  sub-types should be at most briefly described, anonymous or simple types
   *  should be expanded.
   *
   * Examples of what this might entail:
   * @itemize[
   *   @item{
   *     A function would provide description of its arguments and return value.
   *     The only difference for expanded/unexpanded sub-types is whether we
   *     invoke detailedTypeExpansionHTML and create a div for it or not.
   *   }
   *   @item{
   *     A heterogeneous dictionary object would expand the list of keys,
   *     grouping as appropriate, in a similar fashion to the function case.
   *   }
   * ]
   */
  detailedTypeExpansionHTML: function(options) {
  },

  /**
   * HTML description of the type;
   *
   * @return[String]
   */
  descriptionHTML: function(options) {
  },
};



exports.descriptorMixin = {
  citeTypeHTML: function(options) {
    return "<span class='" + this.nameKind + "'>" +
      htmlEscapeText(this.name) + "</span>";
  },

  briefTypeExpansionHTML: function(options) {
    return "<span class='" + this.nameKind + "'>" +
      htmlEscapeText(this.name) + "</span>: " +
      this.type.citeTypeHTML(options);
  },

  // detailed is from the perspective of our parent, not our child type.
  detailedTypeExpansionHTML: function(options) {
    return "<div class='attrName'>" + this.name + "</div>" +
      "<div class='typeBrief'>" + this.type.briefTypeExpansionHTML(options) +
          "</div>" +
      "<div class='typeDetail'>" + this.type.detailedTypeExpansionHTML(options)+
          "</div>" +
      "<div class='attrDesc'>" + htmlStreamify(this.textStream, options) +
          "</div>";
  },
  toHTMLString: function(options) {
    return html.htmlStreamify(this.docStream, options);
  },
};


exports.typeMixin = function() {
};

/**
 * Outputty stuff for OneOf.
 */
exports.oneOfMixin = {
  citeTypeHTML: function(options, expandedNearby) {
    return "(union)";
  },
  briefTypeExpansionHTML: function(options) {
    var s = "";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      if (i)
        s += " | ";
      s += kids[i].citeTypeHTML(options);
    }
    return s;
  },
  detailedTypeExpansionHTML: function(options) {
    var bits = [], kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      // We only care about kids wrapped in some form of description.
      if (!(kid instanceof Case) && !(kid instanceof DefaultCase))
        continue;
      var desc = kid.descriptionHTML(options);
      bits.push(
        "<div class='attrName'>" + kid.name + "</div>" +
        "<div class='typeBrief'>" + kid.briefTypeExpansionHTML(options) +
          "</div>" +
        "<div class='typeDetail'>" + kid.detailedTypeExpansionHTML(options) +
          "</div>" +
        (desc ? ("<div class='attrDesc'>" + desc + "</div>") : "")
      );
    }
    return bits.join("");
  },
  toHTMLString: function(options) {
    var s = "<dl class='oneof'>\n";
    for (var i = 0; i < this.kids; i++) {
      var kid = this.kids[i];
      if (kid instanceof Case || kid instanceof DefaultCase)
        s += kid.toHTMLString(options);
      else
        s += "<dt>" + coerceString(kid) + "</dt>\n";
    }
    s += "</dl>";
    return s;
  },
};

exports.dictMixin = {
  /**
   * Our terse description has to just be a generic object with stuff in it; the
   *  good news is we can at least hyperlink down to ourselves probably.
   */
  citeTypeHTML: function(options, expandedNearby) {
    return "<span class='dict'>{...}</span>";
  },

  briefTypeExpansionHTML: function(options) {
    var s = "{";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      if (i)
        s += ", ";
      s += kids[i].citeTypeHTML(options);
    }
    return s + "}";
  },

  detailedTypeExpansionHTML: function(options) {
    var s = "";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      s += kids[i].detailedTypeExpansionHTML(options);
    }
    return s;
  },

  descriptionHTML: function(options) {
    // the description should be on the typedef or param, not us.
    return null;
  },

  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

exports.groupMixin = {
  citeTypeHTML: function(options) {
    var s = "<div class='citeGroup'>" +
      "<span class='citeGroupName'>" + htmlEscapeText(this.groupName) +
      "</span>: ";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      if (i)
        s += ", ";
      var kid = this.kids[i];
      s += kid.citeTypeHTML(options);
    }
    return s + "</div>";
  },
  briefTypeExpansionHTML: function(options) {
    var s = "<div class='briefGroup'>" +
      "<span class='briefGroupName'>" + htmlEscapeText(this.groupName) +
      "</span>: ";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      if (i)
        s += ", ";
      var kid = this.kids[i];
      s += kid.briefTypeExpansionHTML(options);
    }
    return s + "</div>";
  },
  detailedTypeExpansionHTML: function(options) {
    var s = "<div class='group'>\n" +
      "  <div class='groupName'>" + this.groupName + "</div>\n" +
      (this.desc ?
       ("<div class='groupDesc'>"+ this.desc.toHTMLString(options) + "</div>") :
       "") +
      "  <div class='groupContents'>\n";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      s += kids[i].detailedTypeExpansionHTML(options);
    }
    s +=  "  </div>\n" +
      "</div>\n";
    return s;
  },
};

exports.dictOfMixin = {
  citeTypeHTML: function(options, expandedNearby) {
    return "{" + this.key.citeTypeHTML(options) + ": " +
      this.value.citeTypeHTML(options) + "*}";
  },
  briefTypeExpansionHTML: function(options) {
    return "{" + this.key.briefTypeExpansionHTML(options) + ": " +
      this.value.briefTypeExpansionHTML(options) + "*}";
  },
  detailedTypeExpansionHTML: function(options) {
    // break out the key and the value specifically...
    return this.key.detailedTypeExpansionHTML(options) +
      this.value.detailedTypeExpansionHTML(options);
  },
  descriptionHTML: function(options) {
    // we shouldn't have anything interesting to say; we should be owned by a
    //  typedef or param that should have the interesting comments.
    return null;
  },
  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

exports.listMixin = {
  /**
   * Our terse description has to just be a generic object with stuff in it; the
   *  good news is we can at least hyperlink down to ourselves probably.
   */
  citeTypeHTML: function(options, expandedNearby) {
    return "<span class='list'>[...]</span>";
  },

  briefTypeExpansionHTML: function(options) {
    var s = "<div class='typeBrief'>[";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      s += kids[i].briefTypeExpansionHTML(options);
    }
    return s + "]</div>\n";
  },

  detailedTypeExpansionHTML: function(options) {
    var s = "";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      s += kids[i].detailedTypeExpansionHTML(options);
    }
    return s;
  },

  descriptionHTML: function(options) {
    return null;
  },

  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

exports.listOfMixin = {
  citeTypeHTML: function(options, expandedNearby) {
    return "[" + htmlEscapeText(this.name) + " : " +
      this.type.citeTypeHTML(options) + "...]";
  },
  briefTypeExpansionHTML: function(options) {
    return "[" + htmlEscapeText(this.name) + " : " +
      this.type.briefTypeExpansionHTML(options) + "...]";
  },
  detailedTypeExpansionHTML: function(options) {
    var s = "<div class='attrName'>" + htmlEscapeText(this.name) + "</div>\n" +
      "<div class='typeBrief'>" + this.type.briefTypeExpansionHTML(options) +
      "</div>\n" +
      "<div class='typeDetail'>" + this.type.detailedTypeExpansionHTML(options)+
      "</div>\n";
  },
  descriptionHTML: function(options) {
    return null;
  },
  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

/**
 * Perform simple copying of the mixin's contents when they do not already exist
 *  in the target.
 *
 * @args[
 *   @param[mixin]{
 *     The mixin; it should contain only simple attributes and no getters /
 *     setters.
 *   }
 *   @param[targetPrototype] {
 *     The target prototype.  All existing attributes will be left intact.
 *   }
 * ]
 */
exports.mix = function(mixin, targetPrototype) {
  for (var key in mixin) {
    if (!(key in targetPrototype))
      targetPrototype[key] = mixin[key];
  }
};

}); // end require.def
