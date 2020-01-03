'use strict';

class DBModel {
    constructor(dbname, lcm) {
        this.lastDoubleClick = Date.now();
        this.nea = nac ;
        this.lcm = lcm;
        this.dbname = dbname;
        this.walkerContext = document.getElementById("walkerContext_" + this.dbname);
    }
    async init() {
        let prms;
        if (this.nea) {
            // init walker labels
            prms = await this._initModel();
            //this._redrawWalkerViz();
        } else {
            console.log("WARNING no neoAccessor available");
        }
        return prms;
    }

    __getSession() {
        if (this.nea) {
            return this.nea.getReadSession(this.dbname);
        } else {
            console.log("WARNING no neoAccessor available");
        }
    }

    showWalkerHelp() {
        $('#simpleModal')
            .modal('destroy')
        ;
        document.getElementById("modalHeader").innerHTML = "Help";
        let lContent = "<div class=\"ui three column divided left aligned grid\">\n" +
            "                <div class=\"column\">Select one or more Labels via Labels Button on the top left to start exploring the Model</div>\n" +
            "                <div class=\"column\">Right Click on a Selected Node to Show/Clear Relationship Types or Clear Labels</div>\n" +
            "                <div class=\"column\">Double click on a Node to get all the Relationship Types</div>\n" +
            "            </div>\n"
        document.getElementById("modalContent").innerHTML = lContent;
        $('#simpleModal').modal({
            inverted: true
        })
            .modal('show')
        ;
    }


    _updateWalkerSelectedLabels(aLabel, added, refresh) {
        // console.log("_updateWalkerSelectedLabels(aLabel, added, refresh): " + aLabel + ", " + added + ", " + refresh);
        if (added) {
            if (!this.walkerSelectedLabels.includes(aLabel)) {
                this.walkerSelectedLabels.push(aLabel);
            }
        } else {
            if (this.walkerSelectedLabels.includes(aLabel)) {
                this.walkerSelectedLabels = this.walkerSelectedLabels.filter( function (el) { return el != aLabel});
            }
        }
        if (refresh) {
            this._createWalkerCheckTable();
        }
    }

    async _selectAllLabels() {
        let session = this.__getSession();
        this.walkerSelectedLabels = [];
        this.walkerLabels = await this.nea.getLabels(session);
        this.walkerLabels.sort();
        this._createWalkerCheckTable("label", true);
        let elements = document.getElementsByName("cblabel_walker_" + this.dbname);
        for (let i=0 ; i < elements.length; i++) {
            this.handleWalkerChange(elements[i]);
        }
        session.close();
    }

    async _selectAllRelTypes() {
        let session = this.__getSession();
        this.walkerSelectedRels = [];
        this.walkerRels = await this.nea.getRelationshipTypes(session);
        this.walkerRels.sort();
        this._createWalkerCheckTable("rel", true);
        let elements = document.getElementsByName("cbrel_walker_" + this.dbname);
        for (let i=0 ; i < elements.length; i++) {
            this.handleWalkerChange(elements[i]);
        }
        session.close();
    }

    async _initModel () {
        let session = this.__getSession();
        //console.log("_initModel " );
        //
        // we have here the init situation so labels and relationships lists must be initialized
        //

        // label list
        this.walkerSelectedLabels = [];
        this.walkerLabels = await this.nea.getLabels(session);
        this.walkerLabels.sort();
        this.walkerSelectedRels = [];
        this.walkerRels = await this.nea.getRelationshipTypes(session);
        this.walkerRels.sort();
        this._createWalkerCheckTable("label", false);
        this._createWalkerCheckTable("rel", false);
        //
        //
        //
        session.close();

    }

    _deselectAllFilter(type) {
        //console.log("_deselectAllFilter " + type);
        let elements = document.getElementsByName("cb" + type + "_walker_" + this.dbname);
        for (let i=0 ; i < elements.length; i++) {
            elements[i].checked = false;
            this.handleWalkerChange(elements[i]);
        }
    }


