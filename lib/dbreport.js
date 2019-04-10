'use strict';

class LabelColorMap {
    constructor() {
        this.colorMap = new Map();
    }

    buildColorMap(aLabellist) {
        let colorScale = d3.scaleOrdinal(d3.schemeCategory10);

        for (let i = 0; i < aLabellist.length; i++) {
            let lbl = aLabellist[i];
            this.colorMap.set(lbl, colorScale(i));
        }
        // console.log(this.colorMap);
    }
    getLabelColor(aLabel) {
        let cc = "#66b14c"
        if (aLabel) {
            cc = lcm.colorMap.get(aLabel);
        }
        return cc;
    }

}


class DBReport {

    constructor(desktopAPI) {
		this.dapi = desktopAPI;
		this.dapi.showMenuOnRightClick(false); // prevent annoying defatul menu
		this.analyzewithdebug = false;
		this.liveCount = true;
        this.liveViewContainerName = "_dblvwr_";
        this.liveCountLogScale = false;
        this.lastDoubleClick = Date.now();
        this.nea;
        this.logScale = false;
        this.labelCount = 0;
        this.relTypeCount = 0;
        this.desktopContext = 0;
    }

    async init() {
        let prms;
        if (this.dapi) {
            let current = this;
            prms = this.dapi.getContext();
            prms.then( function(value) {
                current.desktopContext = value;
            });
            await prms;
            this._setContext();

            //
            // Connect to Neo4 only if the neoHost or the neoUser is changedj
            //
            if (current.graphdb) {
                let nh = current.graphdb.connection.configuration.protocols.bolt.host;
                let nu = current.graphdb.connection.configuration.protocols.bolt.username;
                let initDriver = false;
                if (current.neoHost) {
                    if (current.neoHost != nh || current.neoUser != nu) {
                        initDriver = true;
                    }
                } else {
                    // first time
                    initDriver = true;
                }
                if (initDriver == true) {
                    current.neoHost = nh;
                    current.neoUser = nu;
                    let boltURL = "bolt" + "://" + current.neoHost + ":" + current.graphdb.connection.configuration.protocols.bolt.port;
                    current.nea = new NeoAccessor(boltURL, current.neoUser, current.graphdb.connection.configuration.protocols.bolt.password);
                    current.session = current.nea.getReadSession();

                    // init filter tab
                    await current._initFilter("label", false);
                    await current._initFilter("rel", false);
                    current._initColorMap();
                }
            } else {
                console.log(" No active Database, start a database in the Neo4j Desktop first")
            }
        }
        return prms;
    }

    toggleDebug() {
        this.analyzewithdebug = !this.analyzewithdebug;
    }

    _checkParameters() {
        let lblfilter = document.getElementById("anp");
        let selectedLabels = 0;
        if (this.labelFilter) {
            selectedLabels = this.labelFilter.length;
        }
        lblfilter.innerHTML = "Analyze Label Properties (" + selectedLabels + "/" + this.labelCount + ")";

        let relfilter = document.getElementById("arp");
        let selectedRels = 0;
        if (this.relTypeFilter) {
            selectedRels =  this.relTypeFilter.length;
        }
        relfilter.innerHTML = "Analyze Relationship Type Properties (" + selectedRels + "/" + this.relTypeCount + ")";

        let lblcombo = document.getElementById("analyzeLabelCombo");

        if (selectedLabels > 0 || selectedRels > 0 || lblcombo.checked == true) {
            // enable
            this._enableElement("btCountTreshold");
        } else {
            // disable
            this._disableElement("btCountTreshold");
        }
    }

    async _initColorMap() {
        let lbls = await this.nea.getLabels(this.session);
        lcm.buildColorMap(lbls);
    }

    async _initFilter (type, checked) {
        // label list
        let doLabels = true;
        let doRelations = true;
        if (type && type == "label") {
            doRelations = false;
        } else if (type && type ==  "rel") {
            doLabels = false;
        }

        if (doLabels) {
            this.labelFilter = await this.nea.getLabels(this.session);
            this.labelCount = this.labelFilter.length;


            // build label color map
            //this._buildColorMap(this.labelFilter);
            let htmlLabelFilter = document.getElementById("labelFilterReport");
            htmlLabelFilter.innerHTML = this._createCheckTable(this.labelFilter, 'label', checked);
        }
        if (doRelations) {
            // relation list
            this.relTypeFilter = await this.nea.getRelationshipTypes(this.session);
            this.relTypeCount = this.relTypeFilter.length;
            let htmlRelTypeFilter = document.getElementById("reltypeFilter");
            htmlRelTypeFilter.innerHTML = this._createCheckTable(this.relTypeFilter, 'rel', checked);
        }
        this._checkParameters();
    }

    getLabelFilter() {
        return this.labelFilter;
    }


    _createCheckTable(aList, listtype, checked) {

        aList.sort();
        let bCheck = false;
        if (checked) {
            bCheck = checked;
        }
        let c = "<div class='ui grid'>";
        let removedValues = [];
        for (let i = 0; i < aList.length; i++) {
            if (bCheck) {
                c += "<div class='three wide column'><div class='ui checkbox'><input checked='checked' name='cb" + listtype + "_filter_' value='" + aList[i] + "'  type=\"checkbox\" onChange=\"handleFilterChange(this)\"/><Label>" + aList[i] + "</Label></div></div>";
            } else {
                c += "<div class='three wide column'><div class='ui checkbox'><input name='cb" + listtype + "_filter_' value='" + aList[i] + "'  type=\"checkbox\" onChange=\"handleFilterChange(this)\"/><Label>" + aList[i] + "</Label></div></div>";
                // remove the item from the list
                removedValues.push(aList[i]);
            }
        }
        c += "</div>";
        for (let x = 0; x < removedValues.length; x++) {
            let value = removedValues[x];
            if (aList.includes(value)) {
                let pos = -1;
                for (pos = 0; pos < aList.length; pos++ ) {
                    let s = aList[pos];
                    if (s == value) {
                        break;
                    }
                }
                aList.splice(pos,1);
            }
        }
        return c;
    }




    _deselectAllFilter(type) {
        let elements = document.getElementsByName("cb" + type + "_filter_");
        for (let i=0 ; i < elements.length; i++) {
            elements[i].checked = false;
            this.handleFilterChange(elements[i]);
        }
    }




    handleFilterChange(elm) {
        if (elm.name.startsWith("cblabel_") ) {
            // label change
            this._handleFilter(this.labelFilter, elm.value, elm.checked);
        } else {
            // reltype change
            this._handleFilter(this.relTypeFilter, elm.value, elm.checked);
        }
        this._checkParameters();
    }








    _handleFilter(aList, aValue, aChecked) {


        if (aChecked) {
            // if not in list add it to the list
            if (!aList.includes(aValue)) {
                aList.push(aValue);
            }
        } else {
            // if in list remove from list
            if (aList.includes(aValue)) {
                let pos = -1;
                for (pos = 0; pos < aList.length; pos++ ) {
                    let s = aList[pos];
                    if (s == aValue) {
                        break;
                    }
                }
                aList.splice(pos,1);
            }
        }
    }

    _appendMessage(repContainer, aString, newLine) {
	    let curData = repContainer.innerHTML;
	    if (newLine) {
            repContainer.innerHTML = curData + "<br/>" + aString;
        } else {
            repContainer.innerHTML = curData + " " + aString;
        }
    }

