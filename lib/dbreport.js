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
            cc = this.colorMap.get(aLabel);
        }
        return cc;
    }
    async init() {
        let prms;
    }
}





class DBCounts {

    constructor(dbname) {
        this.dbname = dbname;
        this.lastDoubleClick = Date.now();
        this.logScale = false;
        this.labelCount = 0;
        this.relTypeCount = 0;
        this.desktopContext = 0;
        this.dbInstanceName = "";
        let msg = document.getElementById("testmessage_" + this.dbname);
        this.lcm;
    }

    async init() {
        let prms;
        //console.log("init start");
        if (!nac.neoConnection) {
            console.log(" No active Database to connect to start the database first!");
            msg.innerHTML = "No active Database to connect to start the database first!"
        } else {
            this.session = nac.getReadSession(this.dbname);

            await this._initFilter("", false);
            prms = this._initColorMap();
        }
        await prms;
        return prms;
    }
    getLabelColorMap() {
        return this.lcm;
    }
    async doReport() {
        let aSampleTreshold = Number(document.getElementById("sampleTreshold_" + this.dbname ).value);

        let sSampleSize = Number(document.getElementById("sampleSize_" + this.dbname ).value);

        let aRandomFactor = Number(document.getElementById("randomFactor_" + this.dbname ).value);
        let selectedLabels = 0;
        let selectedRelTypes = 0;
        if (this.labelFilter && this.labelFilter.length) {
            selectedLabels = this.labelFilter.length;
        }
        if (this.relTypeFilter && this.relTypeFilter.length) {
            selectedRelTypes = this.relTypeFilter.length;
        }
        let analyzeLabelProps = selectedLabels > 0;
        let analyzeRelProps = selectedRelTypes > 0;
        let analyzeLabelCombo = document.getElementById("analyzeLabelCombo_" + this.dbname ).checked;

        let d1 = await this.analyseDB(aSampleTreshold, sSampleSize, aRandomFactor, analyzeLabelProps, analyzeRelProps, analyzeLabelCombo  );
        this.runReport( aSampleTreshold, sSampleSize, this.dbinfo);
    }

    hasDBInfo() {
        if (this.dbinfo && this.dbinfo !== null) {
            return true;
        } else {
            return false;
        }
    }

    _checkParameters() {
        let lblfilter = document.getElementById("anp_" + this.dbname);
        let selectedLabels = 0;
        if (this.labelFilter) {
            selectedLabels = this.labelFilter.length;
        }
        lblfilter.innerHTML = "Analyze Label Properties (" + selectedLabels + "/" + this.labelCount + ")";

        let relfilter = document.getElementById("arp_" + this.dbname);
        let selectedRels = 0;
        if (this.relTypeFilter) {
            selectedRels =  this.relTypeFilter.length;
        }
        relfilter.innerHTML = "Analyze Relationship Type Properties (" + selectedRels + "/" + this.relTypeCount + ")";

        let lblcombo = document.getElementById("analyzeLabelCombo_" + this.dbname);

        if (selectedLabels > 0 || selectedRels > 0 || lblcombo.checked == true) {
            // enable
            this._enableElement("btCountTreshold_" + this.dbname);
        } else {
            // disable
            this._disableElement("btCountTreshold_" + this.dbname);
        }
    }

    async _initColorMap() {
        let lbls = await nac.getLabels(this.session);
        this.lcm = new LabelColorMap();
        this.lcm.buildColorMap(lbls);
    }