    _createWalkerCheckTable(aType, checked) {
        let isCheckAll = false;
        let clearAll = true;
        if (aType) clearAll = false;
        if (checked) isCheckAll = checked;

        //console.log("_createWalkerCheckTable aType " + aType + " checked " + checked + " clearAll " + clearAll + " isCheckAll " + isCheckAll);


        let listType = aType;
        if (listType == "label" || clearAll == true) {
            listType = "label";
            let htmlLabelFilter = document.getElementById("walkerLabelSelector_" + this.dbname);
            let c = "<div class='ui grid'>";
            for (let i = 0; i < this.walkerLabels.length; i++) {
                let lbl = this.walkerLabels[i];
                if (this.walkerSelectedLabels.includes(lbl) || isCheckAll == true) {
                    c += "<div class='three wide column'><div class='ui checked checkbox'><input  name='cb" + listType + "_walker_" + this.dbname + "' value='" + lbl + "'  type=\"checkbox\" checked=\"\" onChange=\"dbreportApp.handleWalkerChange('" + this.dbname + "',this)\"/><Label>" + lbl + "</Label></div></div>";
                } else {
                    c += "<div class='three wide column'><div class='ui checkbox'><input  name='cb" + listType + "_walker_" + this.dbname + "' value='" + lbl + "'  type=\"checkbox\" onChange=\"dbreportApp.handleWalkerChange('" + this.dbname + "',this)\"/><Label>" + lbl + "</Label></div></div>";
                }
            }
            c += "</div>";
            htmlLabelFilter.innerHTML = c;
        }
        if (listType == "rel" || clearAll == true) {
            listType = "rel";
            let htlmRelFilter = document.getElementById("walkerRelSelector_" + this.dbname);
            let cr = "<div class='ui grid'>";
            for (let i = 0; i < this.walkerRels.length; i++) {
                let lbl = this.walkerRels[i];
                if (this.walkerSelectedLabels.includes(lbl) || isCheckAll == true) {
                    cr += "<div class='three wide column'><div class='ui checked checkbox'><input  name='cb" + listType + "_walker_" + this.dbname + "' value='" + lbl + "'  type=\"checkbox\" checked=\"\" onChange=\"dbmodel.handleWalkerChange('" + this.dbname + "',this)\"/><Label>" + lbl + "</Label></div></div>";
                } else {
                    cr += "<div class='three wide column'><div class='ui checkbox'><input  name='cb" + listType + "_walker_" + this.dbname + "' value='" + lbl + "'  type=\"checkbox\" onChange=\"dbmodel.handleWalkerChange('" + this.dbname + "',this)\"/><Label>" + lbl + "</Label></div></div>";
                }
            }
            cr += "</div>";
            htlmRelFilter.innerHTML = cr;
        }
    }
    _addNode(nodes, aNodeId, aLabel, labelCount) {
        // { border : "black", background : "#66b14c", hover : { border : "blue"}, highlight: { border : "blue" }}
        let baseNodeSize = Number(10);
        let calculatedSize = baseNodeSize;
        if (labelCount > 0) {
            calculatedSize = baseNodeSize + Number(Math.log10(labelCount).toFixed(2));
        }
        nodes.add({
            id: aNodeId,
            label: aLabel + "\n " + labelCount,
            ltitle: aLabel,
            value: calculatedSize,
            color: { border : "black", background : this.lcm.getLabelColor(aLabel), hover : { border : "blue"}, highlight: { border : "blue" }}
        });
    }

    // _addRelationShip(startLabel, startId,startLabelCount, endLabel, endId,endLabelCount, relType, nodes, links, relatedLabels) {
    //     let baseNodeSize = Number(10);
    //     let calculatedSize = baseNodeSize;
    //     if (this._idIndex(nodes, startId) == null) {
    //         this._addNode(nodes, startId,startLabel,startLabelCount);
    //         relatedLabels.push(startLabel);
    //     }
    //     if (this._idIndex(nodes, endId) == null) {
    //         this._addNode(nodes, endId,endLabel,endLabelCount);
    //
    //         relatedLabels.push(endLabel);
    //     }
    //     // relationship this can be done directly because db.schema() only has one relationship per startLabel, relType, endLabel combination
    //     links.add({
    //         from: startId,
    //         to: endId,
    //         label: relType,
    //         ltitle: relType,
    //         arrows: 'to',
    //         font: {align: 'top', size: 10},
    //         color: {inherit: true},
    //         length: 300,
    //         smooth: {enabled: true, type: 'curvedCW', roundness: 0.15}
    //     });
    // }

    _idIndex(a, id) {
        if (a.length > 0) {
            var item = a.get(id);
            if (item) {
                return id;
            }
        }
        return null;
    }

    walkerClear() {
        this.walkerSelectedLabels = [];
        if (this.walkernetwork) {
            // this.walkernetwork.destroy();
            // this._clearWalkerProps();// clear
            this.walkernetwork.destroy();
            this.walkernetwork = null;
            // reinitilize
            this._redrawWalkerViz();
        }
        this._createWalkerCheckTable();
    }