    _schemaColumn(aLabelorRelType, aProperty, indexes, constraints) {
        // possible return values
        // "", "U","U*","I","I*","M", "UM", "IM"
        // "U" Unique
        // "N" Node Key
        // "I" Index
        // "M" mandatory constraint
        // "UM" Unique contraint + mandatory constraint
        // "I*" index over multiple fields
        // "N*" node key over multiple fields

        let res = "";
        let multiple = false;

        // the indexes

        // then check the indexes
        if (indexes && indexes.length > 0) {
            for (let i = 0; i < indexes.length; i++) {
                // get the label from the description to be backwards compatible
                let ind = indexes[i];
                let colonpos = ind.description.indexOf(":");
                let brpos = ind.description.indexOf("(");
                let brpos2 = ind.description.indexOf(")");

                let label = ind.description.substring(colonpos + 1, brpos);
                let props = ind.description.substring(brpos + 1, brpos2).split(',');

                if (label == aLabelorRelType) {
                    if (this._arrayContains(props,aProperty )) {
                        if (ind.type == "node_label_property") {
                            res = "I";
                        } else {
                            res = "U";
                        }
                        if (ind.properties && ind.properties.length > 1) {
                            multiple = true;
                        }
                    }
                }
            }
        }

        // we use the contraints to find the mandatory contraints
        if (constraints && constraints.length > 0) {
            for (let i = 0; i < constraints.length; i++) {
                let curdesc = constraints[i].description;
                // mandatory exists constraint
                if (curdesc.indexOf(":" + aLabelorRelType + " ") > 0 && curdesc.indexOf("." + aProperty) > 0 && curdesc.indexOf("exists(") > 0) {
                    res = res + "M";
                }
                // node key
                if (curdesc.indexOf(":" + aLabelorRelType + " ") > 0 && curdesc.indexOf("." + aProperty) > 0 && curdesc.indexOf("IS NODE KEY") > 0) {
                    res = "N";
                }
            }
        }
        if (multiple) { res = res + "*"};
       // console.log("aLabelorRelType: " + aLabelorRelType + " aProperty: " + aProperty + " res:" + res);
        return res;
    }

    _arrayContains(arr, value) {
        let res = false;
        if (arr && arr.length > 0) {
            for (let i=0; i < arr.length; i++) {
                if (value == arr[i]) {
                    res = true;
                    break;
                }
            }
        }

        return res;
    }

