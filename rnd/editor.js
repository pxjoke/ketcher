/****************************************************************************
 * Copyright (C) 2009-2010 GGA Software Services LLC
 *
 * This file may be distributed and/or modified under the terms of the
 * GNU Affero General Public License version 3 as published by the Free
 * Software Foundation and appearing in the file LICENSE.GPL included in
 * the packaging of this file.
 *
 * This file is provided AS IS with NO WARRANTY OF ANY KIND, INCLUDING THE
 * WARRANTY OF DESIGN, MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
 ***************************************************************************/

if (!window.Prototype)
	throw new Error("Prototype.js should be loaded first");
if (!window.rnd || !rnd.ReStruct)
	throw new Error("rnd.MolData should be defined prior to loading this file");

// TODO re-factoring needed: client_area parameter is excessive, should be available in render
rnd.Editor = function(render)
{
    this.ui = ui; // TODO ui ref should be passed as a parameter
    this.render = render;

    this._selectionHelper = new rnd.Editor.SelectionHelper(this);
};
rnd.Editor.prototype.toolFor = function(tool) {
    if (tool == 'select_simple') {
        return new rnd.Editor.LassoTool(this);
    } else if (tool == 'selector_lasso') {
        return new rnd.Editor.LassoTool(this, 0);
    } else if (tool == 'selector_square') {
        return new rnd.Editor.LassoTool(this, 1);
    } else if (tool == 'select_erase') {
        return new rnd.Editor.EraserTool(this, 1); // TODO last selector mode is better
    }
    return null;
};


rnd.Editor.SelectionHelper = function(editor) {
    this.editor = editor;
};
rnd.Editor.SelectionHelper.prototype.setSelection = function(selection, add) {
    if (!('selection' in this) || !add) {
        this.selection = {};
        for (var map1 in rnd.ReStruct.maps) this.selection[map1] = []; // TODO it should NOT be mandatory
    }
    if (selection && 'id' in selection && 'map' in selection) {
        (selection[selection.map] = selection[selection.map] || []).push(selection.id);
    }
    if (selection) {
        for (var map2 in this.selection) {
            if (map2 in selection) {
                for (var i = 0; i < selection[map2].length; i++) {
                    if (this.selection[map2].indexOf(selection[map2][i]) < 0) {
                        this.selection[map2].push(selection[map2][i]);
                    }
                }
            }
        }
    }
    // "auto-select" the atoms for the bonds in selection
    if (!Object.isUndefined(this.selection.bonds)) {
        this.selection.bonds.each(
            function(bid) {
                var bond = this.editor.render.ctab.molecule.bonds.get(bid);
                selection.atoms = selection.atoms || [];
                if (this.selection.atoms.indexOf(bond.begin) < 0) {
                    this.selection.atoms.push(bond.begin);
                }
                if (this.selection.atoms.indexOf(bond.end) < 0) {
                    this.selection.atoms.push(bond.end);
                }
            },
            this
        );
    }
    // "auto-select" the bonds with both atoms selected
    if ('atoms' in this.selection) {
        this.editor.render.ctab.molecule.bonds.each(
            function(bid) {
                if (!('bonds' in this.selection) || this.selection.bonds.indexOf(bid) < 0) {
                    var bond = this.editor.render.ctab.molecule.bonds.get(bid);
                    if (this.selection.atoms.indexOf(bond.begin) >= 0 && this.selection.atoms.indexOf(bond.end) >= 0) {
                        this.selection.bonds = this.selection.bonds || [];
                        this.selection.bonds.push(bid);
                    }
                }
            },
            this
        );
    }
    this.editor.render.setSelection(this.selection);
    this.editor.render.update();

    ui.updateSelection(this.selection, true); // TODO to be removed (used temporary until no new Undo/Redo tools implemented)
    ui.updateClipboardButtons(); // TODO notify ui about selection
};
rnd.Editor.SelectionHelper.prototype.isSelected = function(item) {
    return 'selection' in this
        && !Object.isUndefined(this.selection[item.map])
        && this.selection[item.map].indexOf(item.id) > -1;
};