    _buildWalkerViz(lbllCounts) {
        // get the graph container
        if (this.walkernetwork) {
            this.walkernetwork.destroy(); // clear
        }
        let simpleLabelCounts = new Map();
        for (let i=0; i < lbllCounts.length; i++) {
            simpleLabelCounts.set(lbllCounts[i].label, lbllCounts[i].count);
        }
        this.walkerGraphContainer = document.getElementById("graphIDwalker_" + this.dbname);
        this.walkerPropsContainer = document.getElementById("propsIDwalker_" + this.dbname);
        // empty viz
        let nodes = new vis.DataSet();
        let links = new vis.DataSet();

        this.walkerdata = { nodes : nodes, edges: links};
        // building vis
        this.walkervoptions = { clickToUse: false
            , interaction : {selectConnectedEdges: false, hover: true, selectable: true}
            , nodes : { color : { border : "black", background : "#66b14c", hover : { border : "blue"}, highlight: { border : "blue" }}
                       , font : { size : 11}
                       , shape : "dot"
                       , scaling : { min : 5, max : 30}
                       }};
        // default hierarchical
        this.walkervoptions.layout = { hierarchical: {
                enabled:true,
                levelSeparation: 150,
                nodeSpacing: 100,
                treeSpacing: 200,
                blockShifting: false,
                edgeMinimization: false,
                parentCentralization: false,
                direction: "UD",        // UD, DU, LR, RL
                sortMethod: "hubsize"   // hubsize, directed
            }};
        // this will be called the first time the Schema Tab is selected
        this.walkernetwork = new vis.Network(this.walkerGraphContainer, this.walkerdata, this.walkervoptions);
        this.walkernetwork.disableEditMode();

        this._registerWalkerVizEvents();
    }
    _registerWalkerVizEvents() {
        this._clearWalkerProps();
        let current = this;
        this.walkernetwork.on("click", function (params)  {
            //current._showWalkerNodeProps(params.nodes[0]);
            // console.log(params);
            // if (params.nodes.length > 0) {
            //     let nid = params.nodes[0];
            //     current._handleWalkerContext(nid,params.pointer.DOM.x, params.pointer.DOM.y);
            // }
            // params.event.preventDefault();

        });

        this.walkernetwork.on("hoverNode", function (params) {
            //console.log("hoverNode");
            //console.log(params);
            current.walkernetwork.selectNodes([params.node],false);
            current._showWalkerNodeProps(params.node);
        });
        this.walkernetwork.on("blurNode", function (params)  {
            //current._clearWalkerProps();
        });

        this.walkernetwork.on("deselectNode",  function (params) {
            current._clearWalkerProps();
        });

        this.walkernetwork.on("selectNode",  function (params) {
            //console.log("selectNode");
            //console.log(params);
            //current.walkernetwork.selectNodes([params.node],false);
            current._showWalkerNodeProps(params.nodes[0]);
        });


        this.walkernetwork.on("selectEdge", function (params)  {

            current._showWalkerRelProps(params.edges[0]);
        });

        this.walkernetwork.on("deselectEdge",  function (params) {
            current._clearWalkerProps();
        });

        this.walkernetwork.on("oncontext", function (params) {
            // console.log(params);
            if (params.nodes.length > 0) {
                let nid = params.nodes[0];
                //current._handleWalkerContext(nid,params.pointer.DOM.x, params.pointer.DOM.y);
                current._handleWalkerContext(nid,params.event.x, params.event.y);

            }
            params.event.preventDefault();
        });


        this.walkernetwork.on("doubleClick", function (params) {
            let qt = Date.now();
            if (qt - this.lastDoubleClick < 200) {
                // last event
                current._handleWalkerDoubleClick(params);
            }
            this.lastDoubleClick = qt;
        });
    }

    _redrawWalkerViz() {
        // when the Schema Tab is selected

        //console.log("in _redrawWalkerViz");
        if (dbreportApp.hasDBInfo(this.dbname)) {
            let dbinfo = dbreportApp.getDBInfo(this.dbname);
            if (dbinfo.complexityScore >= 400) {
                let showAllButton = document.getElementById("btH_ChooseAll_" + this.dbname);
                showAllButton.style.color = "orangered";
            }

            if (!this.walkernetwork) {
                // console.log('initializing walkernetwork');
                this._clearWalkerProps();
                this._buildWalkerViz(dbinfo.labelCounts);
                this._registerWalkerVizEvents();
            }
        }
    }

    _checkNetwork() {
        if (dbreportApp.hasDBInfo(this.dbname)) {
            if (!this.walkernetwork) {
                let dbinfo = dbreportApp.getDBInfo(this.dbname);

                // console.log('initializing walkernetwork');
                this._clearWalkerProps();
                this._buildWalkerViz(dbinfo.labelCounts);
                this._registerWalkerVizEvents();
            }
        }
    }

    _notInVis(aNodeId, aType, incoming) {
        let res = true;
        // walk through the edges
        if (this.walkerdata.edges) {
            let ds = this.walkerdata.edges;
            let items = ds.get({filter : function (item) {
                    if (incoming) {
                        // the current node id is the end node
                        if (item.to == aNodeId && item.label == aType) {
                            return true;
                        } else {
                            return false;
                        }
                    } else {
                        // the current node id is the start node
                        if (item.from == aNodeId && item.label == aType) {
                            return true;
                        } else {
                            return false;
                        }
                    }
                }});
            res = (items.length == 0);
        }
        return res;
    }

