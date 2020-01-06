'use strict';


class LegacyDBAnalyzer{

    constructor(aDesktopInstanceName, aNeoHost, aRepElement, aSampleTreshold, aSampleSize, aRandomFactor, aAnalyzeLabelProps, aAnalyzeRelProps, aAnalyzeLabelCombo, aAnalyseWithDebug, alabelList, aRelTypeList ) {
		this.analyzewithdebug = aAnalyseWithDebug;
        this.nea = nac;
        this.repContainer = aRepElement;
        this.sampleTreshold = aSampleTreshold;
        this.sampleSize = aSampleSize;
        this.randomFactor = aRandomFactor;
        this.analyseLabelProps = aAnalyzeLabelProps;
        this.analyseRelProps = aAnalyzeRelProps;
        this.analyseLabelCombo = aAnalyzeLabelCombo;
        this.desktopInstanceName = aDesktopInstanceName;
        // labels
        this.analysePropsLabels = alabelList;
        // relationshiptypes
        this.analysePropsRelTypes = aRelTypeList;
        // session
        this.session = this.nea.getReadSession();
        this.neoHost = aNeoHost;
        this.neoUser = this.nea.neoun;

        //console.log(" LegacyDBAnalyzer constructed");
    }


    async analyseDB( ) {
	    let dbinfo = null;

        let steps =11;
        // clear
        // doing the work here
        // first datastructure
        let date = new Date()
        let tStart = date.getTime();
        let reportName = "DatabaseOverview";
        // always check againg what is the current database?
        // init again
//        let neoInstanceName = this.desktopInstanceName;

        let reportDate = this._getFormatedDate(date);
        let neoServer = this.neoHost;
        let neoUser = this.neoUser;
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
        this._appendMessage(  " Sample Treshold: " + this.sampleTreshold);
        this._appendMessage(  " Sample Size: " + this.sampleSize);
        this._appendMessage(  " Random Factor: " + this.randomFactor);
        this._appendMessage(  " Analyze Node Properties: " + this.analyseLabelProps, true);
        this._appendMessage(  " Analyze Relationship Properties: " + this.analyseRelProps);
        this._appendMessage(  " Analyze Label Combinations: " + this.analyseLabelCombo );

        let timeStart = Date.now();
        let analyzeStart = Date.now();
        try {

            // step zero check if there is db.schema() procedure in the database

            let rs = await nac.runQueryRecords(this.session, "call db.schema() yield nodes as nodes return head(nodes) as fn ", null, this.repContainer );
            let record = rs[0]; // we know it is always one
            // check if apoc is available

            rs = await nac.runQueryRecords(this.session, "call dbms.functions() yield name as name " +
                "with name where name = 'apoc.metax.type' " +
                "return count(name) as cnt",null, this.repContainer);
            apocAvailable = rs[0].get("cnt").toNumber() > 0;
            this._appendMessage(  " APOC Available: " + apocAvailable);
            this._appendMessage( "analyzing database (1/" + steps + "): Determining Store Sizes...", true);
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

            rs = await nac.runQueryRecords(this.session, jmxStoreQuery, null, this.repContainer);
            record = rs[0]; // we know it is always one
            if (!record) {
                // console.log(" old jmx store query ");
                rs = await nac.runQueryRecords(this.session, oldJmxStoreQuery,null, this.repContainer);
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
            //console.log(storeSizes);
            //
            this._appendMessage( "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            //
            // call db.schema() yield nodes as nde unwind nde as nd return  nd
            //
            // node count
            // relationscounr
            // total node and relationcounts
            this._appendMessage( "analyzing database (2/" + steps + "): Node Count...", true);

            rs = await nac.runQueryRecords(this.session, "match (n) return count(n) as n", null, this.repContainer );
            record = rs[0]; // we know it is always one
            nodeCount = record.get("n").toNumber();
            this._appendMessage( nodeCount + " (" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            this._appendMessage( "analyzing database (3/" + steps + "): Relationship Count...", true);

            rs = await nac.runQueryRecords(this.session, "match ()-[r]->() return count(r) as n", null, this.repContainer );
            record = rs[0]; // we know it is always one
            relationCount = record.get("n").toNumber();
            let useSample = false;
            let useRelationSample = false;
            this._appendMessage( relationCount + "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            //
            // indexes
            //
            this._appendMessage( "analyzing database (4/" + steps + "): Indexes...", true);
            rs = await nac.runQueryRecords(this.session, "call db.indexes()", null, this.repContainer );
            rs.forEach(function (rcd) {
                let lind = rcd.toObject();
                indexes.push(lind);
            });
            this._appendMessage( "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            //
            // constraints
            //
            this._appendMessage( "analyzing database (5/" + steps + "): Constraints...", true);
            rs = await nac.runQueryRecords(this.session, "call db.constraints()",null, this.repContainer );
            rs.forEach(function (rcd) {
                let lind = rcd.toObject();
                constraints.push(lind);
            });
            this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            // reltypes
            this._appendMessage("analyzing database (6/" + steps + "): Relationship Types...", true);
            let relationShipTypes = await nac.getRelationshipTypes(this.session);
            //console.log(relationShipTypes);
            // rs = await nac.runQueryRecords(this.session, "call db.relationshipTypes() yield relationshipType return relationshipType",null, this.repContainer);
            relationShipTypes.forEach(function (rcd) {
                relTypes.push({
                    type: rcd,
                    propertyCombinations: [],
                    allProperties: []
                });
            });
            this._appendMessage(relTypes.length + " (" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            // labels
            this._appendMessage( "analyzing database (7/" + steps + "): Labels and label counts...", true);
            let lbls = await nac.getLabels(this.session);
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
                rs = await nac.runQueryRecords(this.session, q1, null, this.repContainer);
                labelCounts[ii].count = rs[0].get("cnt").toNumber();
            }
            this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();
            this._appendMessage("analyzing database (8/" + steps + "): Labels and outgoing/incoming relationship types and their counts...", true);
            //
            // get the relations per label
            //
            //
            let schemaNodes = null;
            let schemaRels = null;

            // rs = await nac.runQueryRecords(this.session, "call db.schema() yield relationships as rels " +
            //     "unwind rels as rel " +
            //     "with  startNode(rel)  as startNode, type(rel) as relType, endNode(rel) as endNode " +
            //     "return startNode, relType, endNode, id(startNode) as snId, id(endNode) as enId", null, this.repContainer)

            rs = await nac.runQueryRecords(this.session, "call db.schema() yield relationships , nodes " +
                "with reduce(s = [], x IN nodes | s + [{nid: id(x), node: x}]) as nodeList " +
                ",    reduce(r = [], y IN relationships | r + [{ startNode : startNode(y), snId: id(startNode(y)), type: type(y), endNode: endNode(y), enId : id(endNode(y))}]) as relList " +
                "return nodeList, relList", null, this.repContainer);

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
                        rs = await nac.runQueryRecords(this.session, q, null, this.repContainer);
                        labelCounts[iii].outgoingRelations[a].count = rs[0].get(0).toNumber();
                    }
                }
                // incoming relation count
                if (labelCounts[iii].incomingRelations.length > 0) {
                    let a;
                    for (a = 0; a < labelCounts[iii].incomingRelations.length; a++) {
                        let q = "MATCH (:`" + labelCounts[iii].label + "`)<-[r:`" + labelCounts[iii].incomingRelations[a].type + "`]-() RETURN count(r)";
                        rs = await nac.runQueryRecords(this.session, q, null, this.repContainer);
                        labelCounts[iii].incomingRelations[a].count = rs[0].get(0).toNumber();
                    }
                }
            }
            this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            this._appendMessage("analyzing database (9/" + steps + "): Label properties...", true);
            //
            // Label Properties
            //
            if (this.analyseLabelProps && this.analyseLabelProps == true) {
                let b;
                for (b = 0; b < labelCounts.length; b++) {
                    useSample = false;
                    if (this.analysePropsLabels.includes(labelCounts[b].label)) {
                        this._appendMessage("--(" + (b + 1) + "/" + labelCounts.length + ") Node properties for Label  " + labelCounts[b].label, true);


                        if (labelCounts[b].count > this.sampleTreshold) useSample = true;
                        labelCounts[b].nodePropsSampleUsed = useSample;

                        let qp = "MATCH (n:`" + labelCounts[b].label + "`) return keys(n), count(n) as cnt";
                        if (useSample) {
                            qp = "MATCH (n:`" + labelCounts[b].label + "`) where rand() < " + randomFactor + " with n limit " + sampleSize + " return keys(n), count(n) as cnt";
                        }
                        rs = await nac.runQueryRecords(this.session, qp,null, this.repContainer );
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
                                rs = await nac.runQueryRecords(this.session, "MATCH (n:`" + labelCounts[b].label + "`) where exists(n.`" + prp + "`) return apoc.meta.type(n.`" + prp + "`) limit 1",null, this.repContainer );
                                propTypes.push(prp + " - " + rs[0].get(0) + " - " + this._schemaColumn(labelCounts[b].label, prp, indexes, constraints));
                            } else {
                                rs = await nac.runQueryRecords(this.session, "MATCH (n:`" + labelCounts[b].label + "`) where exists(n.`" + prp + "`) return n.`" + prp + "` limit 1",null, this.repContainer );
                                propTypes.push(prp + " - " + this._getValType(rs[0].get(0)) + " - " + this._schemaColumn(labelCounts[b].label, prp, indexes, constraints));
                            }
                        }
                        labelCounts[b].allProperties = propTypes;
                    }
                }
                this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            } else {
                this._appendMessage("analyzing label properties switched off", false);
            }
            timeStart = Date.now();

            //
            // Label Combinations
            //
            this._appendMessage( "analyzing database (10/" + steps + "): Label Combinations and their counts...", true);
            let labelCombinationSampleUsed = false;
            if (this.analyseLabelCombo && this.analyseLabelCombo == true) {
                let labelCombinationQuery = "match (n) where size(labels(n)) > 1 return distinct labels(n) as labellist";
                useSample = false;
                if (nodeCount > this.sampleTreshold) useSample = true;

                labelCombinationSampleUsed = useSample;
                if (useSample) {
                    labelCombinationQuery = "match (n) where rand() < " + aRandomFactor + " and size(labels(n)) > 1  with n limit " + aSampleSize + " return distinct labels(n) as labellist";
                }
                rs = await nac.runQueryRecords(this.session, labelCombinationQuery, null, this.repContainer);
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
                    rs = await nac.runQueryRecords(this.session, vraag, null, this.repContainer );
                    labelCombinations[lcom].count = rs[0].get(0).toNumber();
                }
                this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            } else {
                this._appendMessage("analyze label combinations switch off", false);
            }
            timeStart = Date.now();

            this._appendMessage("analyzing database (11/" + steps + "): Relationship counts, and properties ...", true);
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

                rs = await nac.runQueryRecords(this.session, vraag,null, this.repContainer );
                relTypes[rcn].count = rs[0].get(0).toNumber();


                if (this.analyseRelProps) {
                    if (this.analysePropsRelTypes.includes(relTypes[rcn].type)) {

                        if (this.sampleTreshold < relTypes[rcn].count) {
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
                        this._appendMessage("--(" + (rcn + 1) + "/" + relTypes.length + ") relationship properties for relationship " + relTypes[rcn].type + " and Label: " + labels, true);
                        rs = await nac.runQueryRecords(this.session, rpvraag,null, this.repContainer);
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
                            rs = await nac.runQueryRecords(this.session, rptq, null, this.repContainer);
                            let val = rs[0].get(0);


                            relPropTypes.push(prp + " - " + this._getValType(val) + " - " + this._schemaColumn(relTypes[rcn].type, prp, indexes, constraints));
                        }
                        relTypes[rcn].allProperties = relPropTypes;
                    }

                }
            }
            this._appendMessage(" step 11 has taken " + (Date.now() - timeStart) + " ms.", true);
            this._appendMessage(" Analyzing the database has taken " + (Date.now() - analyzeStart) + " ms.", true);