rnd.Editor.EditorTool = function(editor) {
    this.editor = editor;
};
rnd.Editor.EditorTool.prototype.processEvent = function(name, event) {
    if (!('touches' in event) || event.touches.length == 1) {
        if (name + '0' in this) return this[name + '0'](event); else if (name in this) return this[name](event);
        console.log('EditorTool.dispatchEvent: event \'' + name + '\' is not handled.');
    } else if ('lastEvent' in this.OnMouseDown0) {
        // here we finish previous MouseDown and MouseMoves with simulated MouseUp
        // before gesture (canvas zoom, scroll, rotate) started
        if (this.OnMouseUp0(event)) {
            delete this.OnMouseDown0.lastEvent;
            return true;
        }
    }
};
rnd.Editor.EditorTool.prototype.OnMouseOver = function() {};
rnd.Editor.EditorTool.prototype.OnMouseDown = function() {};
rnd.Editor.EditorTool.prototype.OnMouseMove = function() {};
rnd.Editor.EditorTool.prototype.OnMouseUp = function() {};
rnd.Editor.EditorTool.prototype.OnClick = function() {};
rnd.Editor.EditorTool.prototype.OnDblClick = function() {};
rnd.Editor.EditorTool.prototype.OnMouseOut = function() {};
rnd.Editor.EditorTool.prototype.OnKeyPress = function() {};
rnd.Editor.EditorTool.prototype.OnMouseDown0 = function(event) {
    this.OnMouseDown0.lastEvent = event;

    if ('OnMouseDown' in this) return this.OnMouseDown(event);
};
rnd.Editor.EditorTool.prototype.OnMouseMove0 = function(event) {
    this.OnMouseMove0.lastEvent = event;

    if ('OnMouseMove' in this) return this.OnMouseMove(event);
};
rnd.Editor.EditorTool.prototype.OnMouseUp0 = function(event) {
    // here we surpress event we got when second touch released in guesture
    if (!('lastEvent' in this.OnMouseDown0)) return true;

    if ('lastEvent' in this.OnMouseMove0) {
        // this data is missing for 'touchend' event when last finger is out
        event.pageX = this.OnMouseMove0.lastEvent.pageX;
        event.pageY = this.OnMouseMove0.lastEvent.pageY;
    }

    if ('OnMouseUp' in this) return this.OnMouseUp(event);
};
rnd.Editor.EditorTool.prototype.OnKeyPress0 = function(event) {
    if (!event.ctrlKey && !event.altKey && ('lastEvent' in this.OnMouseMove0)) {
        var ci = this.editor.render.findItem(this.OnMouseMove0.lastEvent);
        if (ci) {
            var labels = {
                Br : 66, Cl : 67, A: 97, C: 99, F : 102, H : 104, I : 105, N : 110, O : 111, P : 112, S : 115
            };
            for (var label in labels) {
                if (labels[label] == (Prototype.Browser.IE ? event.keyCode : event.which)) {
                    ci.label = { label : label };
                    if (ci.map == 'atoms') {
                        this.editor.ui.addUndoAction(ui.Action.fromAtomAttrs(ci.id, ci.label));
                    } else if (ci.id == -1) {
                        this.editor.ui.addUndoAction(
                            this.editor.ui.Action.fromAtomAddition(
                                this.editor.ui.page2obj(this.OnMouseMove0.lastEvent),
                                ci.label
                            )
                        );
                    }
                    this.editor.ui.render.update();
                    return true;
                }
            }
        }
    }
    if ('OnKeyPress' in this) return this.OnKeyPress(event);
};


rnd.Editor.EditorTool.HoverHelper = function(editorTool) {
    this.editorTool = editorTool;
};
rnd.Editor.EditorTool.HoverHelper.prototype.hover = function(ci) {
    // TODO add custom highlight style parameter, to be used when fusing atoms, sgroup children highlighting, etc
    if ('ci' in this && (!ci || this.ci.type != ci.type || this.ci.id != ci.id)) {
        this.editorTool.editor.render.highlightObject(this.ci, false);
        delete this.ci;
    }
    if (ci && this.editorTool.editor.render.highlightObject(ci, true)) {
        this.ci = ci;
    }
};