    _handleWalkerContext(nid, xpos, ypos) {
        //console.log(" node id " + nid);
        //console.log(this.walkerdata.nodes.get(nid).ltitle);
        let nodeName = this.walkerdata.nodes.get(nid).ltitle;
        let nodeData = this._getLabelCountObject(nodeName);
        let x = xpos;
        let y = ypos -60;

        let html = '<div class="ui secondary vertical menu" style="max-height: 400px; width: 250px; overflow:auto; background-color: #e9fce9 ;font-size: .7em; border: outset; position: absolute; z-index: 1000; left: ' + x + 'px; top: ' + y + 'px;">';
        if (nodeData.outgoingRelations && nodeData.outgoingRelations.length > 0) {

            for (let i = 0; i < nodeData.outgoingRelations.length; i++) {
                let item = nodeData.outgoingRelations[i];
                //console.log(this._notInVis(nid, item.type, false));
                if (this._notInVis(nid, item.type, false) == true) {
                    html += '<a class="item" onClick="dbreportApp._addWalkerRelationship(\'' + this.dbname + '\',' + nid + ',\'' + item.type + '\',false); "><i class="icon long arrow alternate right"></i>';
                    html += nodeData.outgoingRelations[i].type;
                    html += '</a>';
                } else {
                    html += '<a class="item" style="background-color: rgba(255,0,0,0.2);" onClick="dbreportApp._removeWalkerRelationship(\'' + this.dbname + '\',' + nid + ',\'' + item.type + '\',false); "><i class="icon eraser"></i><i class="icon long arrow alternate right"></i>';
                    html += nodeData.outgoingRelations[i].type;
                    html += '</a>';
                }
            }
        }
        if (nodeData.incomingRelations && nodeData.incomingRelations.length > 0) {
            for (let i = 0; i < nodeData.incomingRelations.length; i++) {
                let item = nodeData.incomingRelations[i];
                //console.log(this._notInVis(nid, item.type, true));
                if (this._notInVis(nid, item.type, true) == true) {
                    html += '<a class="item" onClick="dbreportApp._addWalkerRelationship(\'' + this.dbname + '\',' + nid + ',\'' + item.type + '\',true); "><i class="icon long arrow alternate left"></i>';
                    html += nodeData.incomingRelations[i].type;
                    html += '</a>';
                } else {
                    html += '<a class="item" style="background-color: rgba(255,0,0,0.2);" onClick="dbreportApp._removeWalkerRelationship(\'' + this.dbname + '\',' + nid + ',\'' + item.type + '\',true); "><i class="icon eraser"></i><i class="icon long arrow alternate left"></i>';
                    html += nodeData.incomingRelations[i].type;
                    html += '</a>';
                }
            }
        }
        html+= '<a class="item" style="background-color: rgba(255,0,0,0.2);" onClick="dbreportApp._deleteWalkerNode(\'' + this.dbname + '\',\'' + nodeName + '\' ); "><i class="icon eraser"></i>Clear Label</a></div>';
        this.walkerContext.innerHTML = html;

    }

    _deleteWalkerNode(aLabel) {
        this.walkerContext.innerHTML = "";
        if (this.walkernetwork) {
            let items = this.walkerdata.nodes.get({ filter: function (item) {return item.ltitle == aLabel}});
            if (items.length == 1) {
                let nid = this._getSchemaNodeId(aLabel);
                let itemstoremove = this.walkerdata.edges.get({ filter: function (item) {return item.from == nid || item.to == nid}});
                this.walkerdata.nodes.remove(nid);
                this.walkerdata.edges.remove(itemstoremove);
            }
        }
        this._updateWalkerSelectedLabels(aLabel, false, true);
        this._clearWalkerProps();

    }

    _handleWalkerDoubleClick(params){
        //console.log("_handleWalkerDoubleClick " + this.dbname);
        this.walkerContext.innerHTML = "";
        let nid = params.nodes[0];
        let current = this;
        // walk now through the schema rels
        let dbinfo = dbreportApp.getDBInfo(this.dbname);

            dbinfo.schemaRels.forEach( function (item) {
            if (Math.abs(item.startNode.identity.toNumber()) == nid || Math.abs(item.endNode.identity.toNumber()) == nid ) {
                //console.log(item);
                current._addRelationShipW(item.startNode.properties.name,Math.abs(item.startNode.identity.toNumber()), item.endNode.properties.name, Math.abs(item.endNode.identity.toNumber()) , item.type);
            }

        });



    }
    _addWalkerRelationship(nid, type, incoming) {
        this.walkerContext.innerHTML = "";
        let current = this;
        // walk now through the schema rels
        let dbinfo = dbreportApp.getDBInfo(this.dbname);
        dbinfo.schemaRels.forEach( function (item) {
            if (item.type == type) {
                if (incoming) {
                    // check if the nid is the end node id
                    if (Math.abs(item.endNode.identity.toNumber()) == nid) {
                        current._addRelationShipW(item.startNode.properties.name,Math.abs(item.startNode.identity.toNumber()), item.endNode.properties.name, nid , type  );
                    }

                } else {
                    // check if the nid is the start node id
                    if (Math.abs(item.startNode.identity.toNumber()) == nid) {
                        current._addRelationShipW(item.startNode.properties.name , nid , item.endNode.properties.name, Math.abs(item.endNode.identity.toNumber()), type  );
                    }
                }
            }

        });

        this.walkernetwork.redraw();
        //this.walkernetwork.setData(this.walkerdata);
        // this.walkernetwork.setData(this.walkerdata);
        // console.log(this.walkerdata);

    }