    showSampleHelp() {
        let div = document.getElementById("helpDiv");
        if (div) {
            $('#helpModal').remove(); // clear helpModal
            div.innerHTML = "";
            let html = '<div class="ui small modal" id="helpModal">';
            html += "<i class=\"close icon\"></i>";
            html += "  <div class=\"header\">Sample Treshold</div>" ;
            html += "  <div class=\"content\">";
            html += '<p>Sampling is used to determine Label Combinations, Node Properties and Relationship Properties when the<br/> specific counts are higher than the Sample Treshold:</p>';
            html += '<div class="ui list">';
            html += '<div class="item"><div class="content"><div class="header">Label Combinations</div>';
            html += '<div class="description">When the Node Count is &gt; Sample Treshold then sampling is used</div>';
            html += '</div></div>';
            html += '<div class="item"><div class="content">';
            html += '<div class="header">Node Properties</div>';
            html += '<div class="description">When the Label Node Count is &gt; Sample Treshold then sampling is used</div>';
            html += '</div></div>';
            html += '<div class="item"><div class="content">';
            html += '<div class="header">Relationship Properties</div>';
            html += '<div class="description">When the Relationship Type Count is &gt; Sample Treshold then sampling is used</div>';
            html += '</div></div>';
            html += '</div>';

            html += '</div></div>';
            div.innerHTML = html;
            //console.log(html);
            $('#helpModal').modal('show');
        }
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



    async analyseDB( aSampleTreshold, aSampleSize, aRandomFactor, analyzeLabelProps, analyzeRelProps, analyzeLabelCombo) {
	    this.dbinfo = null;
        let repContainer = document.getElementById("appSummary");
        this._clear();

        let steps =11;
        // clear
        // doing the work here
        // first datastructure
        let date = new Date()
        let tStart = date.getTime();
        let reportName = "DatabaseOverview";
        // always check againg what is the current database?
        // init again
        let dd = await this.init();
        if (!this.graphdb) {
            this._clear();
            repContainer.innerHTML = "<div class='ui warning message'><div class='header'>WARNING</div><p>No active Database, start a database in the Neo4j Desktop first</p></div>";
            return;
        }
        let neoInstanceName = this.graphdb.name;

        let reportDate = this._getFormatedDate(date);
        let neoServer = this.neoHost;
        let neoUser = this.neoUser;
        let randomFactor = aRandomFactor;
        let sampleSize = aSampleSize;
        let constraints = [];
        let indexes = [];

        let nodeCount;
        let relationCount;
        let labelCounts = [];
        let relCounts = [];
        let storeSizes = {}; // this will be a map
        let labelCombinations = [];
        let sampleUsed = false;
        let apocAvailable = false;
        let relTypes = [];
        let processingTime;

        //
        // and now query for the report
        this._appendMessage(repContainer,  " Sample Treshold: " + aSampleTreshold);
        this._appendMessage(repContainer,  " Sample Size: " + aSampleSize);
        this._appendMessage(repContainer,  " Random Factor: " + aRandomFactor);
        this._appendMessage(repContainer,  " Analyze Node Properties: " + analyzeLabelProps, true);
        this._appendMessage(repContainer,  " Analyze Relationship Properties: " + analyzeRelProps);

        this._appendMessage(repContainer,  " Analyze Label Combinations: " + analyzeLabelCombo );

        let timeStart = Date.now();
        let analyzeStart = Date.now();
        try {

            // step zero check if there is db.schema() procedure in the database

            let rs = await this.nea.runQuery(this.session, "call db.schema() yield nodes as nodes return head(nodes) as fn ");
            let record = rs[0]; // we know it is always one
            // check if apoc is available

            rs = await this.nea.runQuery(this.session, "call dbms.functions() yield name as name " +
                "with name where name = 'apoc.metax.type' " +
                "return count(name) as cnt");
            apocAvailable = rs[0].get("cnt").toNumber() > 0;
            this._appendMessage(repContainer,  " APOC Available: " + apocAvailable);
            this._appendMessage(repContainer, "analyzing database (1/" + steps + "): Determining Store Sizes...", true);
            //
            // store size
            //
            let jmxStoreQuery = 'call dbms.queryJmx("org.neo4j:instance=kernel#0,name=Store sizes") yield attributes as data ' +
                'with data["CountStoreSize"] as css ' +
                ',    data["LabelStoreSize"] as lss ' +
                ',    data["IndexStoreSize"] as iss ' +
                ',    data["StringStoreSize"] as sss ' +
                ',    data["ArrayStoreSize"] as ass ' +
                ',    data["RelationshipStoreSize"] as rss ' +
                ',    data["PropertyStoreSize"] as pss ' +
                ',    data["TransactionLogsSize"] as tls ' +
                ',    data["SchemaStoreSize"] as schss ' +
                ',    data["TotalStoreSize"] as totalss ' +
                ',    data["NodeStoreSize"] as nss ' +
                'return css.value as countStoreSize ' +
                ',      lss.value as labelStoreSize ' +
                ',      iss.value as indexStoreSize ' +
                ',      sss.value as stringStoreSize ' +
                ',      ass.value as arrayStoreSize ' +
                ',      rss.value as relStoreSize ' +
                ',      pss.value as propStoreSize ' +
                ',      tls.value as logSize ' +
                ',      schss.value as schemaStoreSize ' +
                ',      totalss.value as totalStoreSize ' +
                ',      nss.value as nodeStoreSize ';

            let oldJmxStoreQuery = 'call dbms.queryJmx("org.neo4j:instance=kernel#0,name=Store file sizes") yield attributes as data ' +
                'with data["CountStoreSize"] as css ' +
                ',    data["LabelStoreSize"] as lss ' +
                ',    data["IndexStoreSize"] as iss ' +
                ',    data["StringStoreSize"] as sss ' +
                ',    data["ArrayStoreSize"] as ass ' +
                ',    data["RelationshipStoreSize"] as rss ' +
                ',    data["PropertyStoreSize"] as pss ' +
                ',    data["LogicalLogSize"] as tls ' +
                ',    data["SchemaStoreSize"] as schss ' +
                ',    data["TotalStoreSize"] as totalss ' +
                ',    data["NodeStoreSize"] as nss ' +
                'return coalesce(css.value,0) as countStoreSize ' +
                ',      coalesce(lss.value,0) as labelStoreSize ' +
                ',      coalesce(iss.value,0) as indexStoreSize ' +
                ',      sss.value as stringStoreSize ' +
                ',      ass.value as arrayStoreSize ' +
                ',      rss.value as relStoreSize ' +
                ',      pss.value as propStoreSize ' +
                ',      tls.value as logSize ' +
                ',      coalesce(schss.value,0) as schemaStoreSize ' +
                ',      totalss.value as totalStoreSize ' +
                ',      nss.value as nodeStoreSize ';


            rs = await this.nea.runQuery(this.session, jmxStoreQuery);
            record = rs[0]; // we know it is always one
            if (!record) {
                rs = await this.nea.runQuery(this.session, oldJmxStoreQuery);
                record = rs[0]; // we know it is always one
            }

            let arrayStoreSize = record.get("arrayStoreSize").toNumber();
            let logicalLogSize = record.get("logSize").toNumber();
            let nodeStoreSize = record.get("nodeStoreSize").toNumber();
            let propertyStoreSize = record.get("propStoreSize").toNumber();
            let relationshipStoreSize = record.get("relStoreSize").toNumber();
            let stringStoreSize = record.get("stringStoreSize").toNumber();
            let totalStoreSize = record.get("totalStoreSize").toNumber();
            //
            let countStoreSize = record.get("countStoreSize").toNumber();
            let labelStoreSize = record.get("labelStoreSize").toNumber();
            let indexStoreSize = record.get("indexStoreSize").toNumber();
            let schemaStoreSize = record.get("schemaStoreSize").toNumber();

            let propertyRelatedStoreSize = (propertyStoreSize + stringStoreSize + arrayStoreSize);
            let otherSpace = totalStoreSize - (nodeStoreSize + propertyStoreSize + relationshipStoreSize + stringStoreSize + arrayStoreSize + logicalLogSize + countStoreSize + labelStoreSize + indexStoreSize + schemaStoreSize);
            storeSizes = {
                "countStoreSize": countStoreSize,
                "labelStoreSize": labelStoreSize,
                "indexStoreSize": indexStoreSize,
                "schemaStoreSize": schemaStoreSize,
                "arrayStoreSize": arrayStoreSize,
                "logicalLogSize": logicalLogSize,
                "nodeStoreSize": nodeStoreSize,
                "propertyStoreSize": propertyStoreSize,
                "relationshipStoreSize": relationshipStoreSize,
                "stringStoreSize": stringStoreSize,
                "totalStoreSize": totalStoreSize,
                "otherSpace": otherSpace
            };
            //
            this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            //
            // call db.schema() yield nodes as nde unwind nde as nd return  nd
            //
            // node count
            // relationscounr
            // total node and relationcounts
            this._appendMessage(repContainer, "analyzing database (2/" + steps + "): Node Count...", true);

            rs = await this.nea.runQuery(this.session, "match (n) return count(n) as n");
            record = rs[0]; // we know it is always one
            nodeCount = record.get("n").toNumber();
            this._appendMessage(repContainer, nodeCount + " (" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            this._appendMessage(repContainer, "analyzing database (3/" + steps + "): Relationship Count...", true);

            rs = await this.nea.runQuery(this.session, "match ()-[r]->() return count(r) as n");
            record = rs[0]; // we know it is always one
            relationCount = record.get("n").toNumber();
            let useSample = false;
            let useRelationSample = false;
            this._appendMessage(repContainer, relationCount + "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            //
            // indexes
            //
            this._appendMessage(repContainer, "analyzing database (4/" + steps + "): Indexes...", true);
            rs = await this.nea.runQuery(this.session, "call db.indexes()");
            rs.forEach(function (rcd) {
                let lind = rcd.toObject();
                indexes.push(lind);
            });
            this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            //
            // constraints
            //
            this._appendMessage(repContainer, "analyzing database (5/" + steps + "): Constraints...", true);
            rs = await this.nea.runQuery(this.session, "call db.constraints()");
            rs.forEach(function (rcd) {
                let lind = rcd.toObject();
                constraints.push(lind);
            });
            this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            // reltypes
            this._appendMessage(repContainer, "analyzing database (6/" + steps + "): Relationship Types...", true);
            let relationShipTypes = await this.nea.getRelationshipTypes(this.session);
            //console.log(relationShipTypes);
            // rs = await this.nea.runQuery(this.session, "call db.relationshipTypes() yield relationshipType return relationshipType");
            relationShipTypes.forEach(function (rcd) {
                relTypes.push({
                    type: rcd,
                    propertyCombinations: [],
                    allProperties: []
                });
            });
            this._appendMessage(repContainer, relTypes.length + " (" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            // labels
            this._appendMessage(repContainer, "analyzing database (7/" + steps + "): Labels and label counts...", true);
            let lbls = await this.nea.getLabels(this.session);
            lbls.forEach(function (rcd) {
                // also initialize here
                let lc = {
                    label: rcd,
                    outgoingRelations: [],
                    incomingRelations: [],
                    propertyCombinations: [],
                    allProperties: []
                };
                labelCounts.push(lc);
            });
            //
            // now the label counts
            //
            let ii;
            for (ii = 0; ii < labelCounts.length; ii++) {
                let q1 = "match (n:`" + labelCounts[ii].label + "`) return count(n) as cnt";
                rs = await this.nea.runQuery(this.session, q1);
                labelCounts[ii].count = rs[0].get("cnt").toNumber();
            }
            this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();
            this._appendMessage(repContainer, "analyzing database (8/" + steps + "): Labels and outgoing/incoming relationship types and their counts...", true);
            //
            // get the relations per label
            //
            //
            let schemaNodes = null;
            let schemaRels = null;

            // rs = await this.nea.runQuery(this.session, "call db.schema() yield relationships as rels " +
            //     "unwind rels as rel " +
            //     "with  startNode(rel)  as startNode, type(rel) as relType, endNode(rel) as endNode " +
            //     "return startNode, relType, endNode, id(startNode) as snId, id(endNode) as enId")

            rs = await this.nea.runQuery(this.session, "call db.schema() yield relationships , nodes " +
                "with reduce(s = [], x IN nodes | s + [{nid: id(x), node: x}]) as nodeList " +
                ",    reduce(r = [], y IN relationships | r + [{ startNode : startNode(y), snId: id(startNode(y)), type: type(y), endNode: endNode(y), enId : id(endNode(y))}]) as relList " +
                "return nodeList, relList");

            let rpos;
            schemaNodes = rs[0].get("nodeList");
            schemaRels = rs[0].get("relList");

            for (rpos = 0; rpos < schemaRels.length; rpos++) {
                let recr = schemaRels[rpos];
                let startNode = recr.startNode.properties.name;

                let relType = recr.type.toString();
                let endNode = recr.endNode.properties.name; // this is a bit awkward because db.schema don't give a real node back.

                let ii;
                for (ii = 0; ii < labelCounts.length; ii++) {
                    // check for start label
                    if (startNode == labelCounts[ii].label) {
                        this._addRelation(labelCounts[ii].outgoingRelations, startNode, relType);
                    }

                    // check for end label
                    if (endNode == labelCounts[ii].label) {
                        this._addRelation(labelCounts[ii].incomingRelations, endNode, relType);
                    }
                }
            }
            //
            // count now the relations per label
            //
            let iii;
            for (iii = 0; iii < labelCounts.length; iii++) {
                // outgoing relation count
                if (labelCounts[iii].outgoingRelations.length > 0) {
                    let a;
                    for (a = 0; a < labelCounts[iii].outgoingRelations.length; a++) {
                        let q = "MATCH (:`" + labelCounts[iii].label + "`)-[r:`" + labelCounts[iii].outgoingRelations[a].type + "`]->() RETURN count(r)";
                        rs = await this.nea.runQuery(this.session, q);
                        labelCounts[iii].outgoingRelations[a].count = rs[0].get(0).toNumber();
                    }
                }
                // incoming relation count
                if (labelCounts[iii].incomingRelations.length > 0) {
                    let a;
                    for (a = 0; a < labelCounts[iii].incomingRelations.length; a++) {
                        let q = "MATCH (:`" + labelCounts[iii].label + "`)<-[r:`" + labelCounts[iii].incomingRelations[a].type + "`]-() RETURN count(r)";
                        rs = await this.nea.runQuery(this.session, q);
                        labelCounts[iii].incomingRelations[a].count = rs[0].get(0).toNumber();
                    }
                }
            }
            this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            this._appendMessage(repContainer, "analyzing database (9/" + steps + "): Label properties...", true);
            //
            // Label Properties
            //
            if (analyzeLabelProps && analyzeLabelProps == true) {
                let b;
                for (b = 0; b < labelCounts.length; b++) {
                    useSample = false;
                    if (this.labelFilter.includes(labelCounts[b].label)) {
                        this._appendMessage(repContainer, "--(" + (b + 1) + "/" + labelCounts.length + ") Node properties for Label  " + labelCounts[b].label, true);


                        if (labelCounts[b].count > aSampleTreshold) useSample = true;
                        labelCounts[b].nodePropsSampleUsed = useSample;

                        let qp = "MATCH (n:`" + labelCounts[b].label + "`) return keys(n), count(n) as cnt";
                        if (useSample) {
                            qp = "MATCH (n:`" + labelCounts[b].label + "`) where rand() < " + randomFactor + " with n limit " + sampleSize + " return keys(n), count(n) as cnt";
                        }
                        rs = await this.nea.runQuery(this.session, qp);
                        let cc;
                        for (cc = 0; cc < rs.length; cc++) {
                            this._addPropKeyList(labelCounts[b].propertyCombinations, rs[cc].get(0), rs[cc].get(1));
                            // console.log(rs[cc]);
                        }

                        // all Properties
                        let allProps = [];
                        let pc;
                        for (pc = 0; pc < labelCounts[b].propertyCombinations.length; pc++) {
                            let pcc;
                            for (pcc = 0; pcc < labelCounts[b].propertyCombinations[pc].pc.length; pcc++) {
                                let propje = labelCounts[b].propertyCombinations[pc].pc[pcc];
                                if (!allProps.includes(propje)) {
                                    allProps.push(propje);
                                }
                            }
                        }
                        // now we have the unique props per label now we are gonna query for the type
                        let allp;
                        let propTypes = [];
                        for (allp = 0; allp < allProps.length; allp++) {
                            let prp = allProps[allp];
                            // WHEN APOC is available we can do this
                            // MATCH (n:`ReferenceTherapeutic`) where exists(n.`schemaClass`) return apoc.meta.type(n.`schemaClass`) limit 1


                            if (apocAvailable) {
                                rs = await this.nea.runQuery(this.session, "MATCH (n:`" + labelCounts[b].label + "`) where exists(n.`" + prp + "`) return apoc.meta.type(n.`" + prp + "`) limit 1");
                                propTypes.push(prp + " - " + rs[0].get(0) + " - " + this._schemaColumn(labelCounts[b].label, prp, indexes, constraints));
                            } else {
                                rs = await this.nea.runQuery(this.session, "MATCH (n:`" + labelCounts[b].label + "`) where exists(n.`" + prp + "`) return n.`" + prp + "` limit 1");
                                propTypes.push(prp + " - " + this._getValType(rs[0].get(0)) + " - " + this._schemaColumn(labelCounts[b].label, prp, indexes, constraints));
                            }
                        }
                        labelCounts[b].allProperties = propTypes;
                    }
                }
                this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            } else {
                this._appendMessage(repContainer, "analyzing label properties switched off", false);
            }
            timeStart = Date.now();

            //
            // Label Combinations
            //
            this._appendMessage(repContainer, "analyzing database (10/" + steps + "): Label Combinations and their counts...", true);
            let labelCombinationSampleUsed = false;
            if (analyzeLabelCombo && analyzeLabelCombo == true) {
                let labelCombinationQuery = "match (n) where size(labels(n)) > 1 return distinct labels(n) as labellist";
                useSample = false;
                if (nodeCount > aSampleTreshold) useSample = true;

                labelCombinationSampleUsed = useSample;
                if (useSample) {
                    labelCombinationQuery = "match (n) where rand() < " + aRandomFactor + " and size(labels(n)) > 1  with n limit " + aSampleSize + " return distinct labels(n) as labellist";
                }
                rs = await this.nea.runQuery(this.session, labelCombinationQuery);
                let lcc;
                for (lcc = 0; lcc < rs.length; lcc++) {
                    labelCombinations.push({labels: rs[lcc].get(0)})
                }
                // label combination counts
                let lcom;
                for (lcom = 0; lcom < labelCombinations.length; lcom++) {
                    let vraag = "match (n) ";
                    let andWhere = "where";
                    let alc;
                    for (alc = 0; alc < labelCombinations[lcom].labels.length; alc++) {
                        vraag += andWhere + " n:`" + labelCombinations[lcom].labels[alc];
                        andWhere = "` and";
                    }
                    vraag += "` RETURN count(n)";
                    rs = await this.nea.runQuery(this.session, vraag);
                    labelCombinations[lcom].count = rs[0].get(0).toNumber();
                }
                this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            } else {
                this._appendMessage(repContainer, "analyze label combinations switch off", false);
            }
            timeStart = Date.now();

            this._appendMessage(repContainer, "analyzing database (11/" + steps + "): Relationship counts, and properties ...", true);
            // relationship counts
            // it is bad to do queries like these
            //   match ()-[r:REL_TYPE]->() return keys(r), count(r)
            // we know however we know the Labels and their outgoing relationship type
            // we are now creating a temporary Map structure where the key it hs relationship type, and the value
            // is an array of label(combinations)  ['label1','label3|label4'...
            // not that a label can only be there once!!
            let labelOutRelMap = new Map();
            for (iii = 0; iii < labelCounts.length; iii++) {
                // outgoing relation count
                if (labelCounts[iii].outgoingRelations.length > 0) {
                    let a;
                    for (a = 0; a < labelCounts[iii].outgoingRelations.length; a++) {
                        let relType = labelCounts[iii].outgoingRelations[a].type;
                        let label = labelCounts[iii].label;
                        //let cnt = labelCounts[iii].outgoingRelations[a].count;
                        if (labelOutRelMap.get(relType)) {
                            // exists
                            let val = labelOutRelMap.get(relType);
                            // append the current label
                            // if it is not already there
                            if (val.indexOf("|" + label) == -1) {
                                // does not exists yet
                                val = val + "|" + label;
                            }


                            labelOutRelMap.set(relType, val);

                        } else {
                            // not exists
                            let empty;
                            labelOutRelMap.set(relType, "|" + label);
                        }
                    }
                }
            }

            let rcn;
            for (rcn = 0; rcn < relTypes.length; rcn++) {
                let vraag = "match ()-[r:`" + relTypes[rcn].type + "`]->() return count(r)";

                rs = await this.nea.runQuery(this.session, vraag);
                relTypes[rcn].count = rs[0].get(0).toNumber();


                if (analyzeRelProps) {
                    if (this.relTypeFilter.includes(relTypes[rcn].type)) {

                        if (aSampleTreshold < relTypes[rcn].count) {
                            useRelationSample = true;
                        } else {
                            useRelationSample = false;
                        }
                        relTypes[rcn].sampleUsed = useRelationSample;


                        let labels = labelOutRelMap.get(relTypes[rcn].type).substring(1).split("|");
                        let rpvraag = "";
                        for (let li = 0; li < labels.length; li++) {
                            if (li == 0) {
                                if (useRelationSample) {
                                    rpvraag = "match (n)-[r:`" + relTypes[rcn].type + "`]->() where rand() < " + randomFactor + " and ( n:`" + labels[li] + "` ";
                                } else {
                                    rpvraag = "match (n)-[r:`" + relTypes[rcn].type + "`]->() where ( n:`" + labels[li] + "` ";
                                }
                            } else {
                                rpvraag += " OR n:`" + labels[li] + "` ";
                            }
                        }
                        if (useRelationSample) {
                            rpvraag += ") with r limit " + aSampleSize + " return keys(r), count(r) ";
                        } else {
                            rpvraag += ") return keys(r), count(r) ";
                        }
                        // relationship properties
                        this._appendMessage(repContainer, "--(" + (rcn + 1) + "/" + relTypes.length + ") relationship properties for relationship " + relTypes[rcn].type + " and Label: " + labels, true);
                        rs = await this.nea.runQuery(this.session, rpvraag);
                        let cc;
                        for (cc = 0; cc < rs.length; cc++) {
                            this._addPropKeyList(relTypes[rcn].propertyCombinations, rs[cc].get(0), rs[cc].get(1));
                        }
                        // all properties
                        let allRelProps = [];
                        let pc;
                        for (pc = 0; pc < relTypes[rcn].propertyCombinations.length; pc++) {
                            let pcc;
                            for (pcc = 0; pcc < relTypes[rcn].propertyCombinations[pc].pc.length; pcc++) {
                                let propje = relTypes[rcn].propertyCombinations[pc].pc[pcc];
                                if (!allRelProps.includes(propje)) {
                                    allRelProps.push(propje);
                                }
                            }
                        }
                        // adding prop types
                        let allp;
                        let relPropTypes = [];
                        for (allp = 0; allp < allRelProps.length; allp++) {
                            let prp = allRelProps[allp];
                            // this must be done better
                            let rptq = "";
                            for (let li = 0; li < labels.length; li++) {
                                if (li == 0) {
                                    rptq = "match (n)-[r:`" + relTypes[rcn].type + "`]->() where ( n:`" + labels[li] + "` ";
                                } else {
                                    rptq += " OR n:`" + labels[li] + "` ";
                                }
                            }
                            rptq += " ) and exists(r.`" + prp + "`) return r.`" + prp + "` limit 1";
                            rs = await this.nea.runQuery(this.session, rptq);
                            let val = rs[0].get(0);


                            relPropTypes.push(prp + " - " + this._getValType(val) + " - " + this._schemaColumn(relTypes[rcn].type, prp, indexes, constraints));
                        }
                        relTypes[rcn].allProperties = relPropTypes;
                    }

                }
            }
            this._appendMessage(repContainer, " step 11 has taken " + (Date.now() - timeStart) + " ms.", true);
            this._appendMessage(repContainer, " Analyzing the database has taken " + (Date.now() - analyzeStart) + " ms.", true);

            let complexityScore = (labelCounts.length + relTypes.length) * (relationCount / nodeCount);
            // console.log("ComplexityScore: " + complexityScore);

            this.dbinfo = {
                reportName: reportName,
                reportDate: reportDate,
                neoServer: neoServer,
                neoInstanceName: neoInstanceName,
                neoUser: neoUser,
                nodeCount: nodeCount,
                relationCount: relationCount,
                storeSizes: storeSizes,
                labelCounts: labelCounts,
                labelCombinations: labelCombinations,
                relTypes: relTypes,
                relCounts: relCounts,
                indexes: indexes,
                constraints: constraints,
                labelCombinationSampleUsed: labelCombinationSampleUsed,
                analyzeRelProps: analyzeRelProps,
                analyzeLabelProps: analyzeLabelProps,
                analyzeLabelCombo: analyzeLabelCombo,
                schemaNodes : schemaNodes,
                schemaRels : schemaRels,
                complexityScore : complexityScore
            };

            // enable tab's
            this._enableElement("modelwalker");
        } catch(error) {
           console.log(error);
        };
        return await this.nea.runQuery(this.session, "return 1 as n");
    }
    _getObjectType(aVal) {
        let typ =  typeof aVal;
        if (neo4j.v1.isInt(aVal)) {
            typ = "Integer";
        } else if (neo4j.v1.isDate(aVal)) {
            typ = "Date";
        } else if (neo4j.v1.isDateTime(aVal)) {
            typ = "ZonedDateTime"
        } else if (neo4j.v1.isLocalDateTime(aVal)) {
            typ = "LocalDateTime"
        } else if (neo4j.v1.isPoint(aVal)) {
            typ = "PointValue"
        } else if (neo4j.v1.isTime(aVal)) {
            typ = "Time"
        } else if (neo4j.v1.isLocalTime(aVal)) {
            typ = "LocalTime"
        } else if (typ == "number") {
            typ = "Float"
        } else if (typ == "string") {
            typ = "String"
        }
        return typ;
    }

    _getValType(aVal) {
        // return the type of the object
        // STRING, NUMBER,
        let typ = typeof aVal;
        if (typ == 'object') {
            if (Array.isArray(aVal)) {
                if (aVal.length > 0) {

                    //typ = typeof aVal[0];

                    typ = this._getObjectType(aVal[0]) + "[]";

                } else {
                    typ = "";
                }
            } else {
                typ = this._getObjectType(aVal);
            }
        } else if ( typ == 'string') {
            typ = "String";
        } else if ( typ == "number") {
            typ = "Float";
        }
        return typ;

    }




    _addPropKeyList(masterList, newList, count) {
	    // order the list
        newList.sort();
        let found = false;
        if (masterList.length > 0) {
            let n;
            for (n = 0 ; n < masterList.length; n++) {
                let curList = masterList[n].pc;
                if (newList.length == curList.length) {
                    let cnt = 0;
                    let ni;
                    for (ni = 0; ni < newList.length; ni++) {
                        if (curList.includes(newList[ni])) {
                            cnt++;
                        }
                    }
                    if (cnt == newList.length) {
                        let calccnt = masterList[n].cnt + count.low;
                        masterList[n].cnt = calccnt;
                        found = true;
                    }

                }
            }
        }

        if (!found) {
            masterList.push({pc :newList, cnt: count.low});
        }
    }


    _addRelation(aRelList, aLabel, aRelType) {
	    if (aRelList.length > 0 ) {
	        // if it already exists do nothing
            let found = false;
            let it = 0;
            for (it = 0 ; it < aRelList.length; it++ ) {
                if (aRelType == aRelList[it].type ) {
                    found = true;
                    break;
                }
            }

            if (!found) {

                aRelList.push({ type : aRelType , count : 0});
            }
        } else {
            aRelList.push({ type : aRelType , count : 0});
        }
    }


    _clear() {
        //
        // clear everything
        //
        document.getElementById("appSummary").innerHTML = "";
        document.getElementById("appLog").innerHTML = "";
        document.getElementById("appLabelDetails").innerHTML= "";
        document.getElementById("appLabelCombinations").innerHTML = "";
        document.getElementById("appRelationshipDetails").innerHTML = "";
        document.getElementById("reportHeader").innerHTML = "";
        document.getElementById("appIndexes").innerHTML = "";
        document.getElementById("appConstraints").innerHTML = "";
        //
        // Make Summary the active tab again
        //
        $('.menu .item').tab("change tab", "first");

    }


    async runReport(aSampleTreshold, aSampleSize, aData) {
        let tabSummary = document.getElementById("appSummary");
        let tabLabelDetails = document.getElementById("appLabelDetails");
        let tabLabelCombinations = document.getElementById("appLabelCombinations");
        let tabRelationshipDetails = document.getElementById("appRelationshipDetails");
        let reportHeader = document.getElementById("reportHeader");
        let tabIndexes = document.getElementById("appIndexes");
        let tabConstraints = document.getElementById("appConstraints");
        let tabLiveCountContainer = document.getElementById("appLiveCountContainer");

		let rdat;
		if (aData) {
			rdat = aData;
		} else {
		    // nothing to do
            return;
		}
		// clear
        let reportLog = tabSummary.innerHTML;
        this._clear();
        document.getElementById("appLog").innerHTML = reportLog;
        //
        // Summary
        //

        let headerhtml = "";
        let summaryhtml = "";
        let labeldetailhtml = "";
        let labelcombohtml = "";
        let relationshipdetailhtml = "";
        let indexeshtml = "";
        let constraintshtml = "";

        // header
        headerhtml += "<table><tr>";
        headerhtml += "<td><div class='ui message'><div class='header'>Report</div><p>" + rdat.reportName  + ' for instance ' + rdat.neoInstanceName + "&nbsp;</p></div></td>";
        headerhtml += "<td><div class='ui message'><div class='header'>Date</div><p>" + rdat.reportDate + "</p></div></td>";
        headerhtml += "<td><div class='ui message'><div class='header'>Neo4j Server</div><p>" + rdat.neoServer + "</p></div></td>";
        headerhtml += "<td><div class='ui message'><div class='header'>Neo4j User</div><p>" + rdat.neoUser + "</p></div></td>";




        // global totals
//		html += "<br/>Database Totals<hr/>";
        //summaryhtml += "<table>";
        headerhtml += "<td><div class='ui yellow message'><div class='header'>Node Count</div><p>" + rdat.nodeCount + "</p></div></td>";
        headerhtml += "<td><div class='ui yellow message'><div class='header'>Relationship Count</div><p>" + rdat.relationCount   + "</p></div></td>";
        headerhtml += "<td><div class='ui yellow message'><div class='header'>Label Count</div><p>" + rdat.labelCounts.length   + "</p></div></td>";
        headerhtml += "<td><div class='ui yellow message'><div class='header'>Relationship Type Count</div><p>" + rdat.relTypes.length   + "</p></div></td>";
        if (aData.analyzeLabelCombo && aData.analyzeLabelCombo == true) {
            headerhtml += "<td><div class='ui yellow message'><div class='header'>Label Combinations</div><p>" + rdat.labelCombinations.length + "</p></div></td>";
        }
        headerhtml += "</tr></table>";
        headerhtml += "";
        //summaryhtml += "</table>";

        let chartrels = [];
        let chartrelseries = [];


        // chart with labels and counts here
        summaryhtml += "<br/>Label Counts<hr/>";

        // put here only the container
        // calculate the width based on the amount of labels 100xp per label

        summaryhtml += "<div id='chart1' syle='height: 200px'></div>";

        // chart with relationship and counts here
        summaryhtml += "<br/>Relationship Type Counts<hr/>";
        summaryhtml += "<div id='chart2' syle='height: 200px'></div>";
        // put here only the container





        // Relationship details
        // relationship types
        // if (aData.relationSampleUsed) {
        //     relationshipdetailhtml += "<table style='width: 100%; table-layout: fixed'><tr><td><div class='ui yellow message'><div class='header'>Samples are only used to find the relationship properties and property combinations</div><p></p></td></tr></table></div>"
        // }
        relationshipdetailhtml += "<table style='width: 100%; table-layout: fixed'><tr><td style='word-wrap: normal; line-height: 30px; '>";
        let rtypecnt = 0;
        for (rtypecnt = 0; rtypecnt < rdat.relTypes.length; rtypecnt++) {
            let elm = rdat.relTypes[rtypecnt];
            //console.log(elm);
            //console.log('---');

            if (elm.allProperties && elm.allProperties.length > 0) {
                relationshipdetailhtml += "<table style='width: 100%'><tr><td onclick='let d = document.getElementById(\"" + elm.type + "_dr\"); let dce = document.getElementById(\"" + elm.type + "_drce\"); if (d.style.visibility == \"collapse\") { d.style.visibility = \"visible\"; d.style.height = \"auto\"; dce.src = \"collapse-arrow.png\"} else { d.style.visibility = \"collapse\"; d.style.height = \"0px\"; dce.src = \"expand-arrow.png\" }   '    ><div class='ui positive message'><div class='header'><table width='100%'><tr><td width='200px'>" + elm.type + "</td><td align='right'><img src='expand-arrow.png' width='12px' id='" + elm.type + "_drce'/></td></tr></table></div><p>" + elm.count + "</p></div></tr></table>"
                relationshipdetailhtml += "<div style='visibility: collapse; height: 0px' id='" + elm.type + '_dr' + "'>";
                relationshipdetailhtml += "<table class='ui celled table'><thead><tr><th style='width: 50px'></th><th style='width: 250px;'>All Properties</th><th>Property Combinations</th></tr></thead><tbody><tr>";
                // property table property name and type
                relationshipdetailhtml += "<td style='width: 50px'></td><td valign='top'>";
                //
                //
                relationshipdetailhtml += "<table>";

                relationshipdetailhtml += "<tr><td style='width: 150px'>Property</td><td style='width: 100px;'>Type</td><td style='width: 30px;'></td></tr>";

                elm.allProperties.forEach(function (plist) {
                    let vls = plist.split('-');
                    if (vls.length == 3) {
                        relationshipdetailhtml += "<tr><td>" + vls[0] + "</td><td>" + vls[1] + "</td><td>" + vls[2] + "</td></tr>";

                    } else {
                        relationshipdetailhtml += "<tr><td>" + vls[0] + "</td><td>" + vls[1] + "</td><td></td></tr>";
                    }
                });

                relationshipdetailhtml += "</table>";
                relationshipdetailhtml+= "</td>"

                relationshipdetailhtml+= "<td valign='top'>";
                if (elm.allProperties && elm.allProperties.length > 0) {
                    relationshipdetailhtml += "<table style='table-layout: fixed'>";
                    elm.propertyCombinations.forEach( function (prl) {
                        let plist = "" + prl.pc;
                        let pcount = prl.cnt;
                        if (elm.sampleUsed) {
                            relationshipdetailhtml += "<tr><td style='border-style: groove; style='word-wrap: normal; line-height: 30px; '>" + plist.replace(',' ,', ') + "&nbsp;</td></tr>";
                        } else {
                            relationshipdetailhtml += "<tr><td style='border-style: groove; style='word-wrap: normal; line-height: 30px; '>" + plist.replace(',' ,', ') + "&nbsp;|&nbsp;" + pcount + "</td></tr>";
                        }
                    });
                    relationshipdetailhtml += "</table>";
                }

                relationshipdetailhtml+= "</td>"

                relationshipdetailhtml += "</tr></tbody></table>";
                relationshipdetailhtml += "</div>";

            } else {
                relationshipdetailhtml += "<table style='width: 100%'><tr><td><div class='ui positive message'><div class='header'>" + elm.type  + "</div><p>" + elm.count + "</p></div></td></tr></table>"
            }
            chartrels.push(elm.type);
            chartrelseries.push(elm.count);
            //html += "" + hc;
        }

        relationshipdetailhtml += "</td></tr></table>";




        // Label Details

        this.chartlabels = [];
        this.chartseries = [];
        let current = this;
        rdat.labelCounts.forEach( function(labcnt) {
            current.chartlabels.push(labcnt.label);
            current.chartseries.push(labcnt.count);
            labeldetailhtml += "<table style='width: 100%'><tr><td onclick='let d = document.getElementById(\"" + labcnt.label + "_d\"); let dce = document.getElementById(\"" + labcnt.label + "_dce\"); if (d.style.visibility == \"collapse\") { d.style.visibility = \"visible\"; d.style.height = \"auto\"; dce.src = \"collapse-arrow.png\"} else { d.style.visibility = \"collapse\"; d.style.height = \"0px\"; dce.src = \"expand-arrow.png\" }   '    ><div class='ui positive message'><div class='header'><table width='100%'><tr><td width='200px'>" +  labcnt.label + "</td><td align='right'><img src='expand-arrow.png' width='12px' id='" + labcnt.label + "_dce'/></td></tr></table></div><p>" + labcnt.count + "</p></div></td></tr></table>"
            labeldetailhtml += "<div style='visibility: collapse; height: 0px' id='" + labcnt.label + '_d' + "'>";
            labeldetailhtml += "<table class='ui celled table'><thead><tr><th style='width: 50px'></th><th style='width: 250px;'>Outgoing Relations</th><th style='width: 250px;'>Incoming Relations</th><th style='width: 250px;'>All Properties</th><th>Property Combinations</th></tr></thead><tr>";
        	// property table property name and type
            labeldetailhtml += "<td style='width: 50px'></td><td valign='top'>";

			// colOne start

            if (labcnt.outgoingRelations) {
                labeldetailhtml += "<table>";
                labcnt.outgoingRelations.forEach( function (rcn) {
                    labeldetailhtml += "<tr><td>" + rcn.type + "</td><td>" + rcn.count + "</td></tr>";
                });
                labeldetailhtml += "</table>";
            }


            labeldetailhtml += "</td>"

            // colOne end
			// propery combinations
            labeldetailhtml += "<td valign='top'>";

            // incoming relations table
            if (labcnt.incomingRelations) {
                labeldetailhtml += "<table>";
                labcnt.incomingRelations.forEach( function (rcn) {
                    labeldetailhtml += "<tr><td>" + rcn.type + "</td><td>" + rcn.count + "</td></tr>";
                });
                labeldetailhtml += "</table>";
            }


            labeldetailhtml += "</td>";
            labeldetailhtml+= "<td valign='top'>";

			// All properties
            labeldetailhtml += "<table>";
            labeldetailhtml += "<tr><td style='width: 150px'>Property</td><td style='width: 100px;'>Type</td><td style='width: 30px;'></td></tr>";
            labcnt.allProperties.forEach( function(plist) {
                let vls = plist.split('-');
                if (vls.length == 3) {
                    labeldetailhtml += "<tr><td>" + vls[0] + "</td><td>" + vls[1] + "</td><td>" + vls[2] + "</td></tr>";

                } else {
                    labeldetailhtml += "<tr><td>" + vls[0] + "</td><td>" + vls[1] + "</td><td></td></tr>";
                }
            });

            labeldetailhtml += "</table>";


            labeldetailhtml+= "</td>"
            labeldetailhtml+= "<td valign='top'>";

            if (labcnt.propertyCombinations) {
                labeldetailhtml += "<table style='table-layout: fixed''>";
                labcnt.propertyCombinations.forEach( function (prl) {
                    let plist = "" + prl.pc;
                    let pcount = prl.cnt;

                    if (labcnt.nodePropsSampleUsed) {
                        labeldetailhtml += "<tr '><td style='border-style: groove; style='word-wrap: normal; line-height: 30px; '>" + plist.replace(',' ,', ') + "</td></tr>";
                    } else {
                        labeldetailhtml += "<tr '><td style='border-style: groove; style='word-wrap: normal; line-height: 30px; '>" + plist.replace(',' ,', ') + "|" + pcount + "</td></tr>";
                    }
                });
                labeldetailhtml += "</table>";
            }



            labeldetailhtml+= "</td>"


            labeldetailhtml += "</tr></table>";
            labeldetailhtml += "</div>";
		});

        if (aData.labelCombinationSampleUsed) {
            labelcombohtml += "<table style='width: 100%; table-layout: fixed'><tr><td><div class='ui yellow message'><div class='header'>Samples are only used to find Label Combinations, not to count them.</div><p></p></td></tr></table>";
        }
		// label combinations if any
        if (rdat.labelCombinations && rdat.labelCombinations.length > 0) {
            //console.log(" Label combinations length: " + rdat.labelCombinations.length)
        	for (let i = 0 ; i < rdat.labelCombinations.length; i++) {
        	    let labcom = rdat.labelCombinations[i];
        	    if (i == 0) {
        	        labelcombohtml += "<div class='ui five column grid'>";
                }
                let lcs = "" + labcom.labels;
        	    // 10 april 2019 fix comma in the label combo box
                labelcombohtml += "<div class='column'><div class='ui teal message'><div class='header'>" + lcs.split(",").join(', ') + "</div><p>" + labcom.count + "</p></div></div>";
            }
            labelcombohtml += "</div>";
        } else {  git
            labelcombohtml = "no label combinations detected"
        }


		// store info
        summaryhtml += "<br/>Store Info (total store size: " + this._byteToMb(rdat.storeSizes.totalStoreSize) +" M)<hr/>";

        // summaryhtml += "<table><tr valign='top'><td>";
        summaryhtml += "<div id='piec'></div>";

        // store info details

        // html += ("</td></tr>");
//        summaryhtml += "<div style='height : 200px'></div>";


        //
        // tabIndexes
        //
        if (aData.indexes && aData.indexes.length > 0) {
            for (let i = 0 ; i < aData.indexes.length; i++) {
                let curi = aData.indexes[i];
                if (curi.provider) {
                    // provides and multiple field indexes are possible
                    // description, state, type and provider
                    if (i == 0) {
                        // header
                        indexeshtml += "<table class='ui celled table'><thead><tr><th style='width: 450px;'>Description</th><th style='width: 150px;'>State</th><th style='width: 250px;'>Type</th><th>Provider</th></tr></thead><tr>";
                    }
                    indexeshtml += "<tr>";
                    indexeshtml += "<td>";
                    indexeshtml += curi.description;
                    indexeshtml += "</td>";
                    indexeshtml += "<td>";
                    indexeshtml += curi.state;
                    indexeshtml += "</td>";
                    indexeshtml += "<td>";
                    indexeshtml += this._indexType(curi.type);
                    indexeshtml += "</td>";
                    indexeshtml += "<td>";
                    indexeshtml += curi.provider.key + " (version: " + curi.provider.version + ")";
                    indexeshtml += "</td>";

                    indexeshtml += "</tr>";
                } else {
                    // only description state and type are available
                    if (i == 0) {
                        indexeshtml += "<table class='ui celled table'><thead><tr><th style='width: 450px;'>Description</th><th style='width: 150px;'>State</th><th style='width: 250px;'>Type</th></tr></thead><tr>";
                    }
                    indexeshtml += "<tr>";
                    indexeshtml += "<td>";
                    indexeshtml += curi.description;
                    indexeshtml += "</td>";
                    indexeshtml += "<td>";
                    indexeshtml += curi.state;
                    indexeshtml += "</td>";
                    indexeshtml += "<td>";
                    indexeshtml += this._indexType(curi.type);
                    indexeshtml += "</td>";
                    indexeshtml += "</tr>";
                }
            }
            indexeshtml += "</table>";
        } else {
            indexeshtml = "No indexes defined."
        }

        //
        // tabConstraints
        //
        if (aData.constraints && aData.constraints.length > 0) {
            for (let i = 0 ; i < aData.constraints.length; i++) {
                let curi = aData.constraints[i];
                if (i == 0) {
                    // header
                    constraintshtml += "<table class='ui celled table'><thead><tr><th style='width: 250px;'>Type</th><th>Description</th></tr></thead><tr>";
                }
                constraintshtml += "<tr>";
                constraintshtml += "<td>";
                constraintshtml += this._getConstraintType(curi.description);
                constraintshtml += "</td>";
                constraintshtml += "<td>";
                constraintshtml += curi.description;
                constraintshtml += "</td>";
                constraintshtml += "</tr>";
            }
            constraintshtml += "</table>";
        } else {
            constraintshtml = "No constraints defined."
        }

        reportHeader.innerHTML = headerhtml;
        tabSummary.innerHTML = summaryhtml;
        tabLabelDetails.innerHTML = labeldetailhtml;
        tabLabelCombinations.innerHTML = labelcombohtml;
        tabRelationshipDetails.innerHTML = relationshipdetailhtml;
        tabIndexes.innerHTML = indexeshtml;
        tabConstraints.innerHTML = constraintshtml;


        let pie = c3.generate({bindto: '#piec',size: {
                width: 800
            },
            data: {
                // iris data from R
                columns: [
                    ['nodeStoreSize (' + this._byteToMb(rdat.storeSizes.nodeStoreSize) + ' M)' , rdat.storeSizes.nodeStoreSize],
                    ['relationshipStoreSize (' + this._byteToMb(rdat.storeSizes.relationshipStoreSize) + ' M)', rdat.storeSizes.relationshipStoreSize],
                    ['propertyStoreSize (' + this._byteToMb(rdat.storeSizes.propertyStoreSize) + ' M)', rdat.storeSizes.propertyStoreSize],
                    ['arrayStoreSize (' + this._byteToMb(rdat.storeSizes.arrayStoreSize) + ' M)', rdat.storeSizes.arrayStoreSize],
                    ['countStoreSize (' + this._byteToMb(rdat.storeSizes.countStoreSize) + ' M)', rdat.storeSizes.countStoreSize],
                    ['labelStoreSize (' + this._byteToMb(rdat.storeSizes.labelStoreSize) + ' M)', rdat.storeSizes.labelStoreSize],
                    ['indexStoreSize (' + this._byteToMb(rdat.storeSizes.indexStoreSize) + ' M)', rdat.storeSizes.indexStoreSize],
                    ['schemaStoreSize (' + this._byteToMb(rdat.storeSizes.schemaStoreSize) + ' M)', rdat.storeSizes.schemaStoreSize],
                    ['logicalLogSize (' + this._byteToMb(rdat.storeSizes.logicalLogSize) + ' M)', rdat.storeSizes.logicalLogSize],
                    ['otherSpace(' + this._byteToMb(rdat.storeSizes.otherSpace) + ' M)', rdat.storeSizes.otherSpace]
                ],
                type : 'pie'
            }
        });

        this.logScale = document.getElementById("useLogScaleCnt").checked;
        // colorscale for Relationship Types
        let colorScale = d3.scaleOrdinal(d3.schemeCategory10);


        let labelcseries = this.chartseries;

        // now C3 label counts
        if (this.logScale) {
            let logdata = [];
            for (let i= 0; i < this.chartseries.length; i++) {
                let val = this.chartseries[i];
                if (val > 0) {
                    logdata[i] = Math.log10(val);
                } else if ( val == 0) {
                    logdata[i] = 0;
                } else if (val < 0) {
                    logdata[i] = -1 * (Math.log10(val));
                }
            }
            labelcseries =  logdata;
        }
        // this.chartseries

        let crchart1 = c3.generate({
            bindto: '#chart1',
            data : { columns :[
                               ['count'].concat(labelcseries)
                         ],
                    type: 'bar',
                    color: function(inColor, data) {
                        if(data.index !== undefined) {
                            return lcm.getLabelColor(current.chartlabels[data.index]);
                        }

                        return inColor;
                    }
                },
            axis: {
                x: {
                    type: 'category',
                    categories: this.chartlabels
                },
                y: {
                    label: {
                        text: 'count',
                        position: 'inner-top'
                    },
                    tick : {
                        format: function (d) { if (current.logScale) { let res = 0; if (d != 0) { res = Math.pow(10, d).toFixed(0);}  return res; } else { return d}}
                    }
                }
            }
        });
        crchart1.legend.hide("count");

        let reltcount = chartrelseries;
        if (this.logScale) {
            let rellogdata = [];
            for (let i= 0; i < chartrelseries.length; i++) {
                let val = chartrelseries[i];
                if (val > 0) {
                    rellogdata[i] = Math.log10(val);
                } else if ( val == 0) {
                    rellogdata[i] = 0;
                } else if (val < 0) {
                    rellogdata[i] = -1 * (Math.log10(val));
                }
            }
            reltcount = rellogdata;
        }


        let crchart2 = c3.generate({
            bindto: '#chart2',
            data : { columns :[
                    ['count'].concat(reltcount)
                ],
                type: 'bar',
                color: function(inColor, data) {
                    if(data.index !== undefined) {
                        return colorScale(data.index);
                    }

                    return inColor;
                }
            },
            axis: {
                x: {
                    type: 'category',
                    categories: chartrels
                },
                y: {
                    label: {
                        text: 'count',
                        position: 'inner-top'
                    },tick : {
                        format: function (d) { if (current.logScale) { let res = 0; if (d != 0) { res = Math.pow(10, d).toFixed(0);}  return res; } else { return d}}
                    }}
            }
        });
        crchart2.legend.hide("count");
        //
        // build viz
        //


    }

    _byteToMb(aByteValue) {
        let num = aByteValue/1000000;
        return parseFloat(Math.round(num * Math.pow(10, 2)) /Math.pow(10,2)).toFixed(2);;
    }


    _getConstraintType(aString) {
        if (aString.indexOf("IS NODE KEY")> -1) {
            return "NODE KEY";
        } else if (aString.indexOf("exists(") > -1) {
            return "MANDATORY";
        } else if (aString.indexOf("IS UNIQUE")> -1) {
            return "UNIQUE";
        } else {
            return "";
        }
    }




    _getFormatedDate(aDate) {
      let hours = aDate.getHours();
      let minutes = "0" + aDate.getMinutes();
      let seconds = "0" + aDate.getSeconds();

      let year = aDate.getFullYear();
      let month = "0" + (aDate.getMonth() + 1) ;
      let day = "0" + aDate.getDate();

      // Will display time in 10:30:23 format
      return year + '-' + month.substr(-2) + "-" + day.substr(-2) + " " + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);

  }

  showModalWindow(aTitle, aContent) {
      $('#simpleModal')
          .modal('destroy')
      ;
      document.getElementById("modalHeader").innerHTML = aTitle;
      document.getElementById("modalContent").innerHTML = aContent;
      $('#simpleModal').modal({
          inverted: true
      })
          .modal('show')
      ;
  }

  _indexType( aString) {
        if (aString == "node_label_property") {
            return "";
        } else if (aString == "node_unique_property") {
            return "for uniquness constraint"
        } else {
            return aString;
        }
  }

  _getCountDisplay(aName, aCount) {
      let sst =  aName + "| " + aCount + "&nbsp;";

      return "<span class='countDisplay'>" + sst + "</span>";
  }

  _setContext() {
  	this.graphdb = this._getActiveDatabase();
  }
	
	_getActiveDatabase() {
		for (let pi = 0 ; pi < this.desktopContext.projects.length ; pi++) {
			let prj = this.desktopContext.projects[pi];
			for (let gi = 0 ; gi < prj.graphs.length ; gi++) {
				let grf = prj.graphs[gi];
				if (grf.status == 'ACTIVE') {
					return grf;
				}
			}
		}
	}

    _getLabelCountObject(aLabelName)  {
        if (this.dbinfo.labelCounts)  {
            for (let i=0 ; this.dbinfo.labelCounts.length; i++) {
                if (this.dbinfo.labelCounts[i].label == aLabelName) {
                    return this.dbinfo.labelCounts[i];
                }
            }
        }
        return null;
    }

    _getRelCountObject(aRelType) {
        if (this.dbinfo.relTypes)  {
            for (let i=0 ; this.dbinfo.relTypes.length; i++) {
                if (this.dbinfo.relTypes[i].type == aRelType) {
                    return this.dbinfo.relTypes[i];
                }
            }
        }
        return null;
    }


    _idIndex(a, id) {
        if (a.length > 0) {
            var item = a.get(id);
            if (item) {
                return id;
            }
        }
        return null;
    }

    handleCountProps(){
        this._checkParameters();
    }

}