rnd.Editor.LassoTool = function(editor, mode) {
    this.editor = editor;

    this._hoverHelper = new rnd.Editor.EditorTool.HoverHelper(this);
    this._lassoHelper = new rnd.Editor.LassoTool.LassoHelper(mode || 0, editor);
};
rnd.Editor.LassoTool.prototype = new rnd.Editor.EditorTool();
rnd.Editor.LassoTool.prototype.OnMouseDown = function(event) {
    this.editor.ui.hideBlurredControls(); // TODO probably it's better to implement it in base class
    this._hoverHelper.hover(null); // TODO review hovering for touch devices
    var ci = this.editor.render.findItem(event);
    if (!ci || ci.type == 'Canvas') {
        this._lassoHelper.begin(event);
    } else if (['atoms', 'bonds', 'sgroups', 'rxnArrows', 'rxnPluses'].indexOf(ci.map) > -1) {
        this._hoverHelper.hover(null);
        if (!this.editor._selectionHelper.isSelected(ci)) {
            this.editor._selectionHelper.setSelection(ci, event.shiftKey);
        }
        this.dragCtx = {
            item : ci,
            xy0 : this.editor.ui.page2obj(event),
            action : this.editor.ui.Action.fromSelectedAtomsPos(this.editor._selectionHelper.selection)
        };
        if (ci.map == 'atoms') {
            var self = this;
            this.dragCtx.timeout = setTimeout(
                function() {
                    delete self.dragCtx;
                    self.editor._selectionHelper.setSelection(null);
                    self.editor.ui.showLabelEditor(ci.id);
                },
                750
            );
            this.dragCtx.stopTapping = function() {
                if ('timeout' in self.dragCtx) {
                    clearTimeout(self.dragCtx.timeout);
                    delete self.dragCtx.timeout;
                }
            }
        }
    }
    return true;
};
rnd.Editor.LassoTool.prototype.OnMouseMove = function(event) {
    if ('dragCtx' in this) {
        if ('stopTapping' in this.dragCtx) this.dragCtx.stopTapping();
        // moving selected objects
        this.editor.render._multipleMoveRel(
            this.editor._selectionHelper.selection,
            this.editor.ui.page2obj(event).sub(this.dragCtx.xy0)
        );
        // finding & highlighting object to stick to
        if (['atoms'/*, 'bonds'*/].indexOf(this.dragCtx.item.map) >= 0) {
            // TODO add bond-to-bond fusing
            var ci = this.editor.render.findItem(event, [this.dragCtx.item.map], this.dragCtx.item);
            this._hoverHelper.hover(ci.map == this.dragCtx.item.map ? ci : null);
        }
        this.editor.render.update();

        this.dragCtx.xy0 = this.editor.ui.page2obj(event);
    } else if (this._lassoHelper.running()) {
        //ui.updateSelection(this._lassoHelper.addPoint(event));
        this.editor._selectionHelper.setSelection(this._lassoHelper.addPoint(event), event.shiftKey);
    } else {
        this._hoverHelper.hover(this.editor.render.findItem(event));
    }
    return true;
};
rnd.Editor.LassoTool.prototype.OnMouseUp = function(event) {
    if ('dragCtx' in this) {
        if ('stopTapping' in this.dragCtx) this.dragCtx.stopTapping();
        if (['atoms'/*, 'bonds'*/].indexOf(this.dragCtx.item.map) >= 0) {
            // TODO add bond-to-bond fusing
            var ci = this.editor.render.findItem(event, [this.dragCtx.item.map], this.dragCtx.item);
            if (ci.map == this.dragCtx.item.map) {
                this._hoverHelper.hover(null);
                this.dragCtx.action = this.editor.ui.Action.fromAtomMerge(this.dragCtx.item.id, ci.id)
                    .mergeWith(this.dragCtx.action);
            }
        }
        this.editor.ui.addUndoAction(this.dragCtx.action, true);
        this.editor.render.update();
        delete this.dragCtx;
    } else {
        if (this._lassoHelper.running()) { // TODO it catches more events than needed, to be re-factored
            this.editor._selectionHelper.setSelection(this._lassoHelper.end(event), event.shiftKey);
        }
    }
    return true;
};
rnd.Editor.LassoTool.prototype.OnDblClick = function(event) {
    var ci = this.editor.render.findItem(event);
    if (ci.map == 'atoms') {
        this.editor.ui.showAtomProperties(ci.id);
    } else if (ci.map == 'bonds') {
        this.editor.ui.showBondProperties(ci.id);
    } else if (ci.map == 'sgroups') {
        this.editor.ui.showSGroupProperties(ci.id);
    }
    return true;
};