    _removeWalkerRelationship(nid, type, incoming) {
        //console.log("_removeWalkerRelationship start");
        //console.log("nid" + nid );
        //console.log("type" + type);
        //console.log("incoming" + incoming);
        this.walkerContext.innerHTML = "";
        let current = this;
        // walk now through the schema rels
        let ds = this.walkerdata.edges;
        // items to remove

        let itemsToRemove = ds.get({
            filter: function (item) {
                //console.log(item);
                if (item.label == type) {
                    if (incoming) {
                        // check if the nid is the start node id
                        if (item.to == nid) {
                            return true;
                        } else {
                            return false;
                        }

                    } else {
                        // check if the nid is the end node id
                        if (item.from == nid) {
                            return true;
                        } else {
                            return false;
                        }
                    }
                } else {
                    return false;
                }
            }
        });
        // console.log("items to remove");
        // console.log(itemsToRemove);

        ds.remove(itemsToRemove);

        // this.walkernetwork.redraw();

    }



    _addRelationShipW(startLabel, startId, endLabel, endId, relType) {
        //console.log(" start Label " + startLabel + " startId " + startId + " endLabel " + endLabel + " endId " + endId + " relType " + relType);
        if (this._edgeExists(startId, endId, relType)) {
            //console.log("Edge already exists");
            return;
        }
        let baseNodeSize = Number(10);
        let calculatedSize = baseNodeSize;
        let startNodeData = this._getLabelCountObject(startLabel);
        let endNodeData = this._getLabelCountObject(endLabel);
        if (this._idIndex(this.walkerdata.nodes, startId) == null) {
            this._addNode(this.walkerdata.nodes, startId,startLabel,startNodeData.count);
            this._updateWalkerSelectedLabels(startLabel, true, true);
        }
        if (this._idIndex(this.walkerdata.nodes, endId) == null) {
            this._addNode(this.walkerdata.nodes, endId,endLabel,endNodeData.count);
            this._updateWalkerSelectedLabels(endLabel, true, true);
        }
        // relationship this can be done directly because db.schema() only has one relationship per startLabel, relType, endLabel combination
        // console.log(this.walkerdata.links);
        let roundNess = this._determineRoundness(startId, endId, relType);
        let vadjust = roundNess * 200;
        //console.log("vadjust " + vadjust);
        this.walkerdata.edges.add({
            from: startId,
            to: endId,
            label: relType,
            ltitle: relType,
            arrows: 'to',
            font: {align: 'middle', size: 10, vadjust: vadjust},
            color: {inherit: false},
            length: 300,
            smooth: {enabled: true, type: 'curvedCW', roundness: roundNess }
        });
    }

    _edgeExists(startId, endId, relType) {
        let cnt = 0;
        if (this.walkerdata.edges) {
            if (this.walkerdata.edges.length > 0) {
                cnt = this.walkerdata.edges.get(
                    {filter: function(item) {
                        return (item.from === startId && item.to === endId && item.label === relType);
                        }}).length;
            }
        }
        return (cnt > 0);
    }

    _determineRoundness(startId, endId, relType) {
        // if there is already the same startId and endId in the this.walkerdata.edges then the roundness will by n times 0.10
        // start pos = -0.50
        let startRoundness = 1;
        let step = 3;
        let sameCount = 0;
        // if there is already the sames endId startId (an other direction) then do the same but -1 * n times 0.10
        if (this.walkerdata.edges.length > 0 ) {
            sameCount = this.walkerdata.edges.get({
                filter: function(item) {
                    return (item.from == startId && item.to == endId);
                }}).length;
            sameCount += this.walkerdata.edges.get({
                filter: function(item) {
                    return (item.to == startId && item.from == endId);
                }}).length;
        }

        //console.log("sameCount " + sameCount);

        let roundness = startRoundness;
        if (sameCount > 0) {
            roundness = roundness + ((sameCount ) * step);
        }
//        console.log(relType + " sameCount:" + sameCount  + ":roundness " + roundness);
        if (sameCount % 2 == 0) {
            return roundness/ -100;
        } else {
            return roundness/ 100;
        }
    }

