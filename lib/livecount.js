'use strict';

class LiveCount {
    constructor(desktopAPI, neoAccessor) {
        this.dapi = desktopAPI;
        this.dapi.showMenuOnRightClick(false); // prevent annoying defatul menu
        this.lastDoubleClick = Date.now();
        this.nea = neoAccessor;
        this.labelFilterLive = [];
        this.relTypeFilterLive = [];
        this.session;
    }

    init() {
        if (this.nea) {
            this._initFilterLive();
        } else {
            console.log("ERROR Livecount needs a neo4j Accessor Object");
        }
    }

    async _initFilterLive (type) {
        this.session = this.nea.getReadSession();
        // label list
        let doLabels = true;
        let doRelations = true;
        if (type && type == "label") {
            doRelations = false;
        } else if (type && type ==  "rel") {
            doLabels = false;
        }

        if (doLabels) {
            this.labelFilterLive = await this.nea.getLabels(this.session);
            // all labels

            let htmlLabelFilter = document.getElementById("labelFilterLive");
            htmlLabelFilter.innerHTML = this._createLiveCheckTable(this.labelFilterLive, 'label');
        }
        if (doRelations) {
            // relation list
            this.relTypeFilterLive = await this.nea.getRelationshipTypes(this.session);
            let htmlRelTypeFilter = document.getElementById("reltypeFilterLive");
            htmlRelTypeFilter.innerHTML = this._createLiveCheckTable(this.relTypeFilterLive, 'rel');
        }
    }

    _createLiveCheckTable(aList, listtype) {
        aList.sort();
        // by default only take the first element selected
        let c = "<div class='ui grid'>";
        let removedValues = [];

        for (let i = 0; i < aList.length; i++) {
            if (i == 0) {
                c += "<div class='three wide column'><div class='ui checkbox'><input checked=checked name='cb" + listtype + "_live_' value='" + aList[i] + "'  type=\"checkbox\" onChange=\"handleLiveChange(this)\"/><Label>" + aList[i] + "</Label></div></div>";
            } else {
                c += "<div class='three wide column'><div class='ui checkbox'><input name='cb" + listtype + "_live_' value='" + aList[i] + "'  type=\"checkbox\" onChange=\"handleLiveChange(this)\"/><Label>" + aList[i] + "</Label></div></div>";
                removedValues.push(aList[i]);
            }
        }
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
        c += "</div>";
        return c;
    }


