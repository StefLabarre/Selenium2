/*
 Copyright 2011 WebDriver committers
 Copyright 2011 Google Inc.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

goog.provide('SyntheticMouse');

goog.require('Utils');
goog.require('bot.ErrorCode');
goog.require('bot.Mouse');
goog.require('bot.action');
goog.require('bot.dom');
goog.require('bot.events');
goog.require('fxdriver.moz');
goog.require('fxdriver.utils');
goog.require('fxdriver.Logger');


var CC = Components.classes;
var CI = Components.interfaces;


SyntheticMouse = function() {
  this.wrappedJSObject = this;

  this.QueryInterface = fxdriver.moz.queryInterface(this,
      [CI.nsISupports, CI.wdIMouse]);

  // Declare the state we'll be using
  this.buttonDown = null;
  this.lastElement = null;
}


SyntheticMouse.newResponse = function(status, message) {
  return {
    status: status,
    message: message,
    QueryInterface: function(iid) {
      if (iid.equals(Components.interfaces.wdIStatus) ||
          iid.equals(Components.interfaces.nsISupports))
        return this;
      throw Components.results.NS_NOINTERFACE;
    }
  };
};


SyntheticMouse.prototype.isElementShown = function(element) {
  if (!bot.dom.isShown(element, /*ignoreOpacity=*/true)) {
    return SyntheticMouse.newResponse(bot.ErrorCode.ELEMENT_NOT_VISIBLE,
        'Element is not currently visible and so may not be interacted with')
  }
};


SyntheticMouse.prototype.getElement_ = function(coords) {
  return coords.auxiliary ?
      fxdriver.moz.unwrap(coords.auxiliary) : this.lastElement;
};

// wdIMouse

SyntheticMouse.prototype.move = function(target, xOffset, yOffset) {
  // TODO(simon): find the current "body" element iff element == null
  var element = target ? 
      fxdriver.moz.unwrap(target) : this.lastElement;

   if (goog.isFunction(element.scrollIntoView)) {
     element.scrollIntoView();
  }

  // The following code assumes xOffset, yOffset are absolute in the DOM.
  // If the page was scrolled, the scroll offset should be subtracted
  // from the provided offset since the movement events are generated
  // relative to the viewport.
  var doc = goog.dom.getOwnerDocument(element);
  var currentScroll = goog.dom.getDomHelper(doc).getDocumentScroll();
  xOffset -= currentScroll.x;
  yOffset -= currentScroll.y;

  // If the mouse was already moved within this document, assume the last
  // coordinates of the mouse are the location of lastElement.
  // This only makes sense, of course, if the last element and the current
  // element belong to the same document.
  if (this.lastElement && element && this.lastElement != element &&
      (this.lastElement.ownerDocument == element.ownerDocument)) {
    var currLoc = Utils.getElementLocation(this.lastElement);
    var targetLoc = Utils.getElementLocation(element);
    xOffset += targetLoc['x'] - currLoc['x'];
    yOffset += targetLoc['y'] - currLoc['y'];
  }

  this.lastElement = element;
  var pos = Utils.getElementLocation(element);
  var owner = goog.dom.getOwnerDocument(element);
  var win = goog.dom.getWindow(owner);
  bot.setWindow(win);

  // Are we about to be dragged out of the window?
  var helper = new goog.dom.DomHelper(owner);

  var viewportSize = goog.dom.getViewportSize(win);
  var docHeight = helper.getDocumentHeight();
  var docWidth = owner.body.offsetWidth;

  var maxHeight = docHeight < viewportSize.height ? viewportSize.height : docHeight;
  var maxWidth = docWidth < viewportSize.width ? viewportSize.width : docWidth;

  var targetX = pos.x + xOffset;
  var targetY = pos.y + yOffset;

  if (targetX > maxWidth || targetY > maxHeight) {
    return SyntheticMouse.newResponse(bot.ErrorCode.MOVE_TARGET_OUT_OF_BOUNDS,
        'Requested location (' + targetX + ', ' + targetY +
        ') is outside the bounds of the document (' + maxWidth + ', ' + maxHeight + ')');
  }

  // Which element shall we pretend to be leaving?
  var parent = bot.dom.getParentElement(element);

  // TODO(simon): if no offset is specified, use the centre of the element    
  var fireAndCheck = function(e, eventName, opt_coordinates) {
    if (!e) {
      return false;
    }
    bot.events.fire(e, eventName, opt_coordinates);
    return true;
  };

  var button = this.buttonDown;
  var botCoords = {
    'clientX': pos.x,
    'clientY': pos.y,
    'button': button,
    'related': parent
  };

  var intermediateSteps = 3;
  var xInc = Math.floor(xOffset / intermediateSteps);
  var yInc = Math.floor(yOffset / intermediateSteps);
  var currX = pos.x;
  var currY = pos.y;

  var proceed = fireAndCheck(parent, goog.events.EventType.MOUSEOUT, {'related': element}) &&
      fireAndCheck(element, goog.events.EventType.MOUSEOVER, botCoords);
    for (var i = 0; i < intermediateSteps && proceed; i++) {
      botCoords['clientX'] = xInc + currX;  currX += xInc;
      botCoords['clientY'] = yInc + currY;  currY += yInc;
      proceed = fireAndCheck(element, goog.events.EventType.MOUSEMOVE, botCoords);
  }

  botCoords['clientX'] = (pos.x + xOffset);
  botCoords['clientY'] = (pos.y + yOffset);

  proceed = fireAndCheck(element, goog.events.EventType.MOUSEMOVE, botCoords);

  var newPos = Utils.getElementLocation(this.lastElement);
  var xDifference = Math.abs(botCoords['clientX'] - newPos.x);
  var yDifference = Math.abs(botCoords['clientY'] - newPos.y);
  // Allow a 3-pixel deviation, since synthetic events are not as accurate
  // as native ones.
//  if (((origXOffset != 0) || (origYOffset != 0)) &&
//      ((xDifference > 3) || (yDifference > 3))) {
//    return SyntheticMouse.newResponse(bot.ErrorCode.MOVE_TARGET_OUT_OF_BOUNDS,
//        'Move could not be performed as far as requested: (' + newPos.x + ' ' +
//        newPos.y + ') targeted  (' + botCoords['clientX'] + ' ' + botCoords['clientY'] + ')');
//  }

  if (!proceed || !bot.dom.isShown(element, /*ignoreOpacity=*/true)) {
    return SyntheticMouse.newResponse(bot.ErrorCode.SUCCESS, "ok");
  }

  bot.events.fire(element, goog.events.EventType.MOUSEOVER, botCoords);

  return SyntheticMouse.newResponse(bot.ErrorCode.SUCCESS, "ok");
};