    _showWalkerNodeProps(params) {
        let nodeName = this.walkerdata.nodes.get(params).ltitle;
        let nodeData = this._getLabelCountObject(nodeName);

        // name, count
        let html = '<h4 class="ui header">\n' +
            '  <i class="tag green icon"></i>\n' +
            '  <div class="content">\n' +
            nodeName +
            '    (#' + nodeData.count + ')\n' +
            '  </div>\n' +
            '</h4>';

        // if properties known show properties
        html += '<div  style="height: 535px; overflow:auto; font-size: .9em;">';
        if (nodeData.allProperties && nodeData.allProperties.length > 0) {
            html += '<div><h4 class="ui header">\n' +
                '  <i class="icon table"></i>\n' +
                '  <div class="content">Properties' +
                '  </div>\n' +
                '</h4>';
            html += '<table class="ui celled table">\n' +
                '  <thead>\n' +
                '    <tr><th>Property</th>\n' +
                '    <th>Data Type</th>\n' +
                '    <th></th>\n' +
                '  </tr></thead>\n' +
                '  <tbody>\n' ;
            for (let i = 0; i < nodeData.allProperties.length; i++) {
                let pdat = nodeData.allProperties[i].split("-");
                html+= "<tr>";
                html+= "<td>" + pdat[0]+ "</td>";
                html+= "<td>" + pdat[1] + "</td>";
                if (pdat[2]) {
                    html+= "<td>" + pdat[2] + "</td>";
                } else {
                    html+= "<td></td>";
                }
                html+= "</tr>";
            }
            html += '  </tbody>\n' +
                '</table>';
        }

        // outgoing rels + count
        if (nodeData.outgoingRelations && nodeData.outgoingRelations.length > 0) {
            html += '<div><h4 class="ui header">\n' +
                '  <i class="icon long arrow alternate right"></i>\n' +
                '  <div class="content">Outgoing Relationships' +
                '  </div>\n' +
                '</h4>';
            html += this._propsTable(nodeData.outgoingRelations);
        }


        // incoming rels + count

        if (nodeData.incomingRelations && nodeData.incomingRelations.length > 0) {
            html += '<div><h4 class="ui header">\n' +
                '  <i class="icon long arrow alternate left"></i>\n' +
                '  <div class="content">Incoming Relationships' +
                '  </div>\n' +
                '</h4>';
            html += this._propsTable(nodeData.incomingRelations);
        }


        html += "</div>";
        this.walkerPropsContainer.innerHTML = html;
    }

    _showWalkerRelProps(params) {
        let relType = this.walkerdata.edges.get(params).ltitle;
        let relData = this._getRelCountObject(relType);
        // name, count
        let html = '<h4 class="ui header">\n' +
            '  <i class="icon green long arrow alternate right"></i>\n' +
            '  <div class="content">\n' +
            relType +
            '    (#' + relData.count + ')\n' +
            '  </div>\n' +
            '</h4>';

        html += '<div  style="height: 535px; overflow:auto; font-size: .9em;">'
        // check for properties
        if (relData.allProperties && relData.allProperties.length > 0) {
            html += '<div><h4 class="ui header">\n' +
                '  <i class="icon table"></i>\n' +
                '  <div class="content">Properties' +
                '  </div>\n' +
                '</h4>';
            html += '<table class="ui celled table">\n' +
                '  <thead>\n' +
                '    <tr><th>Property</th>\n' +
                '    <th>Data Type</th>\n' +
                '    <th></th>\n' +
                '  </tr></thead>\n' +
                '  <tbody>\n' ;
            for (let i = 0; i < relData.allProperties.length; i++) {
                let pdat = relData.allProperties[i].split("-");
                html+= "<tr>";
                html+= "<td>" + pdat[0]+ "</td>";
                html+= "<td>" + pdat[1] + "</td>";
                if (pdat[2]) {
                    html+= "<td>" + pdat[2] + "</td>";
                } else {
                    html+= "<td></td>";
                }
                html+= "</tr>";
            }
            html += '  </tbody>\n' +
                '</table>';
        }

        html += '</div>';
        this.walkerPropsContainer.innerHTML = html;
    }
    _getRelCountObject(aRelType) {
        let dbinfo = dbreportApp.getDBInfo(this.dbname);
        if (dbinfo.relTypes)  {
            for (let i=0 ; dbinfo.relTypes.length; i++) {
                if (dbinfo.relTypes[i].type == aRelType) {
                    return dbinfo.relTypes[i];
                }
            }
        }
        return null;
    }


    _clearWalkerProps() {
        //  console.log("clear Props");
        if (this.walkerPropsContainer) {
            this.walkerPropsContainer.innerHTML = "";
        }
        if (this.walkerContext) {
            this.walkerContext.innerHTML = "";
        }
    }

    showCompleteSchema() {
        this._checkNetwork();
        let current = this;
        let dbinfo = dbreportApp.getDBInfo(this.dbname);
        if (dbinfo.complexityScore < 400) {
            this._clearWalkerProps();
            this._selectAllLabels();
            this._selectAllRelTypes();
            this.walkernetwork.setData(this.walkerdata); // otherwise you will have to click on the canvas to get the latest...
        } else {
            // alert("");
            let hdr = document.getElementById("simpleYesNoModalHeader");
            let cnt = document.getElementById("simpleYesNodModalContent");
            let proceed = document.getElementById("simpleYesNoModalOk");
            hdr.innerHTML = "<div class=\"ui icon message\">\n" +
                "  <i class=\"hand paper icon\" style=\"color: orangered;\"'></i>\n" +
                "  <div class=\"content\">\n" +
                "    <div class=\"header\">\n" +
                "      Warning\n" +
                "    </div>\n" +
                "    <p>Schema to big for Show All</p>\n" +
                "  </div>\n" +
                "</div>";
            cnt.innerHTML = "The database schema may be to complex to show at once. <br/><br/>Use the Label Filter to start with some Labels and explore the Schema piece by piece.<br/><br/>" +
                "When you proceed with Show All there is a big change the schema will not appear";
            proceed.innerHTML = "Show All";
            let key = "#simpleYesNoModal";

            $(key)
                .modal({
                    closable  : false,
                    onDeny    : function(){
                        return true;
                    },
                    onApprove : function() {
                        current._clearWalkerProps();
                        current._selectAllLabels();
                        current._selectAllRelTypes();
                        current.walkernetwork.setData(current.walkerdata); // otherwise you will have to click on the canvas to get the latest...
                    }
                })
                .modal('show')
            ;
        }
    }


