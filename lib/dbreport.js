'use strict';

class DBReport {


  
	
    constructor(desktopAPI) {
		this.dapi = desktopAPI;
		this.analyzewithdebug = false;
    }
	init() {
        let prms;
        if (this.dapi) {
            prms = this.dapi.getContext();
            let current = this;
            prms.then( function(ctx) {
                current._setContext(ctx);
                //
                // Connect to Neo4j
                //
                current.neoHost = current.graphdb.connection.configuration.protocols.bolt.host;
                current.neoUser = current.graphdb.connection.configuration.protocols.bolt.username;
                let boltURL = "bolt" + "://" + current.neoHost  + ":" + current.graphdb.connection.configuration.protocols.bolt.port;
                let neo = new NeoAccessor(boltURL,current.neoUser , current.graphdb.connection.configuration.protocols.bolt.password);
                current.session = neo.getReadSession();
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

    // instead of java we could make a javascript routine to
    // build the json structure?
    async analyseDB( aSampleTreshold, aSampleSize, aInstanceName, aRandomFactor, analyzeRelProps ) {
	    this.dbinfo;
        let repContainer = document.getElementById("appSummary");
        this._clear();

        let steps =11;
        // clear
        // doing the work here
        // first datastructure
        let date = new Date()
        let tStart = date.getTime();
        let reportName = "DatabaseOverview";
        let neoInstanceName = aInstanceName;
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
        this._appendMessage(repContainer,  " Analyze Relationship Properties: " + analyzeRelProps);

        let timeStart = Date.now();
        let analyzeStart = Date.now();

        this._appendMessage(repContainer,  "analyzing database (1/" + steps + "): Determining Store Sizes...", true);
        //
        // store size
        //
        this.resultRecords = "empty";
        let rs = await this._runQuery(this.session, "call apoc.monitor.store()" );
        let record = this.resultRecords[0]; // we know it is always one
        let arrayStoreSize = record.get("arrayStoreSize").toNumber();
        let logicalLogSize = record.get("logSize").toNumber();
        let nodeStoreSize = record.get("nodeStoreSize").toNumber();
        let propertyStoreSize = record.get("propStoreSize").toNumber();
        let relationshipStoreSize = record.get("relStoreSize").toNumber();
        let stringStoreSize = record.get("stringStoreSize").toNumber();
        let totalStoreSize = record.get("totalStoreSize").toNumber();
        let propertyRelatedStoreSize = ( propertyStoreSize + stringStoreSize + arrayStoreSize );
        let otherSpace = totalStoreSize - (nodeStoreSize + propertyStoreSize + relationshipStoreSize + stringStoreSize + arrayStoreSize + logicalLogSize);
        storeSizes = {
               "arrayStoreSize" : arrayStoreSize ,
               "logicalLogSize" : logicalLogSize,
               "nodeStoreSize" : nodeStoreSize,
               "propertyStoreSize" : propertyStoreSize,
               "relationshipStoreSize" : relationshipStoreSize,
               "stringStoreSize" : stringStoreSize,
               "totalStoreSize" : totalStoreSize,
               "propertyRelatedStoreSize" : propertyRelatedStoreSize,
               "otherSpace" : otherSpace
           };
        //
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();

        //
        // call db.schema() yield nodes as nde unwind nde as nd return  nd
        //
        // node count
        // relationscounr
        // total node and relationcounts
        this._appendMessage(repContainer, "analyzing database (2/" + steps + "): Node Count...", true);

        rs = await this._runQuery(this.session,"match (n) return count(n) as n");
        record = this.resultRecords[0]; // we know it is always one
        nodeCount = record.get("n").toNumber();
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();



        this._appendMessage(repContainer,"analyzing database (3/" + steps + "): Relationship Count...", true);

        rs = await this._runQuery(this.session,"match ()-[r]->() return count(r) as n");
        record = this.resultRecords[0]; // we know it is always one
        relationCount = record.get("n").toNumber();
        let useSample = false;
        let useRelationSample = false;
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();

        //
        // indexes
        //
        this._appendMessage(repContainer, "analyzing database (4/" + steps + "): Indexes...", true);
        rs = await this._runQuery(this.session,"call db.indexes()");
        this.resultRecords.forEach( function (rcd) {
            let lind = rcd.toObject();
               indexes.push(lind);
        })  ;
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();


        //
        // constraints
        //
        this._appendMessage(repContainer, "analyzing database (5/" + steps + "): Constraints...", true);
        rs = await this._runQuery(this.session,"call db.constraints()");
        this.resultRecords.forEach( function (rcd) {
            let lind = rcd.toObject();
            constraints.push(lind);
        })  ;
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();

        // reltypes
        this._appendMessage(repContainer,"analyzing database (6/" + steps + "): Relationship Types...", true);

        rs = await this._runQuery(this.session, "call db.relationshipTypes() yield relationshipType return relationshipType");
        this.resultRecords.forEach( function (rcd) {
            relTypes.push( { type: rcd.get("relationshipType").toString(), propertyCombinations : [], allProperties : [] } );
        }) ;
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();

        // labels
        this._appendMessage(repContainer,"analyzing database (7/" + steps + "): Labels and label counts...", true);

        rs = await this._runQuery(this.session, "call db.labels() yield label return label");
        this.resultRecords.forEach( function (rcd) {
            // also initialize here
            let lc = { label :  rcd.get("label").toString() , outgoingRelations : [], incomingRelations : [], propertyCombinations : [], allProperties : [] };
            labelCounts.push(lc);
        })  ;
        //
        // now the label counts
        //
        let ii;
        for (ii = 0; ii < labelCounts.length; ii++) {
            let q1 = "match (n:`" + labelCounts[ii].label + "`) return count(n) as cnt";
            rs = await this._runQuery(this.session, q1);
            labelCounts[ii].count = this.resultRecords[0].get("cnt").toNumber();
        }
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();

        this._appendMessage(repContainer,"analyzing database (8/" + steps + "): Labels and outgoing/incoming relationship types and their counts...", true);
        //
        // get the relations per label
        //
        // we need here apoc because the call db.schema() is not giving a proper map back.
        //
        rs = await this._runQuery(this.session, "call db.schema() yield relationships as rels " +
            "  unwind rels as rel " +
            "  return  apoc.convert.toMap(startNode(rel)).name  as startLabel, type(rel) as reltype, apoc.convert.toMap(endNode(rel)).name as endLabel");
        let rpos;
        for (rpos = 0; rpos < this.resultRecords.length; rpos++) {
            let recr = this.resultRecords[rpos];

            let startNode = recr.get("startLabel");
            let relType = recr.get("reltype").toString();
            let endNode = recr.get("endLabel").toString();
            let ii;
            for (ii = 0; ii < labelCounts.length; ii++) {
                // check for start label
                if (startNode == labelCounts[ii].label) {
                    this._addRelation(labelCounts[ii].outgoingRelations ,startNode , relType);
                }

                // check for end label
                if (endNode == labelCounts[ii].label) {
                    this._addRelation(labelCounts[ii].incomingRelations ,endNode , relType);
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
                for (a = 0 ; a < labelCounts[iii].outgoingRelations.length  ; a++ ) {
                    let q = "MATCH (:`" + labelCounts[iii].label + "`)-[r:`" + labelCounts[iii].outgoingRelations[a].type + "`]->() RETURN count(r)";
                    rs = await this._runQuery(this.session, q);
                    labelCounts[iii].outgoingRelations[a].count = this.resultRecords[0].get(0).toNumber();
                }
            }
            // incoming relation count
            if (labelCounts[iii].incomingRelations.length > 0) {
                let a;
                for (a = 0 ; a < labelCounts[iii].incomingRelations.length  ; a++ ) {
                    let q = "MATCH (:`" + labelCounts[iii].label + "`)<-[r:`" + labelCounts[iii].incomingRelations[a].type + "`]-() RETURN count(r)";
                    rs = await this._runQuery(this.session, q);
                    labelCounts[iii].incomingRelations[a].count = this.resultRecords[0].get(0).toNumber();
                }
            }
        }
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();


        this._appendMessage(repContainer, "analyzing database (9/" + steps + "): Label properties...", true);
        //
        // Label Properties
        //
        let b;
        for (b = 0; b < labelCounts.length; b++) {
            useSample = false;
            if (labelCounts[b].count > aSampleTreshold) useSample = true;
            labelCounts[b].nodePropsSampleUsed = useSample;

            let qp = "MATCH (n:`" + labelCounts[b].label + "`) return keys(n), count(n) as cnt";
            if (useSample) {
                qp =  "MATCH (n:`" + labelCounts[b].label + "`) where rand() < " + randomFactor + " with n limit " + sampleSize + " return keys(n), count(n) as cnt";
            }
            rs = await this._runQuery(this.session, qp);
            let cc;
            for (cc = 0; cc < this.resultRecords.length; cc++) {
                this._addPropKeyList(labelCounts[b].propertyCombinations, this.resultRecords[cc].get(0), this.resultRecords[cc].get(1) );
                // console.log(this.resultRecords[cc]);
            }

            // all Properties
            let allProps = [];
            let pc;
            for (pc = 0; pc < labelCounts[b].propertyCombinations.length; pc++) {
                let pcc;
                for (pcc = 0; pcc < labelCounts[b].propertyCombinations[pc].pc.length; pcc++ ) {
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
                propTypes.push(prp + " - " + this._getValType(this.resultRecords[0].get(0)) + " - " + this._schemaColumn(labelCounts[b].label,prp, indexes, constraints ));
            }
            labelCounts[b].allProperties = propTypes;
        }
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();

        //
        // Label Combinations
        //
        this._appendMessage(repContainer,"analyzing database (10/" + steps + "): Label Combinations and their counts...", true);

        let labelCombinationQuery = "match (n) where size(labels(n)) > 1 return distinct labels(n) as labellist";
        useSample = false;
        if (nodeCount > aSampleTreshold) useSample = true;

        let labelCombinationSampleUsed = useSample;
        if (useSample) {
            labelCombinationQuery = "match (n) where rand() < " + aRandomFactor + " and size(labels(n)) > 1  with n limit " + aSampleSize + " return distinct labels(n) as labellist";
        }
        rs = await this._runQuery(this.session, labelCombinationQuery);
        let lcc;
        for (lcc = 0; lcc < this.resultRecords.length; lcc++) {
            labelCombinations.push({ labels : this.resultRecords[lcc].get(0)})
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
        this._appendMessage(repContainer,  "(" + (Date.now() - timeStart) + "ms)", false);
        timeStart = Date.now();

        this._appendMessage(repContainer,"analyzing database (11/" + steps + "): Relationship counts, and properties ...", true);
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

        // console.log(labelOutRelMap);
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
                this._appendMessage(repContainer, "--(" + rcn + "/" + relTypes.length + ") relationship properties for relationship " + relTypes[rcn].type + " and Labels: " + labels , true );
                rs = await this._runQuery(this.session, rpvraag);
                let cc;
                for (cc = 0; cc < this.resultRecords.length; cc++) {
                    this._addPropKeyList(relTypes[rcn].propertyCombinations, this.resultRecords[cc].get(0), this.resultRecords[cc].get(1) );
                }
                // all properties
                let allRelProps = [];
                let pc;
                for (pc = 0; pc < relTypes[rcn].propertyCombinations.length; pc++) {
                    let pcc;
                    for (pcc = 0; pcc < relTypes[rcn].propertyCombinations[pc].pc.length; pcc++ ) {
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
        this._appendMessage(repContainer,  " step 11 has taken " + (Date.now() - timeStart) + " ms.", true);
        this._appendMessage(repContainer,  " Analyzing the database has taken " + (Date.now() - analyzeStart) + " ms.", true);



            this.dbinfo =  {
            reportName : reportName ,
            reportDate : reportDate ,
            neoServer : neoServer ,
            neoInstanceName : neoInstanceName ,
            neoUser : neoUser ,
            nodeCount : nodeCount,
            relationCount : relationCount ,
            storeSizes : storeSizes ,
            labelCounts : labelCounts ,
            labelCombinations : labelCombinations,
            relTypes : relTypes ,
            relCounts : relCounts,
            indexes : indexes,
            constraints : constraints,
            labelCombinationSampleUsed : labelCombinationSampleUsed,
            analyzeRelProps : analyzeRelProps
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
        });
        return prom;
    }

    _clear() {
        document.getElementById("appSummary").innerHTML = "";
        document.getElementById("appLog").innerHTML = "";
        document.getElementById("appLabelDetails").innerHTML= "";
        document.getElementById("appLabelCombinations").innerHTML = "";
        document.getElementById("appRelationshipDetails").innerHTML = "";
        document.getElementById("reportHeader").innerHTML = "";
        document.getElementById("appIndexes").innerHTML = "";
        document.getElementById("appConstraints").innerHTML = "";
    }


    async runReport(aSampleTreshold, aSampleSize, aData) {
        let tabSummary = document.getElementById("appSummary");
        let tabLabelDetails = document.getElementById("appLabelDetails");
        let tabLabelCombinations = document.getElementById("appLabelCombinations");
        let tabRelationshipDetails = document.getElementById("appRelationshipDetails");
        let reportHeader = document.getElementById("reportHeader");
        let tabIndexes = document.getElementById("appIndexes");
        let tabConstraints = document.getElementById("appConstraints");

		let rdat;
		if (aData) {
			rdat = aData;
		} else {
			rdat = this._exampleData();
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


        headerhtml += "</tr></table>";
        headerhtml += "";

        // global totals
//		html += "<br/>Database Totals<hr/>";
        summaryhtml += "<table>";
        summaryhtml += "<tr><td><div class='ui statistics'><div class='statistic'><div class='label'>Node Count</div><div class='value'>" + rdat.nodeCount + "</div></div>";
        summaryhtml += "<div class='statistic'><div class='label'>Relationship Count</div><div class='value'>" + rdat.relationCount   + "</div></div>";
        summaryhtml += "<div class='statistic'><div class='label'>Label Count</div><div class='value'>" + rdat.labelCounts.length   + "</div></div>";
        summaryhtml += "<div class='statistic'><div class='label'>Relationship Type Count</div><div class='value'>" + rdat.relTypes.length   + "</div></div>";
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
                relationshipdetailhtml += "<table style='width: 100%'><tr><td onclick='let d = document.getElementById(\"" + elm.type + "_dr\"); let dce = document.getElementById(\"" + elm.type + "_drce\"); if (d.style.visibility == \"collapse\") { d.style.visibility = \"visible\"; d.style.height = \"auto\"; dce.src = \"collapse-arrow.png\"} else { d.style.visibility = \"collapse\"; d.style.height = \"0px\"; dce.src = \"expand-arrow.png\" }   '    ><div class='ui positive message'><div class='header'>" + elm.type + "<img src='expand-arrow.png' width='12px' id='" + elm.type + "_drce'/></div><p>" + elm.count + "</p></td></tr></table>"
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
                relationshipdetailhtml += "<table style='width: 100%'><tr><td><div class='ui positive message'><div class='header'>" + elm.type  + "</div><p>" + elm.count + "</p></td></tr></table>"
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
            labeldetailhtml += "<table style='width: 100%'><tr><td onclick='let d = document.getElementById(\"" + labcnt.label + "_d\"); let dce = document.getElementById(\"" + labcnt.label + "_dce\"); if (d.style.visibility == \"collapse\") { d.style.visibility = \"visible\"; d.style.height = \"auto\"; dce.src = \"collapse-arrow.png\"} else { d.style.visibility = \"collapse\"; d.style.height = \"0px\"; dce.src = \"expand-arrow.png\" }   '    ><div class='ui positive message'><div class='header'>" +  labcnt.label + "<img src='expand-arrow.png' width='12px' id='" + labcnt.label + "_dce'/></div><p>" + labcnt.count + "</p></td></tr></table>"
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
        summaryhtml += "<br/>Store Info<hr/>";

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
                    ['nodeStoreSize (' + rdat.storeSizes.nodeStoreSize + ')' , rdat.storeSizes.nodeStoreSize],
                    ['relationshipStoreSize (' + rdat.storeSizes.relationshipStoreSize + ')', rdat.storeSizes.relationshipStoreSize],
                    ['propertyStoreSize (' + rdat.storeSizes.propertyStoreSize + ')', rdat.storeSizes.propertyStoreSize],
                    ['arrayStoreSize (' + rdat.storeSizes.arrayStoreSize + ')', rdat.storeSizes.arrayStoreSize],
                    ['stringStoreSize (' + rdat.storeSizes.stringStoreSize + ')', rdat.storeSizes.stringStoreSize],
                    ['otherSpace(' + rdat.storeSizes.otherSpace + ')', rdat.storeSizes.otherSpace]
                ],
                type : 'pie'
            }
        });


        let colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        // now C3
        let crchart1 = c3.generate({
            bindto: '#chart1',
            data : { columns :[
                               ['Label'].concat(chartseries)
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
                    ['RelationshipType'].concat(chartrelseries)
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