            let complexityScore = (labelCounts.length + relTypes.length) * (relationCount / nodeCount);
            // console.log("ComplexityScore: " + complexityScore);

            this.dbinfo = {
                reportName: reportName,
                reportDate: reportDate,
                neoServer: nac.neoHost,
                neoInstanceName: nac.instanceName,
                neoUser: nac.neoUser,
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
                analyzeRelProps: this.analyseRelProps,
                analyzeLabelProps: this.analyseLabelProps,
                analyzeLabelCombo: this.analyseLabelCombo,
                schemaNodes : schemaNodes,
                schemaRels : schemaRels,
                complexityScore : complexityScore
            };

        } catch(error) {
           console.log(error);
        };
        return await nac.runQueryRecords(this.session, "return 1 as n", null, this.repContainer );
    }


    _getObjectType(aVal) {
        let typ =  typeof aVal;
        // new drivers does not have v1 anymore
        if (neo4j.isInt(aVal)) {
            typ = "Integer";
        } else if (neo4j.isDate(aVal)) {
            typ = "Date";
        } else if (neo4j.isDateTime(aVal)) {
            typ = "ZonedDateTime"
        } else if (neo4j.isLocalDateTime(aVal)) {
            typ = "LocalDateTime"
        } else if (neo4j.isPoint(aVal)) {
            typ = "PointValue"
        } else if (neo4j.isTime(aVal)) {
            typ = "Time"
        } else if (neo4j.isLocalTime(aVal)) {
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

    _appendMessage( aString, newLine) {
        let curData = this.repContainer.innerHTML;
        if (newLine) {
            this.repContainer.innerHTML = curData + "<br/>" + aString;
        } else {
            this.repContainer.innerHTML = curData + " " + aString;
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
        // "F"

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

                if (label == aLabelorRelType && !ind.type.endsWith("fulltext")) {
                    if (this._arrayContains(props,aProperty )) {
                        if (ind.type == "node_label_property") {
                            res = "I";
                        } else {
                            res = "U";
                        }
                        if (ind.properties && ind.properties.length > 1) {
                            res = res + '*';
                        }
                    }
                }
            }

            // now fulltext check
            for (let i = 0; i < indexes.length; i++) {
                // get the label from the description to be backwards compatible
                let ind = indexes[i];

                if (ind.type.endsWith("fulltext")) {
                    // we know that when fulltext is enabled we have a column tokenNames and a column properties
                    if (this._arrayContains(ind.properties,aProperty ) && this._arrayContains(ind.tokenNames,aLabelorRelType)) {
                        res = res + "F";
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
                    if (res.indexOf("*") > 0) {
                        res = "N*";
                    } else {
                        res = "N";
                    }
                }
            }
        }
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

}

class MultiDBAnalyzer{
    // used for databases version 4+
    constructor(dbname, aDesktopInstanceName, aNeoHost, aRepElement, aSampleTreshold, aSampleSize, aRandomFactor, aAnalyzeLabelProps, aAnalyzeRelProps, aAnalyzeLabelCombo, aAnalyseWithDebug, alabelList, aRelTypeList ) {
        this.analyzewithdebug = aAnalyseWithDebug;
        this.dbname = dbname;
        this.repContainer = aRepElement;
        this.sampleTreshold = aSampleTreshold;
        this.sampleSize = aSampleSize;
        this.randomFactor = aRandomFactor;
        this.analyseLabelProps = aAnalyzeLabelProps;
        this.analyseRelProps = aAnalyzeRelProps;
        this.analyseLabelCombo = aAnalyzeLabelCombo;
        this.desktopInstanceName = aDesktopInstanceName;
        // labels
        this.analysePropsLabels = alabelList;
        // relationshiptypes
        this.analysePropsRelTypes = aRelTypeList;
        // session
        this.session = nac.getReadSession(this.dbname);
        this.neoHost = aNeoHost;
        this.neoUser = nac.neoUser;

        //console.log(" MultiDBAnalyzer constructed");
        //console.log(aRepElement);
    }

    _readNumberProperty(arecord, aprop,) {
        if (arecord) {
            return arecord.get(aprop);
        } else {
            return 0;
        }
    }
    _readStringProperty(arecord,aprop) {
        if (arecord) {
            return arecord.get(aprop).toString();
        } else {
            return "";
        }

    }
    _resolveNode(nodeList, nodeId) {
        //console.log("_resolveLabel  start nodeId = " + nodeId);
        //console.log(nodeList);
        for (let i = 0; i < nodeList.length; i++) {
            let node = nodeList[i];
            if (node.nid.toNumber() === nodeId) {
                return  node.node;
            }
        }
        return "?";

    }
    async analyseDB( ) {
        let dbinfo = null;

        let steps =11;
        // clear
        // doing the work here
        // first datastructure
        let date = new Date()
        let tStart = date.getTime();
        let reportName = "DatabaseOverview";
        // always check againg what is the current database?
        // init again
//        let neoInstanceName = this.desktopInstanceName;

        let reportDate = this._getFormatedDate(date);
        let neoServer = this.neoHost;
        let neoUser = this.neoUser;
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
        this._appendMessage(  " Sample Treshold: " + this.sampleTreshold);
        this._appendMessage(  " Sample Size: " + this.sampleSize);
        this._appendMessage(  " Random Factor: " + this.randomFactor);
        this._appendMessage(  " Analyze Node Properties: " + this.analyseLabelProps, true);
        this._appendMessage(  " Analyze Relationship Properties: " + this.analyseRelProps);
        this._appendMessage(  " Analyze Label Combinations: " + this.analyseLabelCombo );

        let timeStart = Date.now();
        let analyzeStart = Date.now();
        try {

            // step zero check if there is db.schema() procedure in the database

            let rs = await nac.runQueryRecords(this.session, "call db.schema.visualization() yield nodes as nodes return head(nodes) as fn ", null, this.repContainer );
            let record = rs[0]; // we know it is always one
            // check if apoc is available

            rs = await nac.runQueryRecords(this.session, "call dbms.functions() yield name as name " +
                "with name where name = 'apoc.metax.type' " +
                "return count(name) as cnt",null, this.repContainer );
            //console.log(rs[0].get("cnt") );
            apocAvailable = rs[0].get("cnt") > 0;
            this._appendMessage(  " APOC Available: " + apocAvailable);
            this._appendMessage( "analyzing database (1/" + steps + "): Determining Store Sizes...", true);
            //
            // store size
            //
            let jmxStoreQuery = 'call dbms.queryJmx("neo4j.metrics:name=neo4j.' + this.dbname + '.store.size.total") yield attributes as data ' +
                'with data["Value"] as totalss ' +
                'return totalss.value as totalStoreSize ';



            rs = await nac.runQueryRecords(this.session, jmxStoreQuery, null, this.repContainer );
            record = rs[0]; // we know it is always one

            let totalStoreSize = this._readNumberProperty(record,"totalStoreSize");
            storeSizes = {
                "countStoreSize": 0,
                "labelStoreSize": 0,
                "indexStoreSize": 0,
                "schemaStoreSize": 0,
                "arrayStoreSize": 0,
                "logicalLogSize": 0,
                "nodeStoreSize": 0,
                "propertyStoreSize": 0,
                "relationshipStoreSize": 0,
                "stringStoreSize": 0,
                "totalStoreSize": totalStoreSize,
                "otherSpace": 0
            };
            //
            this._appendMessage( "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            //
            // call db.schema() yield nodes as nde unwind nde as nd return  nd
            //
            // node count
            // relationscounr
            // total node and relationcounts
            this._appendMessage( "analyzing database (2/" + steps + "): Node Count...", true);

            rs = await nac.runQueryRecords(this.session, "match (n) return count(n) as n",null, this.repContainer );
            record = rs[0]; // we know it is always one
            nodeCount = record.get("n");
            this._appendMessage( nodeCount + " (" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            this._appendMessage( "analyzing database (3/" + steps + "): Relationship Count...", true);

            rs = await nac.runQueryRecords(this.session, "match ()-[r]->() return count(r) as n",null, this.repContainer );
            record = rs[0]; // we know it is always one
            relationCount = record.get("n");
            let useSample = false;
            let useRelationSample = false;
            this._appendMessage( relationCount + "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            //
            // indexes
            //
            this._appendMessage( "analyzing database (4/" + steps + "): Indexes...", true);
            rs = await nac.runQueryRecords(this.session, "call db.indexes()",null, this.repContainer);
            rs.forEach(function (rcd) {
                let lind = rcd.toObject();
                indexes.push(lind);
            });
            this._appendMessage( "(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            //
            // constraints
            //
            this._appendMessage( "analyzing database (5/" + steps + "): Constraints...", true);
            rs = await nac.runQueryRecords(this.session, "call db.constraints()",null, this.repContainer );
            rs.forEach(function (rcd) {
                let lind = rcd.toObject();
                constraints.push(lind);
            });
            this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            // reltypes
            this._appendMessage("analyzing database (6/" + steps + "): Relationship Types...", true);
            let relationShipTypes = await nac.getRelationshipTypes(this.session);
            //console.log(relationShipTypes);
            // rs = await nac.runQuery(this.session, "call db.relationshipTypes() yield relationshipType return relationshipType");
            relationShipTypes.forEach(function (rcd) {
                relTypes.push({
                    type: rcd,
                    propertyCombinations: [],
                    allProperties: []
                });
            });
            this._appendMessage(relTypes.length + " (" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();

            // labels
            this._appendMessage( "analyzing database (7/" + steps + "): Labels and label counts...", true);
            let lbls = await nac.getLabels(this.session);
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
                rs = await nac.runQueryRecords(this.session, q1, null, this.repContainer);
                labelCounts[ii].count = rs[0].get("cnt");
            }
            this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();
            this._appendMessage("analyzing database (8/" + steps + "): Labels and outgoing/incoming relationship types and their counts...", true);
            //
            // get the relations per label
            //
            //
            let schemaNodes = null;
            let schemaRels = null;
            //console.log(labelCounts);

            // rs = await nac.runQuery(this.session, "call db.schema() yield relationships as rels " +
            //     "unwind rels as rel " +
            //     "with  startNode(rel)  as startNode, type(rel) as relType, endNode(rel) as endNode " +
            //     "return startNode, relType, endNode, id(startNode) as snId, id(endNode) as enId")
// problems here!
            rs = await nac.runQueryRecords(this.session, "call db.schema.visualization() yield relationships , nodes " +
                "with relationships, nodes, reduce(s = [], x IN nodes | s + [{nid: id(x), node: x}]) as nodeList " +
                "return nodeList, relationships, nodes ",null, this.repContainer );


            let rpos;
            schemaNodes = rs[0].get("nodeList");
            schemaRels = rs[0].get("relationships"); // the relationships has all the data but not the startnode and endnode properties

            for (rpos = 0; rpos < schemaRels.length; rpos++) {
                let recr = schemaRels[rpos];
                let startNode = this._resolveNode(schemaNodes, recr.start.toNumber() );

                schemaRels[rpos].startNode = startNode; // this was missing in the output

                let relType = recr.type.toString();
                let endNode =  this._resolveNode(schemaNodes, recr.end.toNumber() );
                schemaRels[rpos].endNode = endNode; // this was missing in the output


                let ii;
                for (ii = 0; ii < labelCounts.length; ii++) {
                    // check for start label
                    if (startNode.labels[0] == labelCounts[ii].label) {
                        this._addRelation(labelCounts[ii].outgoingRelations, startNode, relType);
                    }

                    // check for end label
                    if (endNode.labels[0] == labelCounts[ii].label) {
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
                        rs = await nac.runQueryRecords(this.session, q, null, this.repContainer);
                        labelCounts[iii].outgoingRelations[a].count = rs[0].get(0);
                    }
                }
                // incoming relation count
                if (labelCounts[iii].incomingRelations.length > 0) {
                    let a;
                    for (a = 0; a < labelCounts[iii].incomingRelations.length; a++) {
                        let q = "MATCH (:`" + labelCounts[iii].label + "`)<-[r:`" + labelCounts[iii].incomingRelations[a].type + "`]-() RETURN count(r)";
                        rs = await nac.runQueryRecords(this.session, q, null, this.repContainer );
                        labelCounts[iii].incomingRelations[a].count = rs[0].get(0);
                    }
                }
            }
            this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            timeStart = Date.now();


            this._appendMessage("analyzing database (9/" + steps + "): Label properties...", true);
            //
            // Label Properties
            //
            if (this.analyseLabelProps && this.analyseLabelProps == true) {
                let b;
                for (b = 0; b < labelCounts.length; b++) {
                    useSample = false;
                    if (this.analysePropsLabels.includes(labelCounts[b].label)) {
                        this._appendMessage("--(" + (b + 1) + "/" + labelCounts.length + ") Node properties for Label  " + labelCounts[b].label, true);


                        if (labelCounts[b].count > this.sampleTreshold) useSample = true;
                        labelCounts[b].nodePropsSampleUsed = useSample;

                        let qp = "MATCH (n:`" + labelCounts[b].label + "`) return keys(n), count(n) as cnt";
                        if (useSample) {
                            qp = "MATCH (n:`" + labelCounts[b].label + "`) where rand() < " + randomFactor + " with n limit " + sampleSize + " return keys(n), count(n) as cnt";
                        }
                        rs = await nac.runQueryRecords(this.session, qp, null, this.repContainer );
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
                                rs = await nac.runQueryRecords(this.session, "MATCH (n:`" + labelCounts[b].label + "`) where exists(n.`" + prp + "`) return apoc.meta.type(n.`" + prp + "`) limit 1",null, this.repContainer);
                                propTypes.push(prp + " - " + rs[0].get(0) + " - " + this._schemaColumn(labelCounts[b].label, prp, indexes, constraints));
                            } else {
                                rs = await nac.runQueryRecords(this.session, "MATCH (n:`" + labelCounts[b].label + "`) where exists(n.`" + prp + "`) return n.`" + prp + "` limit 1",null, this.repContainer );
                                propTypes.push(prp + " - " + this._getValType(rs[0].get(0)) + " - " + this._schemaColumn(labelCounts[b].label, prp, indexes, constraints));
                            }
                        }
                        labelCounts[b].allProperties = propTypes;
                    }
                }
                this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            } else {
                this._appendMessage("analyzing label properties switched off", false);
            }
            timeStart = Date.now();

            //
            // Label Combinations
            //
            this._appendMessage( "analyzing database (10/" + steps + "): Label Combinations and their counts...", true);
            let labelCombinationSampleUsed = false;


            if (this.analyzeLabelCombo && this.analyzeLabelCombo === true) {
                let labelCombinationQuery = "match (n) where size(labels(n)) > 1 return distinct labels(n) as labellist";
                useSample = false;
                if (nodeCount > aSampleTreshold) useSample = true;

                labelCombinationSampleUsed = useSample;
                if (useSample) {
                    labelCombinationQuery = "match (n) where rand() < " + aRandomFactor + " and size(labels(n)) > 1  with n limit " + aSampleSize + " return distinct labels(n) as labellist";
                }
                rs = await nac.runQueryRecords(this.session, labelCombinationQuery, null, this.repContainer );
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
                    rs = await nac.runQueryRecords(this.session, vraag, null, this.repContainer );
                    labelCombinations[lcom].count = rs[0].get(0);
                }
                this._appendMessage("(" + (Date.now() - timeStart) + "ms)", false);
            } else {
                this._appendMessage("analyze label combinations switch off", false);
            }
            timeStart = Date.now();

            this._appendMessage("analyzing database (11/" + steps + "): Relationship counts, and properties ...", true);
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

                rs = await nac.runQueryRecords(this.session, vraag,null, this.repContainer );
                relTypes[rcn].count = rs[0].get(0);


                if (this.analyseRelProps) {
                    if (this.analysePropsRelTypes.includes(relTypes[rcn].type)) {
                        //console.log(relTypes[rcn]);

                        if (this.sampleTreshold < relTypes[rcn].count.toNumber()) {
                            useRelationSample = true;
                        } else {
                            useRelationSample = false;
                        }
                        relTypes[rcn].sampleUsed = useRelationSample;

                        //console.log(labelOutRelMap);
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
                        this._appendMessage("--(" + (rcn + 1) + "/" + relTypes.length + ") relationship properties for relationship " + relTypes[rcn].type + " and Label: " + labels, true);
                        rs = await nac.runQueryRecords(this.session, rpvraag,null, this.repContainer );
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
                            rs = await nac.runQueryRecords(this.session, rptq, null, this.repContainer);
                            let val = rs[0].get(0);


                            relPropTypes.push(prp + " - " + this._getValType(val) + " - " + this._schemaColumn(relTypes[rcn].type, prp, indexes, constraints));
                        }
                        relTypes[rcn].allProperties = relPropTypes;
                    }

                }
            }
            this._appendMessage(" step 11 has taken " + (Date.now() - timeStart) + " ms.", true);
            this._appendMessage(" Analyzing the database has taken " + (Date.now() - analyzeStart) + " ms.", true);

            let complexityScore = (labelCounts.length + relTypes.length) * (relationCount / nodeCount);
            // console.log("ComplexityScore: " + complexityScore);
            let neoInstanceName = nac.instanceName;
            if (this.dbname !== "__") {
                neoInstanceName = nac.instanceName + ":" + this.dbname;
            }
            this.dbinfo = {
                reportName: reportName,
                reportDate: reportDate,
                neoServer: nac.neoHost,
                neoInstanceName: neoInstanceName,
                neoUser: nac.neoUser,
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
                analyzeRelProps: this.analyseRelProps,
                analyzeLabelProps: this.analyseLabelProps,
                analyzeLabelCombo: this.analyseLabelCombo,
                schemaNodes : schemaNodes,
                schemaRels : schemaRels,
                complexityScore : complexityScore
            };

        } catch(error) {
            console.log(error);
        };
        return await nac.runQuery(this.session, "return 1 as n", this.analyzewithdebug );
    }


    _getObjectType(aVal) {
        // new driver does not have v1 anymore
        let typ =  typeof aVal;
        if (neo4j.isInt(aVal)) {
            typ = "Integer";
        } else if (neo4j.isDate(aVal)) {
            typ = "Date";
        } else if (neo4j.isDateTime(aVal)) {
            typ = "ZonedDateTime"
        } else if (neo4j.isLocalDateTime(aVal)) {
            typ = "LocalDateTime"
        } else if (neo4j.isPoint(aVal)) {
            typ = "PointValue"
        } else if (neo4j.isTime(aVal)) {
            typ = "Time"
        } else if (neo4j.isLocalTime(aVal)) {
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

    _appendMessage( aString, newLine) {
        let curData = this.repContainer.innerHTML;
        if (newLine) {
            this.repContainer.innerHTML = curData + "<br/>" + aString;
        } else {
            this.repContainer.innerHTML = curData + " " + aString;
        }
    }

    _schemaColumn(aLabelorRelType, aProperty, indexes, constraints) {
        // possible return values
        // "", "U","U*","I","I*","M", "UM", "IM", "U*M", "I*M", "F", "IF", "UF",  "I*F", "U*F","IFM", "UFM","I*FM", "U*FM",
        // "U" Unique
        // "N" Node Key
        // "I" Index
        // "M" mandatory constraint
        // "I*" index over multiple fields
        // "N*" node key over multiple fields
        // "F" part of full text index  // NEW!!! We assume that Full text indexes are always multilable/column.
        // can be more than one!

        let res = "";
        let multiple = false;

        // the indexes

        // then check the indexes
        // type BTREE first

        if (indexes && indexes.length > 0) {
            // BTREE (Index and Uniqueness first
            for (let i = 0; i < indexes.length; i++) {
                let ind = indexes[i];
                if (this._arrayContains(ind.labelsOrTypes,aLabelorRelType) && this._arrayContains(ind.properties,aProperty)) {
                    if (ind.type === "BTREE") {
                        let tres = "";
                        if (ind.uniqueness === "UNIQUE") {
                            tres = "U";
                        } else {
                            tres = "I";
                        }
                        if (ind.properties.length < 2) {
                            res = res + tres;
                        } else {
                            res = res + tres + "*";
                        }
                    }
                }
            }
            // full text
            for (let i = 0; i < indexes.length; i++) {
                // get the label from the description to be backwards compatible
                let ind = indexes[i];
                if (this._arrayContains(ind.labelsOrTypes,aLabelorRelType) && this._arrayContains(ind.properties,aProperty)) {
                    if (ind.type === "FULLTEXT") {
                        res = res + "F";
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
                    if (res.indexOf("*") > 0) {
                        res = "N*";
                    } else {
                        res = "N";
                    }
                }
            }
        }
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

}