    handleWalkerChange(elm) {
        this._checkNetwork();
        // clear properties if they are there
        this._clearWalkerProps();
        //console.log(elm.name  + " " + elm.value + " " + elm.checked);
        if (elm.name.startsWith("cblabel_walker_" + this.dbname)) {
            this._addRemoveWalkerLabel(elm.value, elm.checked);
        } else {
            this._addRemoveWalkerRel(elm.value, elm.checked);
        }
    }

    _addRemoveWalkerLabel(aLabel, aChecked) {
        // is the label already in vis js dataset?
        let dbinfo = dbreportApp.getDBInfo(this.dbname);
        let simpleLabelCounts = new Map();
        for (let i=0; i < dbinfo.labelCounts.length; i++) {
            simpleLabelCounts.set(dbinfo.labelCounts[i].label, dbinfo.labelCounts[i].count);
        }

        //console.log(this.walkernetwork);

        if (this.walkernetwork) {
            let items = this.walkerdata.nodes.get({ filter: function (item) {return item.ltitle == aLabel}});
            if (aChecked) {
                //console.log(' length array ' + items.length);
                if (items.length == 0) {
                    this._addNode(this.walkerdata.nodes, this._getSchemaNodeId(aLabel), aLabel, simpleLabelCounts.get(aLabel));
                    this.walkernetwork.setData(this.walkerdata); // otherwise you will have to click on the canvas to get the latest...
                }
            } else {
                if (items.length == 1) {
                    let nid = this._getSchemaNodeId(aLabel);
                    let itemstoremove = this.walkerdata.edges.get({ filter: function (item) {return item.from == nid || item.to == nid}});
                    this.walkerdata.nodes.remove(nid);
                    this.walkerdata.edges.remove(itemstoremove);
                }
            }
        }
        this._updateWalkerSelectedLabels(aLabel, aChecked, false);
    }

    _addRemoveWalkerRel(aType, aChecked) {
        //
        // A REL TYPE can be in both directions and it can occur on multiple places in the schema
        // This function is call only in the 'Add' situation, there is no functionality to remove it yet
        //
        let current = this;
        let dbinfo = dbreportApp.getDBInfo(this.dbname);

        if (this.walkernetwork) {
            let items = [];
            if (this.walkerdata.links) {
                items = this.walkerdata.edges.get({ filter: function (item) {return item.ltitle == aType}});
            }



            if (aChecked) {
                //console.log(' length array ' + items.length);
                if (items.length == 0) {
                    // now we have to find all the relationships in this schema with this type
                    dbinfo.schemaRels.forEach( function (item) {

                        if (item.type == aType) {
//                            console.log(item);
                            //     _addRelationShipW(startLabel, startId, endLabel, endId, relType) {
                            current._addRelationShipW(item.startNode.properties.name,Math.abs(item.startNode.identity.toNumber()), item.endNode.properties.name, Math.abs(item.endNode.identity.toNumber()) , item.type  );
                        }
                    });
                }
            } else {
                // TBD if we apply a RelType Filter
                // if (items.length == 1) {
                //     let nid = this._getSchemaNodeId(aLabel);
                //     let itemstoremove = this.walkerdata.edges.get({ filter: function (item) {return item.from == nid || item.to == nid}});
                //     this.walkerdata.nodes.remove(nid);
                //     this.walkerdata.edges.remove(itemstoremove);
                // }
            }
        }
        // this._updateWalkerSelectedRels(aType, aChecked, false);
    }

    _getLabelCountObject(aLabelName)  {
        let dbinfo = dbreportApp.getDBInfo(this.dbname);

        if (dbinfo.labelCounts)  {
            for (let i=0 ; dbinfo.labelCounts.length; i++) {
                if (dbinfo.labelCounts[i].label == aLabelName) {
                    return dbinfo.labelCounts[i];
                }
            }
        }
        return null;
    }

    _getSchemaNodeId(aLabel) {
        let dbinfo = dbreportApp.getDBInfo(this.dbname);

        let nid = 0;
        dbinfo.schemaNodes.forEach( function (item) {
                if (item.node.properties.name == aLabel) {
                    nid = Math.abs(item.nid.toNumber());
                }
            }
        );
        return nid;
    }