    async _initFilter (type, checked) {
        //console.log("DBCounts._initFilter start");
        // label list
        let doLabels = true;
        let doRelations = true;
        if (type && type == "label") {
            doRelations = false;
        } else if (type && type ==  "rel") {
            doLabels = false;
        }

        if (doLabels) {
            this.labelFilter = await nac.getLabels(this.session);
            this.labelCount = this.labelFilter.length;


            // build label color map
            //this._buildColorMap(this.labelFilter);
            let htmlLabelFilter = document.getElementById("labelFilterReport_" + this.dbname);
            htmlLabelFilter.innerHTML = this._createCheckTable(this.labelFilter, 'label', checked);
        }
        if (doRelations) {
            // relation list
            this.relTypeFilter = await nac.getRelationshipTypes(this.session);
            this.relTypeCount = this.relTypeFilter.length;
            let htmlRelTypeFilter = document.getElementById("reltypeFilter_" + this.dbname);
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
                c += "<div class='three wide column'><div class='ui checkbox'><input checked='checked' name='cb" + listtype + "_filter_" + this.dbname + "' value='" + aList[i] + "'  type=\"checkbox\" onChange=\"dbreportApp.handleFilterChange('" + this.dbname + "',this)\"/><Label>" + aList[i] + "</Label></div></div>";
            } else {
                c += "<div class='three wide column'><div class='ui checkbox'><input name='cb" + listtype + "_filter_" + this.dbname + "' value='" + aList[i] + "'  type=\"checkbox\" onChange=\"dbreportApp.handleFilterChange('" + this.dbname + "',this)\"/><Label>" + aList[i] + "</Label></div></div>";
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
        let elements = document.getElementsByName("cb" + type + "_filter_" + this.dbname);
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

    // _schemaColumn(aLabelorRelType, aProperty, indexes, constraints) {
    //     // possible return values
    //     // "", "U","U*","I","I*","M", "UM", "IM"
    //     // "U" Unique
    //     // "N" Node Key
    //     // "I" Index
    //     // "M" mandatory constraint
    //     // "UM" Unique contraint + mandatory constraint
    //     // "I*" index over multiple fields
    //     // "N*" node key over multiple fields
    //
    //     let res = "";
    //     let multiple = false;
    //
    //     // the indexes
    //
    //     // then check the indexes
    //     if (indexes && indexes.length > 0) {
    //         for (let i = 0; i < indexes.length; i++) {
    //             // get the label from the description to be backwards compatible
    //             let ind = indexes[i];
    //             let colonpos = ind.description.indexOf(":");
    //             let brpos = ind.description.indexOf("(");
    //             let brpos2 = ind.description.indexOf(")");
    //
    //             let label = ind.description.substring(colonpos + 1, brpos);
    //             let props = ind.description.substring(brpos + 1, brpos2).split(',');
    //
    //             if (label == aLabelorRelType) {
    //                 if (this._arrayContains(props,aProperty )) {
    //                     if (ind.type == "node_label_property") {
    //                         res = "I";
    //                     } else {
    //                         res = "U";
    //                     }
    //                     if (ind.properties && ind.properties.length > 1) {
    //                         multiple = true;
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //
    //     // we use the contraints to find the mandatory contraints
    //     if (constraints && constraints.length > 0) {
    //         for (let i = 0; i < constraints.length; i++) {
    //             let curdesc = constraints[i].description;
    //             // mandatory exists constraint
    //             if (curdesc.indexOf(":" + aLabelorRelType + " ") > 0 && curdesc.indexOf("." + aProperty) > 0 && curdesc.indexOf("exists(") > 0) {
    //                 res = res + "M";
    //             }
    //             // node key
    //             if (curdesc.indexOf(":" + aLabelorRelType + " ") > 0 && curdesc.indexOf("." + aProperty) > 0 && curdesc.indexOf("IS NODE KEY") > 0) {
    //                 res = "N";
    //             }
    //         }
    //     }
    //     if (multiple) { res = res + "*"};
    //    // console.log("aLabelorRelType: " + aLabelorRelType + " aProperty: " + aProperty + " res:" + res);
    //     return res;
    // }

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
        this._clear();
        this.repContainer = document.getElementById("appSummary_" + this.dbname);
       // console.log(this.repContainer);

        // use a read session
        // check if db is available:
        if (!nac.neoConnection) {
            this.repContainer.innerHTML = "<div class='ui warning message'><div class='header'>WARNING</div><p>No active Database connection</p></div>";
            return;
        }

        try {
            // smaller than version 3 is not possible, there is no bolt

            if (nac.neodb.majorVersion == 3) {
                if (nac.neodb.minorVersion < 2) {
                    this.repContainer.innerHTML = "<div class='ui warning message'><div class='header'>WARNING</div><p>Neo4j Version must be from 3.2 and up</p></div>";
                    return
                }


                // aDesktopInstanceName, aNeoAccessor, aRepElement, aSampleTreshold, aSampleSize, aRandomFactor, aAnalyzeLabelProps, aAnalyzeRelProps, aAnalyzeLabelCombo, aAnalyseWithDebug, alabelList, aRelTypeList
                let analyzer = new LegacyDBAnalyzer(this.dbInstanceName
                    , this.neoHost
                    , this.repContainer
                    , aSampleTreshold
                    , aSampleSize
                    , aRandomFactor
                    , analyzeLabelProps
                    , analyzeRelProps
                    , analyzeLabelCombo
                    , dbreportApp.analyzewithdebug
                    , this.labelFilter
                    , this.relTypeFilter);
                await analyzer.analyseDB();
                this.dbinfo = analyzer.dbinfo;
            } else if (nac.neodb.majorVersion == 4) {
                // not supported yet!
                // this.repContainer.innerHTML = "<div class='ui warning message'><div class='header'>WARNING</div><p>Neo4j Version " + this.dbms.majorVersion + " is not supported yet</p></div>";
                // return;
                // dbName, aDesktopInstanceName, aNeoAccessor, aRepElement, aSampleTreshold, aSampleSize, aRandomFactor, aAnalyzeLabelProps, aAnalyzeRelProps, aAnalyzeLabelCombo, aAnalyseWithDebug, alabelList, aRelTypeList
                let analyzer = new MultiDBAnalyzer(this.dbname
                    , this.dbInstanceName
                    , this.neoHost
                    , this.repContainer
                    , aSampleTreshold
                    , aSampleSize
                    , aRandomFactor
                    , analyzeLabelProps
                    , analyzeRelProps
                    , analyzeLabelCombo
                    , dbreportApp.analyzewithdebug
                    , this.labelFilter
                    , this.relTypeFilter);
                await analyzer.analyseDB();
                this.dbinfo = analyzer.dbinfo;

            }


            // enable tab's
            this._enableElement("modelwalker_" + this.dbname);
             // this._enableElement("modeltools");
         } catch(error) {
            console.log(error);
         };
        return await nac.runQuery(this.session, "return 1 as n");
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
        document.getElementById("appSummary_" + this.dbname).innerHTML = "";
        document.getElementById("appLog_" + this.dbname).innerHTML = "";
        document.getElementById("appLabelDetails_" + this.dbname).innerHTML= "";
        document.getElementById("appLabelCombinations_" + this.dbname).innerHTML = "";
        document.getElementById("appRelationshipDetails_" + this.dbname).innerHTML = "";
        document.getElementById("reportHeader_" + this.dbname).innerHTML = "";
        document.getElementById("appIndexes_" + this.dbname).innerHTML = "";
        document.getElementById("appConstraints_" + this.dbname).innerHTML = "";
        //
        // Make Summary the active tab again
        //
        $('.menu .item').tab("change tab", "first_" + this.dbname);

    }


    async runReport(aSampleTreshold, aSampleSize, aData) {
        let tabSummary = document.getElementById("appSummary_" + this.dbname);
        let tabLabelDetails = document.getElementById("appLabelDetails_" + this.dbname);
        let tabLabelCombinations = document.getElementById("appLabelCombinations_" + this.dbname);
        let tabRelationshipDetails = document.getElementById("appRelationshipDetails_" + this.dbname);
        let reportHeader = document.getElementById("reportHeader_" + this.dbname);
        let tabIndexes = document.getElementById("appIndexes_" + this.dbname);
        let tabConstraints = document.getElementById("appConstraints_" + this.dbname);
        let tabLiveCountContainer = document.getElementById("appLiveCountContainer_" + this.dbname);

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
        document.getElementById("appLog_" + this.dbname).innerHTML = reportLog;
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
        headerhtml += "<td><div class='ui message'><div class='header'>Database Overview for</div><p>" + rdat.neoInstanceName + "&nbsp;</p></div></td>";
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

        summaryhtml += "<div id='chart1_" + this.dbname + "' style='height: 200px'></div>";

        // chart with relationship and counts here
        summaryhtml += "<br/>Relationship Type Counts<hr/>";
        summaryhtml += "<div id='chart2_" + this.dbname + "' style='height: 200px'></div>";
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
        } else {
            labelcombohtml = "no label combinations detected"
        }


		// store info
        summaryhtml += "<br/>Store Info (total store size: " + this._byteToMb(rdat.storeSizes.totalStoreSize) +" M)<hr/>";

        // summaryhtml += "<table><tr valign='top'><td>";
        if (nac.neodb.majorVersion < 4) {
            summaryhtml += "<div id='piec_" + this.dbname + "'></div>";
        }

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

        if (nac.neodb.majorVersion < 4) {
            let pie = c3.generate({bindto: '#piec_' + this.dbname,size: {
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

        }

        this.logScale = document.getElementById("useLogScaleCnt_" + this.dbname).checked;
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
        //let current = this;
        let crchart1 = c3.generate({
            bindto: '#chart1_' + this.dbname,
            data : { columns :[
                               ['count'].concat(labelcseries)
                         ],
                    type: 'bar',
                    color: function(inColor, data) {
                        if(data.index !== undefined) {
                            return current.lcm.getLabelColor(current.chartlabels[data.index]);
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
            bindto: '#chart2_' + this.dbname,
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

