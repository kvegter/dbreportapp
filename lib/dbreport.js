'use strict';

class DBReport {


  
	
    constructor(desktopAPI) {
		this.dapi = desktopAPI;
		this.analyzewithdebug = false;
		this.liveCount = true;
        this.liveViewContainerName = "_dblvwr_";
        this.liveCountLogScale = false;
    }

	init() {
        let prms;
        if (this.dapi) {
            prms = this.dapi.getContext();
            let current = this;
            prms.then( function(ctx) {
                current._setContext(ctx);
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
                        let neo = new NeoAccessor(boltURL, current.neoUser, current.graphdb.connection.configuration.protocols.bolt.password);
                        current.session = neo.getReadSession();
                    }
                } else {
                    console.log(" No active Database, start a database in the Neo4j Desktop first")
                }
            });
        }
        return prms;
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
                if (curdesc.indexOf(":" + aLabelorRelType) > 0 && curdesc.indexOf("." + aProperty) > 0 && curdesc.indexOf("exists(") > 0) {
                    res = res + "M";
                }
                // node key
                if (curdesc.indexOf(":" + aLabelorRelType) > 0 && curdesc.indexOf("." + aProperty) > 0 && curdesc.indexOf("IS NODE KEY") > 0) {
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
            $('.ui.modal').remove(); // clear any existing modal
            div.innerHTML = "";
            let html = '<div class="ui small modal">';
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

            $('.ui.modal').modal('show');
        }
    }
    startLiveCount() {
        this.liveCount = true;
        setTimeout(this._liveViewCount,1000, this);
    }

    pauseStartLiveCount() {
       // btPauseStart
       let btText = document.getElementById("btPauseStartLC").innerHTML;
       if (btText == "Start") {
           // we should start it here
           this.startLiveCount();
           document.getElementById("btPauseStartLC").innerHTML = "Stop";
       } else if (btText == "Stop") {
           this.liveCount = false;
           // // just to check if clear is working
           // if (this.livelblcount) {
           //     this.livelblcount.destroy();
           //     this.livelblcount = null;
           // };
           document.getElementById("btPauseStartLC").innerHTML = "Start";
       }
    }

    // instead of java we could make a javascript routine to
    // build the json structure?
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
        document.getElementById("neoInstanceName").innerText = neoInstanceName;

        let reportDate = date;
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
            let rs = await this._runQuery(this.session, "call db.schema() yield nodes as nodes return head(nodes) as fn ");
            let record = this.resultRecords[0]; // we know it is always one


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


            this.resultRecords = "empty";
            rs = await this._runQuery(this.session, jmxStoreQuery);
            record = this.resultRecords[0]; // we know it is always one
            if (!record) {
                rs = await this._runQuery(this.session, oldJmxStoreQuery);
                record = this.resultRecords[0]; // we know it is always one
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

            rs = await this._runQuery(this.session, "match (n) return count(n) as n");
            record = this.resultRecords[0]; // we know it is always one
            nodeCount = record.get("n").toNumber();
            this._appendMessage(repContainer, nodeCount + " (" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            this._appendMessage(repContainer, "analyzing database (3/" + steps + "): Relationship Count...", true);

            rs = await this._runQuery(this.session, "match ()-[r]->() return count(r) as n");
            record = this.resultRecords[0]; // we know it is always one
            relationCount = record.get("n").toNumber();
            let useSample = false;
            let useRelationSample = false;
            this._appendMessage(repContainer, relationCount + "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            //
            // indexes
            //
            this._appendMessage(repContainer, "analyzing database (4/" + steps + "): Indexes...", true);
            rs = await this._runQuery(this.session, "call db.indexes()");
            this.resultRecords.forEach(function (rcd) {
                let lind = rcd.toObject();
                indexes.push(lind);
            });
            this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            //
            // constraints
            //
            this._appendMessage(repContainer, "analyzing database (5/" + steps + "): Constraints...", true);
            rs = await this._runQuery(this.session, "call db.constraints()");
            this.resultRecords.forEach(function (rcd) {
                let lind = rcd.toObject();
                constraints.push(lind);
            });
            this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            // reltypes
            this._appendMessage(repContainer, "analyzing database (6/" + steps + "): Relationship Types...", true);

            rs = await this._runQuery(this.session, "call db.relationshipTypes() yield relationshipType return relationshipType");
            this.resultRecords.forEach(function (rcd) {
                relTypes.push({
                    type: rcd.get("relationshipType").toString(),
                    propertyCombinations: [],
                    allProperties: []
                });
            });
            this._appendMessage(repContainer, relTypes.length + " (" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            // labels
            this._appendMessage(repContainer, "analyzing database (7/" + steps + "): Labels and label counts...", true);

            rs = await this._runQuery(this.session, "call db.labels() yield label return label");
            this.resultRecords.forEach(function (rcd) {
                // also initialize here
                let lc = {
                    label: rcd.get("label").toString(),
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
                rs = await this._runQuery(this.session, q1);
                labelCounts[ii].count = this.resultRecords[0].get("cnt").toNumber();
            }
            this._appendMessage(repContainer, "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            this._appendMessage(repContainer, "analyzing database (8/" + steps + "): Labels and outgoing/incoming relationship types and their counts...", true);
            //
            // get the relations per label
            //
            // we need here apoc because the call db.schema() is not giving a proper map back.
            //
            rs = await this._runQuery(this.session, "call db.schema() yield relationships as rels " +
                "unwind rels as rel " +
                "with  startNode(rel)  as startNode, type(rel) as relType, endNode(rel) as endNode " +
                "return startNode, relType, endNode")

            let rpos;
            for (rpos = 0; rpos < this.resultRecords.length; rpos++) {
                let recr = this.resultRecords[rpos];

                let startNode = recr.get("startNode").properties.name;

                let relType = recr.get("relType").toString();
                let endNode = recr.get("endNode").properties.name; // this is a bit awkward because db.schema don't give a real node back.
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
                        rs = await this._runQuery(this.session, q);
                        labelCounts[iii].outgoingRelations[a].count = this.resultRecords[0].get(0).toNumber();
                    }
                }
                // incoming relation count
                if (labelCounts[iii].incomingRelations.length > 0) {
                    let a;
                    for (a = 0; a < labelCounts[iii].incomingRelations.length; a++) {
                        let q = "MATCH (:`" + labelCounts[iii].label + "`)<-[r:`" + labelCounts[iii].incomingRelations[a].type + "`]-() RETURN count(r)";
                        rs = await this._runQuery(this.session, q);
                        labelCounts[iii].incomingRelations[a].count = this.resultRecords[0].get(0).toNumber();
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

                    this._appendMessage(repContainer, "--(" + (b + 1) + "/" + labelCounts.length + ") Node properties for Label  " + labelCounts[b].label, true);


                    if (labelCounts[b].count > aSampleTreshold) useSample = true;
                    labelCounts[b].nodePropsSampleUsed = useSample;

                    let qp = "MATCH (n:`" + labelCounts[b].label + "`) return keys(n), count(n) as cnt";
                    if (useSample) {
                        qp = "MATCH (n:`" + labelCounts[b].label + "`) where rand() < " + randomFactor + " with n limit " + sampleSize + " return keys(n), count(n) as cnt";
                    }
                    rs = await this._runQuery(this.session, qp);
                    let cc;
                    for (cc = 0; cc < this.resultRecords.length; cc++) {
                        this._addPropKeyList(labelCounts[b].propertyCombinations, this.resultRecords[cc].get(0), this.resultRecords[cc].get(1));
                        // console.log(this.resultRecords[cc]);
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
                        rs = await this._runQuery(this.session, "MATCH (n:`" + labelCounts[b].label + "`) where exists(n.`" + prp + "`) return n.`" + prp + "` limit 1");
                        propTypes.push(prp + " - " + this._getValType(this.resultRecords[0].get(0)) + " - " + this._schemaColumn(labelCounts[b].label, prp, indexes, constraints));
                    }
                    labelCounts[b].allProperties = propTypes;
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
                rs = await this._runQuery(this.session, labelCombinationQuery);
                let lcc;
                for (lcc = 0; lcc < this.resultRecords.length; lcc++) {
                    labelCombinations.push({labels: this.resultRecords[lcc].get(0)})
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
                    rs = await this._runQuery(this.session, vraag);
                    labelCombinations[lcom].count = this.resultRecords[0].get(0).toNumber();
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
                let vraag = "match ()-[r:" + relTypes[rcn].type + "]->() return count(r)";

                rs = await this._runQuery(this.session, vraag);
                relTypes[rcn].count = this.resultRecords[0].get(0).toNumber();


                if (analyzeRelProps) {

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
                                rpvraag = "match (n)-[r:" + relTypes[rcn].type + "]->() where rand() < " + randomFactor + " and ( n:`" + labels[li] + "` ";
                            } else {
                                rpvraag = "match (n)-[r:" + relTypes[rcn].type + "]->() where ( n:`" + labels[li] + "` ";
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
                    rs = await this._runQuery(this.session, rpvraag);
                    let cc;
                    for (cc = 0; cc < this.resultRecords.length; cc++) {
                        this._addPropKeyList(relTypes[rcn].propertyCombinations, this.resultRecords[cc].get(0), this.resultRecords[cc].get(1));
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
                                rptq = "match (n)-[r:" + relTypes[rcn].type + "]->() where ( n:`" + labels[li] + "` ";
                            } else {
                                rptq += " OR n:`" + labels[li] + "` ";
                            }
                        }
                        rptq += " ) and exists(r.`" + prp + "`) return r.`" + prp + "` limit 1";
                        //                rs = await this._runQuery(this.session, "MATCH ()-[r:" + relTypes[rcn].type + "]->() where exists(r.`" + prp + "`) return r.`" + prp + "` limit 1");
                        rs = await this._runQuery(this.session, rptq);
                        let val = this.resultRecords[0].get(0);


                        relPropTypes.push(prp + " - " + this._getValType(val) + " - " + this._schemaColumn(relTypes[rcn].type, prp, indexes, constraints));
                    }
                    relTypes[rcn].allProperties = relPropTypes;

                }
            }
            this._appendMessage(repContainer, " step 11 has taken " + (Date.now() - timeStart) + " ms.", true);
            this._appendMessage(repContainer, " Analyzing the database has taken " + (Date.now() - analyzeStart) + " ms.", true);


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
                analyzeLabelCombo: analyzeLabelCombo
            };
        } catch(error) {
           console.log(error.message);
        };
        return await this._runQuery(this.session, "return 1 as n");
    }
    _getObjectType(aVal) {
        let typ =  typeof aVal;
        if (neo4j.v1.isInt(aVal)) {
            typ = "integer";
        } else if (neo4j.v1.isDate(aVal)) {
            typ = "date";
        } else if (neo4j.v1.isDateTime(aVal)) {
            typ = "datetime"
        } else if (neo4j.v1.isLocalDateTime(aVal)) {
            typ = "localdatetime"
        } else if (neo4j.v1.isPoint(aVal)) {
            typ = "point"
        } else if (neo4j.v1.isTime(aVal)) {
            typ = "time"
        } else if (neo4j.v1.isLocalTime(aVal)) {
            typ = "localtime"
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

                    typ = typeof aVal[0];

                    typ = "[" + this._getObjectType(aVal[0]) + "]";

                } else {
                    typ = "";
                }
            } else {
                typ = this._getObjectType(aVal);
            }
        }
        return typ.toUpperCase();

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



    async _runQuery(session, qry) {
	    let current = this;
        if (current.analyzewithdebug) console.log(qry);

        const prom = session.run(qry);
	    await prom.then( function(result) {
            current.resultRecords = result.records;
             })
            .catch(function (error) {
                let msg = error.message;
                if (msg.startsWith("There is no procedure with the name `db.schema`")) {
                    msg = "The Neo4j Database Count report is dependend on db.schema() which is available on neo4j 3.1 and higher";
                }
                let cs = document.getElementById("appSummary").innerHTML;
                document.getElementById("appSummary").innerHTML = cs + '<br/>ERROR: ' + msg;
        });
        return prom;
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
        // create the live view container only
        //
        // let lvchtml = "<form class=\"ui form\" onsubmit=\"return false\"><table><tr><td>Refresh (sec)</td><td><input id=\"liveViewRefreshRate\" value=\"10\"/></td><td>Time Window (hours)</td><td><input id=\"timeWindow\" value=\"1\"/></td></tr></table></form><div id=\"" + this.liveViewContainerName + "\"></div><br/>Label Live Count<hr/><div id='clabellivecount'></div><br/>Relationship Live Count<hr/><div id='crellivecount'></div>";
        // tabLiveCountContainer.innerHTML = lvchtml;
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



        headerhtml += "</tr></table>";
        headerhtml += "";

        // global totals
//		html += "<br/>Database Totals<hr/>";
        summaryhtml += "<table>";
        summaryhtml += "<tr><td><div class='ui statistics'><div class='statistic'><div class='label'>Node Count</div><div class='value'>" + rdat.nodeCount + "</div></div>";
        summaryhtml += "<div class='statistic'><div class='label'>Relationship Count</div><div class='value'>" + rdat.relationCount   + "</div></div>";
        summaryhtml += "<div class='statistic'><div class='label'>Label Count</div><div class='value'>" + rdat.labelCounts.length   + "</div></div>";
        summaryhtml += "<div class='statistic'><div class='label'>Relationship Type Count</div><div class='value'>" + rdat.relTypes.length   + "</div></div>";
        if (aData.analyzeLabelCombo && aData.analyzeLabelCombo == true) {
            summaryhtml += "<div class='statistic'><div class='label'>Label Combinations</div><div class='value'>" + rdat.labelCombinations.length + "</div></div>";
        }
        summaryhtml += "</div></td></tr>";
        summaryhtml += "</table>";

        let chartrels = [];
        let chartrelseries = [];


        // chart with labels and counts here
        summaryhtml += "<br/>Label Counts<hr/>";

        // put here only the container
        // calculate the width based on the amount of labels 100xp per label

        summaryhtml += "<div id='chart1' syle='height: 200px'></div>";

        // chart with relationship and counts here
        summaryhtml += "<br/>Relationship Counts<hr/>";
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

        var chartlabels = [];
        var chartseries = [];
        rdat.labelCounts.forEach( function(labcnt) {
            chartlabels.push(labcnt.label);
            chartseries.push(labcnt.count);
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
        	for (let i = 0 ; i < rdat.labelCombinations.length; i++) {
        	    let labcom = rdat.labelCombinations[i];
        	    if (i == 0) {
        	        labelcombohtml += "<div class='ui five column grid'>";
                }
                rdat.labelCombinations.forEach(function (labcom) {
                    let lcs = "" + labcom.labels;
                    labelcombohtml += "<div class='column'><div class='ui teal message'><div class='header'>" + lcs.split(",").join(' ,') + "</div><p>" + labcom.count + "</p></div></div>";
                });
            }
            labelcombohtml += "</div>";
        } else {
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


        let colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        // now C3
        let crchart1 = c3.generate({
            bindto: '#chart1',
            data : { columns :[
                               ['count'].concat(chartseries)
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
                    categories: chartlabels
                }
            }
        });
        crchart1.legend.hide("Label");

        let crchart2 = c3.generate({
            bindto: '#chart2',
            data : { columns :[
                    ['count'].concat(chartrelseries)
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
                }
            }
        });
        crchart2.legend.hide("RelationshipType");
    }
    doScaleChange() {
        // useLogScale
        this.liveCountLogScale = document.getElementById("useLogScale").checked;
        // always reset the
        if (this.livelblcount) {
            this.livelblcount.destroy();
            this.livelblcount = null;
            if (this.labelcount_dataSet) {
                this.labelcount_dataSet = null;
                this.labelcount_groups = null;
            }
        }
        if (this.liverelcount) {
            this.liverelcount.destroy();
            this.liverelcount = null;
            if (this.relcount_dataSet) {
                this.relcount_dataSet = null;
                this.relcount_groups = null;
            }
        }

        this.liveCount = false;
        document.getElementById("btPauseStartLC").innerHTML = "Start";
        // this._liveViewCount(this);
    }

    async _liveViewCount(current) {
        if (current.liveCount == true) {
            let timeWindow = Number(document.getElementById("timeWindow").value); // in hours
            let timeout = Number(document.getElementById("liveViewRefreshRate").value) * 1000; // functions needs millis
            let timeWindowStart = vis.moment().add(-2, 'seconds');
            let timeWindowEnd = vis.moment().add(3600 * timeWindow, 'seconds');
            if (!current.lastTimeWindowEnd) {
                current.lastTimeWindowEnd = timeWindowEnd;
            }
            let timeWindowEndChanged = current.lastTimeWindowEnd != timeWindowEnd;

            //  get all the labels
            let rs = await current._runQuery(current.session, "call db.labels() yield label return label");
            let labelcntquery = "";
            for (let i = 0; i < current.resultRecords.length; i++) {
                let lbl = current.resultRecords[i].get("label").toString();
                if (i > 0) {
                    labelcntquery += " union all "
                }
                labelcntquery += "MATCH (n:`" + lbl + "`) return { type:'" + lbl + "', count:count(n), time:timestamp() } as data";
            }
            ;
            let labelcount = current.resultRecords.length;
            // label counts
            // let tStart = Date.now();
            rs = await current._runQuery(current.session, labelcntquery);

            // loop over the query results and update the liveCountLabelData Map
            if (!current.labelcount_dataSet) {
                current.labelcount_dataSet = new vis.DataSet();
                current.labelcount_groups = new vis.DataSet();
            }
            // collect the new items in an array and add those once otherwise the timeline will
            // start plotting after each single item 'add'
            let labelitems = [];
            for (let lic = 0; lic < current.resultRecords.length; lic++) {
                let dataMap = current.resultRecords[lic].get("data");
                // check group
                if (!current.labelcount_groups.get(dataMap.type)) {
                    current.labelcount_groups.add({id: dataMap.type, content: dataMap.type});
                }
//                current.labelcount_dataSet.add(
                  labelitems.push({
                    x: dataMap.time.toNumber(),
                    y: current._logScaleNumber(dataMap.count.toNumber()),
                    count: dataMap.count.toNumber(),
                    group: dataMap.type
                });
            }
            current.labelcount_dataSet.add(labelitems);
            // console.log(" Label count query and timeline plotting has taken " + (Date.now() - tStart) + " ms." );

            // get the container for the vis.js timeline and determine height
            let clabelContainer = document.getElementById("clabellivecount");


            let options = current._timelineOptions(labelcount, timeWindowStart, timeWindowEnd );
            // create the timeline chart if is not there yet, otherwise set the timewindow if that one is changed
            if (!current.livelblcount) {
                current.livelblcount = new vis.Graph2d(clabelContainer, current.labelcount_dataSet, current.labelcount_groups, options);
                // adding event listener
                current.livelblcount.on("click", function (properties) {
                    current._liveCountClick('Label', properties, current.livelblcount.itemsData);
                }) ;
            } else {
                if (timeWindowEndChanged) {
                    current.livelblcount.setOptions({end: timeWindowEnd});
                }
            }

            // relationships
            let relcntquery = "";
            rs = await current._runQuery(current.session, "call db.relationshipTypes() yield relationshipType return relationshipType");
            for (let ri = 0; ri < current.resultRecords.length; ri++) {
                let relType = current.resultRecords[ri].get("relationshipType").toString();
                if (ri > 0) {
                    relcntquery += " union all "
                }
                relcntquery += "MATCH ()-[r:`" + relType + "`]->() return { type:'" + relType + "', count:count(r), time:timestamp() } as data";
            }

            // relationship count
            let relcount = current.resultRecords.length;
            // label counts
            // tStart = Date.now();
            rs = await current._runQuery(current.session, relcntquery);
            // loop over the query results and update the liveCountLabelData Map

            if (!current.relcount_dataSet) {
                current.relcount_dataSet = new vis.DataSet();
                current.relcount_groups = new vis.DataSet();
            }
            let relitems = [];
            for (let lic = 0; lic < current.resultRecords.length; lic++) {
                let dataMap = current.resultRecords[lic].get("data");
                // check group
                if (!current.relcount_groups.get(dataMap.type)) {
                    current.relcount_groups.add({id: dataMap.type, content: dataMap.type});
                }

                relitems.push({
                    x: dataMap.time.toNumber(),
                    y: current._logScaleNumber(dataMap.count.toNumber()),
                    count: dataMap.count.toNumber(),
                    group: dataMap.type
                });
            }
            current.relcount_dataSet.add(relitems);
            // console.log(" Relationship count query and plotting has taken " + ( Date.now() - tStart) + " ms." );


            // get the container for the vis.js timeline and determine height
            let crelContainer = document.getElementById("crellivecount");


            options = current._timelineOptions(relcount, timeWindowStart, timeWindowEnd );

            // create the timeline chart if is not there yet, otherwise set the timewindow if that one is changed

            if (!current.liverelcount) {
                current.liverelcount = new vis.Graph2d(crelContainer, current.relcount_dataSet, current.relcount_groups, options);
                // adding event listener
                current.liverelcount.on("click", function (properties) {
                    current._liveCountClick('Relationship', properties, current.liverelcount.itemsData);
                }) ;
            } else {
                if (timeWindowEndChanged) {
                    current.liverelcount.setOptions({end: timeWindowEnd});
                }
            }

            // planning the next count call
            if (current.liveCount == true) {
                setTimeout(current._liveViewCount, timeout, current);
            }
        }
    }

    _logScaleNumber(aNumber) {
        //console.log(" this.liveCountLogScale " + this.liveCountLogScale);
        if (this.liveCountLogScale == true) {
            if (aNumber == 0) {
               return 0;
            } else {
                return Math.log10(aNumber);
            }
        } else {
            return aNumber;
        }
    }

    _byteToMb(aByteValue) {
        let num = aByteValue/1000000;
        return parseFloat(Math.round(num * Math.pow(10, 2)) /Math.pow(10,2)).toFixed(2);;
  }

  _timelineOptions(itemCount, tStart, tEnd) {
      let calculatedHeight = itemCount * 25; // 25 px per label
      if (calculatedHeight < 200) calculatedHeight = 200;

      // general chart options
      let options = {
          start: tStart,
          end: tEnd,
          drawPoints: {enabled: true, size : 1, style: "circle"},
          zoomable: false,
          orientation: 'top',
          graphHeight: calculatedHeight,
          style:'line',
          legend: {left: {position: "top-right"}}
      };

      return options;

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

  _liveCountClick(type, properties, dataSet) {
        let refreshRate = Number(document.getElementById("liveViewRefreshRate").value); // read it from input field
        let clickTime = properties.time.getTime();
        let minTime = clickTime - ((refreshRate * 1000)/2) - 10;
        let maxTime = minTime + (refreshRate * 1000) + 20;
        let scopedData = [];
        let times = [];
        let pinnedData = [];
        dataSet.get().forEach(function (item) {
            if (item.x > minTime && item.x < maxTime) {
                 scopedData.push(item);
                 if (!times.includes(item.x)) {
                     times.push(item.x);
                 }
            }
        });
        // get the closest nearby
        let timeDif = 0;
        let pinnedTime = 0;
        times.forEach( function( atime) {
            let abs = Math.abs(atime - clickTime);
            if (pinnedTime == 0) {
                // first
                timeDif = abs;
                pinnedTime = atime;
            } else {
                if (abs < timeDif) {
                    timeDif = abs;
                    pinnedTime = atime;
                }
            }
        });
        if (pinnedTime == 0) {
            // nothing to do
            return;
        }

        scopedData.forEach(function(item) {
            if (item.x == pinnedTime) {
                pinnedData.push({ name :item.group, count : item.count} );
                // console.log(item);
            }
        });

      this.showModalWindow(type + " count at " + this._getHourMinutSecond(pinnedTime), this._getCountContent(pinnedData))
  }

    _getHourMinutSecond(aTs) {
        let date = new Date(aTs);
        let hours = date.getHours();
        let minutes = "0" + date.getMinutes();
        let seconds = "0" + date.getSeconds();
        // Will display time in 10:30:23 format
        return hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
  }

    _getCountContent(pinnedData) {
        let html = "";
        // sort
        pinnedData.sort(function (a,b) {
            let la = new String(a.name);
            let lb = new String(b.name);
            return la.localeCompare(lb);
        })
        html += "<table>";
        for (let i=0; i< pinnedData.length; i++) {
            html += "<tr>";
            html += "<td>";
            html += pinnedData[i].name;
            html += "&nbsp;&nbsp;</td>";
            html += "<td align='right'>";
            html += pinnedData[i].count;
            html += "</td>";
            html += "</tr>";
        }
        html += "</table>";
        return html;
    }

  showModalWindow(aTitle, aContent) {
      $('.ui.modal')
          .modal('destroy')
      ;
      document.getElementById("modalHeader").innerHTML = aTitle;
      document.getElementById("modalContent").innerHTML = aContent;
      $('.ui.modal').modal({
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

  _setContext(aCtx) {
  	this.desktopContext = aCtx;
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

}