    changeLayout(layoutType) {
        // check the current sortMethod
        this._handleLayoutButtons(layoutType);
        let sortMethod = "directed";
        if (!$('#btH_DirViz').hasClass("disabled")) {
            sortMethod = "hubsize";
        }
        if (layoutType) {
            if ( ["UD","DU","LR","RL"].includes(layoutType) ) {  // hierarchical
                if (this.walkervoptions.layout) {
                    delete this.walkervoptions.layout;
                    delete this.walkervoptions.physics;
                }
                this.walkervoptions.layout = { hierarchical: {
                        enabled:true,
                        levelSeparation: 150,
                        nodeSpacing: 100,
                        treeSpacing: 200,
                        blockShifting: true,
                        edgeMinimization: true,
                        parentCentralization: true,
                        direction: layoutType,        // UD, DU, LR, RL
                        sortMethod: sortMethod   // hubsize, directed
                    }};
            } else if (["directed","hubsize"].includes(layoutType)) {
                this.walkervoptions.layout.hierarchical.sortMethod = sortMethod;
            }
            else {
                if (this.walkervoptions.layout) { // graph
                    delete this.walkervoptions.layout;
                    delete this.walkervoptions.physics;
                }
            }
        } else {
            // clear the layout
            if (this.walkervoptions.layout) {
                delete this.walkervoptions.layout;
                delete this.walkervoptions.physics;
            }
        }
        if (this.walkernetwork) {
            this.walkernetwork.setOptions(this.walkervoptions);
            // reload the data
            //
            if ( ["UD","DU","LR","RL"].includes(layoutType) ) {
                this.walkernetwork.setData(this.walkerdata);
            }
            this.walkernetwork.redraw();

        }


    }

    _handleLayoutButtons(lt) {
        // buttons: btGraphVis, btH_UDViz, btH_DUViz, btH_LRViz, btH_RLViz, btH_DirViz, btH_HubSizeViz
        //let dbinfo = dbreportApp.getDBInfo(this.dbname);

        // graph: graph, directed, hubsize disabled,
        // if (lt == "graph") {
        //     this._disableElement("btGraphVis");
        //     this._disableElement("btH_DirViz");
        //     this._disableElement("btH_HubSizeViz");
        //     this._enableElement("btH_UDViz");
        //     this._enableElement("btH_DUViz");
        //     this._enableElement("btH_LRViz");
        //     this._enableElement("btH_RLViz");
        // }

        // UD
        if (lt == "UD") {
//            this._enableElement("btGraphVis");
            this._disableElement("btH_UDViz_" + this.dbname);
            this._enableElement("btH_DUViz_" + this.dbname);
            this._enableElement("btH_LRViz_" + this.dbname);
            this._enableElement("btH_RLViz_" + this.dbname);
            this._disableElement("btH_DirViz_" + this.dbname);
            this._enableElement("btH_HubSizeViz_" + this.dbname);
        }

        // DU
        if (lt == "DU") {
            //           this._enableElement("btGraphVis");
            this._enableElement("btH_UDViz_" + this.dbname);
            this._disableElement("btH_DUViz_" + this.dbname);
            this._enableElement("btH_LRViz_" + this.dbname);
            this._enableElement("btH_RLViz_" + this.dbname);
            this._disableElement("btH_DirViz_" + this.dbname);
            this._enableElement("btH_HubSizeViz_" + this.dbname);
        }

        // LR
        if (lt == "LR") {
//            this._enableElement("btGraphVis");
            this._enableElement("btH_UDViz_" + this.dbname);
            this._enableElement("btH_DUViz_" + this.dbname);
            this._disableElement("btH_LRViz_" + this.dbname);
            this._enableElement("btH_RLViz_" + this.dbname);
            this._disableElement("btH_DirViz_" + this.dbname);
            this._enableElement("btH_HubSizeViz_" + this.dbname);
        }


        // RL
        if (lt == "RL") {
//            this._enableElement("btGraphVis");
            this._enableElement("btH_UDViz_" + this.dbname);
            this._enableElement("btH_DUViz_" + this.dbname);
            this._enableElement("btH_LRViz_" + this.dbname);
            this._disableElement("btH_RLViz_" + this.dbname);
            this._disableElement("btH_DirViz_" + this.dbname);
            this._enableElement("btH_HubSizeViz_" + this.dbname);
        }


        // directed
        if (lt == "directed") {
            this._disableElement("btH_DirViz_" + this.dbname);
            this._enableElement("btH_HubSizeViz_" + this.dbname);
        }

        // hubsize
        if (lt == "hubsize") {
            this._enableElement("btH_DirViz_" + this.dbname);
            this._disableElement("btH_HubSizeViz_" + this.dbname);
        }
    }



    _propsTable(ldat) {
        let tt = '<table class="ui celled table">\n' +
            '  <thead>\n' +
            '    <tr><th>Relationship Type</th>\n' +
            '    <th>Count</th>\n' +
            '  </tr></thead>\n' +
            '  <tbody>\n' ;
        for (let i = 0; i < ldat.length; i++) {
            tt+= "<tr>";
            tt+= "<td>" + ldat[i].type + "</td>";
            tt+= "<td>" + ldat[i].count + "</td>";
            tt+= "</tr>";
        }
        tt += '  </tbody>\n' +
            '</table>';


        return tt;
    }

    _enableElement(aId) {
        let key = "#" + aId;
        if ($(key).hasClass('disabled')) {
            $(key).removeClass('disabled');
        }
    }

    _disableElement(aId) {
        let key = "#" + aId;
        if (!$(key).hasClass('disabled')) {
            $(key).addClass('disabled');
        }
    }
}