SyntheticMouse.prototype.click = function(target) {

  // No need to unwrap the target. All information is provided by the wrapped
  // version, and unwrapping does not work for all firefox versions.
  var element = target ? target : this.lastElement;

  var error = this.isElementShown(element);
  if (error) {
    return error;
  }

  // Check to see if this is an option element. If it is, and the parent isn't a multiple
  // select, then click on the select first.
  var tagName = element.tagName.toLowerCase();
  if ("option" == tagName) {
    var parent = element;
    while (parent.parentNode != null && parent.tagName.toLowerCase() != "select") {
      parent = parent.parentNode;
    }

    if (parent && parent.tagName.toLowerCase() == "select" && !parent.multiple) {
      bot.action.click(parent);
    }
  }

  fxdriver.Logger.dumpn("About to do a bot.action.click on " + element);
  bot.action.click(element);

  return SyntheticMouse.newResponse(bot.ErrorCode.SUCCESS, "ok");
};

SyntheticMouse.prototype.contextClick = function(target) {

  // No need to unwrap the target. All information is provided by the wrapped
  // version, and unwrapping does not work for all firefox versions.
  var element = target ? target : this.lastElement;

  var error = this.isElementShown(element);
  if (error) {
    return error;
  }

  fxdriver.Logger.dumpn("About to do a bot.action.rightClick on " + element);
  bot.action.rightClick(element);

  return SyntheticMouse.newResponse(bot.ErrorCode.SUCCESS, "ok");
};

SyntheticMouse.prototype.doubleClick = function(target) {
  var element = target ? target : this.lastElement;

  var error = this.isElementShown(element);
  if (error) {
    return error;
  }

  fxdriver.Logger.dumpn("About to do a bot.action.doubleClick on " + element);
  bot.action.doubleClick(element);

  return SyntheticMouse.newResponse(bot.ErrorCode.SUCCESS, "ok");
};


SyntheticMouse.prototype.down = function(coordinates) {
  var element = this.getElement_(coordinates);

  var pos = goog.style.getClientPosition(element);

  // TODO(simon): This implementation isn't good enough. Again
  // Defaults to left mouse button, which is right.
  this.buttonDown = bot.Mouse.Button.LEFT;
  var botCoords = {
    'clientX': coordinates['x'] + pos.x,
    'clientY': coordinates['y'] + pos.y,
    'button': bot.Mouse.Button.LEFT
  };
  bot.events.fire(element, goog.events.EventType.MOUSEDOWN, botCoords);

  return SyntheticMouse.newResponse(bot.ErrorCode.SUCCESS, "ok");
};


SyntheticMouse.prototype.up = function(coordinates) {
  var element = this.getElement_(coordinates);

  var pos = goog.style.getClientPosition(element);

  // TODO(simon): This implementation isn't good enough. Again
  // Defaults to left mouse button, which is the correct one.
  var button = this.buttonDown;
  var botCoords = {
    'clientX': coordinates['x'] + pos.x,
    'clientY': coordinates['y'] + pos.y,
    'button': button
  };
  bot.events.fire(element, goog.events.EventType.MOUSEMOVE, botCoords);
  bot.events.fire(element, goog.events.EventType.MOUSEUP, botCoords);

  this.buttonDown = null;

  return SyntheticMouse.newResponse(bot.ErrorCode.SUCCESS, "ok");
};


// And finally, registering
SyntheticMouse.prototype.classDescription = "Pure JS implementation of a mouse";
SyntheticMouse.prototype.contractID = '@googlecode.com/webdriver/syntheticmouse;1';
SyntheticMouse.prototype.classID = Components.ID('{E8F9FEFE-C513-4097-98BE-BE00A41D3645}');

/** @const */ var components = [SyntheticMouse];
var NSGetFactory, NSGetModule;

fxdriver.moz.load('resource://gre/modules/XPCOMUtils.jsm');

if (XPCOMUtils.generateNSGetFactory) {
  NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
} else {
  NSGetModule = XPCOMUtils.generateNSGetModule(components);
}

goog.exportSymbol('SyntheticMouse', SyntheticMouse);
goog.exportSymbol('SyntheticMouse.prototype.down', SyntheticMouse.prototype.down);
goog.exportSymbol('SyntheticMouse.prototype.up', SyntheticMouse.prototype.up);

goog.exportSymbol('SyntheticMouse.prototype.move', SyntheticMouse.prototype.move);

goog.exportSymbol('SyntheticMouse.prototype.click', SyntheticMouse.prototype.click);
goog.exportSymbol('SyntheticMouse.prototype.doubleClick', SyntheticMouse.prototype.doubleClick);
goog.exportSymbol('SyntheticMouse.prototype.contextClick', SyntheticMouse.prototype.contextClick);