    doScaleChange() {
        // useLogScale
        this.liveCountLogScale = document.getElementById("useLogScale").checked;
        this.liveCountAction("stop");
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
            if (current.labelFilterLive.length > 0) {

                //  get all the labels
                let rs = await current.nea.getLabels(current.session);
                let labelcntquery = "";
                let lii = 0;
                for (let i = 0; i < rs.length; i++) {
                    let lbl = rs[i].toString();
                    if (current.labelFilterLive.includes(lbl)) {

                        if (lii > 0) {
                            labelcntquery += " union all "
                        }
                        labelcntquery += "MATCH (n:`" + lbl + "`) return { type:'" + lbl + "', count:count(n), time:timestamp() } as data";
                        lii++;
                    }
                }
                ;
                let labelcount = rs.length;
                // label counts
                // let tStart = Date.now();
                rs = await current.nea.runQuery(current.session, labelcntquery);

                // loop over the query results and update the liveCountLabelData Map
                if (!current.labelcount_dataSet) {
                    current.labelcount_dataSet = new vis.DataSet();
                    current.labelcount_groups = new vis.DataSet();
                }
                // collect the new items in an array and add those once otherwise the timeline will
                // start plotting after each single item 'add'
                let labelitems = [];
                for (let lic = 0; lic < rs.length; lic++) {
                    let dataMap = rs[lic].get("data");
                    // check group
                    if (!current.labelcount_groups.get(dataMap.type)) {
                        current.labelcount_groups.add({id: dataMap.type, content: dataMap.type, style: "stroke: " + lcm.getLabelColor(dataMap.type) +";", options : { drawPoints : {styles : "stroke: " + lcm.getLabelColor(dataMap.type) +";" }}});
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


                let options = current._timelineOptions(current.labelFilterLive.length, timeWindowStart, timeWindowEnd);
                // create the timeline chart if is not there yet, otherwise set the timewindow if that one is changed
                if (!current.livelblcount) {
                    current.livelblcount = new vis.Graph2d(clabelContainer, current.labelcount_dataSet, current.labelcount_groups, options);
                    // adding event listener
                    current.livelblcount.on("click", function (properties) {
                        current._liveCountClick('Label', properties, current.livelblcount.itemsData);
                    });
                } else {
                    if (timeWindowEndChanged) {
                        current.livelblcount.setOptions({end: timeWindowEnd});
                    }
                }
            }
            if (current.relTypeFilterLive.length > 0) {
                // relationships
                let relcntquery = "";
                let rs = await current.nea.runQuery(current.session, "call db.relationshipTypes() yield relationshipType return relationshipType");
                let rii = 0;
                for (let ri = 0; ri < rs.length; ri++) {
                    let relType = rs[ri].get("relationshipType").toString();
                    if (current.relTypeFilterLive.includes(relType)) {
                        if (rii > 0) {
                            relcntquery += " union all "
                        }
                        relcntquery += "MATCH ()-[r:`" + relType + "`]->() return { type:'" + relType + "', count:count(r), time:timestamp() } as data";
                        rii++;
                    }
                }

                // relationship count
                let relcount = rs.length;
                // label counts
                // tStart = Date.now();
                rs = await current.nea.runQuery(current.session, relcntquery);
                // loop over the query results and update the liveCountLabelData Map

                if (!current.relcount_dataSet) {
                    current.relcount_dataSet = new vis.DataSet();
                    current.relcount_groups = new vis.DataSet();
                }
                let relitems = [];
                for (let lic = 0; lic < rs.length; lic++) {
                    let dataMap = rs[lic].get("data");
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


                let options = current._timelineOptions(current.relTypeFilterLive.length, timeWindowStart, timeWindowEnd);

                // create the timeline chart if is not there yet, otherwise set the timewindow if that one is changed

                if (!current.liverelcount) {
                    current.liverelcount = new vis.Graph2d(crelContainer, current.relcount_dataSet, current.relcount_groups, options);
                    // adding event listener
                    current.liverelcount.on("click", function (properties) {
                        current._liveCountClick('Relationship', properties, current.liverelcount.itemsData);
                    });
                } else {
                    if (timeWindowEndChanged) {
                        current.liverelcount.setOptions({end: timeWindowEnd});
                    }
                }
            }
            // planning the next count call
            if (current.liveCount == true) {
                setTimeout(current._liveViewCount, timeout, current);
            }
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



    startLiveCount() {
        this.liveCount = true;
        setTimeout(this._liveViewCount,1000, this);
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


    liveCountAction(action) {
        // btStartLC
        // btPauseLC
        // btStopLC
        if (action == "start") {
            this.startLiveCount();
            // disable start butten
            this._disableElement("btStartLC");
            // enable pause button
            this._enableElement("btPauseLC");
            // enable stop button
            this._enableElement("btStopLC");
        }  else if (action == "pause") {
            this.liveCount = false;
            // enable start button
            this._enableElement("btStartLC");
            // disable pause button
            this._disableElement("btPauseLC");
        } else if (action == "stop") {
            this.liveCount = false;

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

            // disable stop button
            this._disableElement("btStopLC");
            // enable start button
            this._enableElement("btStartLC");
            // disable pause button
            this._disableElement("btPauseLC");

        }
    }

    // events
    handleLiveChange(elm) {
        if (elm.name.startsWith("cblabel_live_") ) {
            // label change
            this._handleFilter(this.labelFilterLive, elm.value, elm.checked);
        } else {
            // reltype change
            this._handleFilter(this.relTypeFilterLive, elm.value, elm.checked);
        }

    }

    _timelineOptions(itemCount, tStart, tEnd) {
        let calculatedHeight = itemCount * 22; // px per label
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
        if (this.liveCountLogScale == true) {


            options.dataAxis =  { left: { format : function (value) {
                        if (value < 0) {
                            return '- ' + Math.pow(10, value).toFixed(0);
                        } else if (value == 0) {
                            return '' + 0;
                        } else {
                            return ' ' + Math.pow(10, value).toFixed(0);
                        }

                    }}};
        }

        return options;

    }
    _deselectAllFilterLive(type) {
        let elements = document.getElementsByName("cb" + type + "_live_");
        for (let i=0 ; i < elements.length; i++) {
            elements[i].checked = false;
            this.handleLiveChange(elements[i]);
        }
    }


// utilities
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

}