rnd.Editor.LassoTool.LassoHelper = function(mode, editor) {
    this.mode = mode;
    this.editor = editor;
};
rnd.Editor.LassoTool.LassoHelper.prototype.getSelection = function() {
    if (this.mode == 0) {
        return this.editor.ui.render.getElementsInPolygon(this.points);
    } else if (this.mode == 1) {
        return this.editor.ui.render.getElementsInRectangle(this.points[0], this.points[1]);
    }
};
rnd.Editor.LassoTool.LassoHelper.prototype.begin = function(event) {
    this.points = [ this.editor.ui.page2obj(event) ];
    if (this.mode == 1) {
        this.points.push(this.points[0]);
    }
};
rnd.Editor.LassoTool.LassoHelper.prototype.running = function() {
    return 'points' in this;
};
rnd.Editor.LassoTool.LassoHelper.prototype.addPoint = function(event) {
    if (!this.running()) return false;
    if (this.mode == 0) {
        this.points.push(this.editor.ui.page2obj(event));
        this.editor.render.drawSelectionPolygon(this.points);
    } else if (this.mode == 1) {
        this.points = [ this.points[0], this.editor.ui.page2obj(event) ];
        this.editor.render.drawSelectionRectangle(this.points[0], this.points[1]);
    }
    return this.getSelection();
};
rnd.Editor.LassoTool.LassoHelper.prototype.end = function() {
    var ret = this.getSelection();
    if ('points' in this) {
        this.editor.render.drawSelectionPolygon(null);
        delete this.points;
    }
    return ret;
};


rnd.Editor.EraserTool = function(editor, mode) {
    this.editor = editor;

    this._hoverHelper = new rnd.Editor.EditorTool.HoverHelper(this);
    this._lassoHelper = new rnd.Editor.LassoTool.LassoHelper(mode || 0, editor);
};
rnd.Editor.EraserTool.prototype = new rnd.Editor.EditorTool();
rnd.Editor.EraserTool.prototype.OnMouseDown = function(event) {
    this.editor.ui.hideBlurredControls(); // TODO probably it's better to implement it in base class
    var ci = this.editor.render.findItem(event);
    if (!ci || ci.type == 'Canvas') {
        this._lassoHelper.begin(event);
    }
};
rnd.Editor.EraserTool.prototype.OnMouseMove = function(event) {
    if (this._lassoHelper.running()) {
        this.editor._selectionHelper.setSelection(
            this._lassoHelper.addPoint(event)
            // TODO add "no-auto-atoms-selection" option (see selection left on canvas after erasing)
        );
    } else {
        this._hoverHelper.hover(this.editor.render.findItem(event));
    }
};
rnd.Editor.EraserTool.prototype.OnMouseUp = function(event) {
    if (this._lassoHelper.running()) { // TODO it catches more events than needed, to be re-factored
        this.editor.ui.addUndoAction(this.editor.ui.Action.fromFragmentDeletion(this._lassoHelper.end(event)));
        for (var map1 in rnd.ReStruct.maps) ui.selection[map1] = []; // TODO to be deleted when ui.selection eliminated
        this.editor.ui.render.update();
        this.editor.ui.updateClipboardButtons(); // TODO review
    } else {
        var ci = this.editor.render.findItem(event);
        if (ci && ci.type != 'Canvas') {
            this._hoverHelper.hover(null);
            if (ci.map == 'atoms') {
                this.editor.ui.addUndoAction(this.editor.ui.Action.fromAtomDeletion(ci.id));
            } else if (ci.map == 'bonds') {
                this.editor.ui.addUndoAction(this.editor.ui.Action.fromBondDeletion(ci.id));
            } else if (ci.map == 'sgroups') {
                this.editor.ui.highlightSGroup(ci.id, false); // TODO
                this.editor.ui.addUndoAction(this.editor.ui.Action.fromSgroupDeletion(ci.id));
            } else if (ci.map == 'rxnArrows') {
                this.editor.ui.addUndoAction(this.editor.ui.Action.fromArrowDeletion(ci.id));
            } else if (ci.map == 'rxnPluses') {
                this.editor.ui.addUndoAction(this.editor.ui.Action.fromPlusDeletion(ci.id));
            } else {
                // TODO re-factoring needed - should be "map-independent"
                console.log('EraserTool: unable to delete the object ' + ci.map + '[' + ci.id + ']');
                return;
            }
            for (var map2 in rnd.ReStruct.maps) ui.selection[map2] = []; // TODO to be deleted when ui.selection eliminated
            this.editor.ui.render.update();
            this.editor.ui.updateClipboardButtons(); // TODO review
            this.editor.ui.render.setSelection()
        }
    }
};


