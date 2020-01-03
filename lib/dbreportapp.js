'use strict';


class DBReportApp {
    constructor(desktopAPI) {
        this.dapi = desktopAPI;
        this.databaseApps = new Map();
        if (desktopAPI) {
            this.dapi.showMenuOnRightClick(false); // prevent annoying defatul menu
        }
        this.analyzewithdebug = false;
    }
    init() {
        //console.log("DBReportApp.init")
        // prepare the container the 'multi tab if it is a multi db'
        // in this chain of methods the ReportContainer structure is built
        this._prepareMainScreen();
        //
        // No initialise the apps (synchronous)
        //
        var keysIter = this.databaseApps.keys();
        for (let i = 0 ; i < this.databaseApps.size; i++) {
            let key = keysIter.next().value;
            let repCNT = this.databaseApps.get(key);
            repCNT.init();
        }

    }

    _prepareMainScreen() {
        //console.log("_prepareMainScreen start");
        let dbnames = [];
        let appContainer = document.getElementById("appContainer");
        let html = "";
        if (nac.neodb.majorVersion > 3) {
            for (let i = 0; i < nac.neodb.databases.length; i++) {
                let dbinfo = nac.neodb.databases[i];
                if (dbinfo.currentStatus == "online" && dbinfo.name != "system") {
                    dbnames.push(dbinfo.name);
                }
            }

            let hh = "";
            // TAB header
            hh += "<div class='ui top attached tabular menu'>";
            let act = "active ";
            for (let a = 0; a < dbnames.length; a++) {
                let databaseName = dbnames[a];
                hh += "<a class='" + act + "item' data-tab='tdbrb__" + databaseName +  "'><i class='database icon'></i>" + databaseName + "</a>";
                act = "";
            }
            hh += "</div>";
            act = "active ";
            for (let a = 0; a < dbnames.length; a++) {
                let databaseName = dbnames[a];
                let repContainer = 'repcont_' + databaseName;
                hh += this._getDBReportSegment(repContainer, databaseName, true, act);
                act = "";
            }

            appContainer.innerHTML = hh;
            // construct the ReportContainers
            for (let a = 0; a < dbnames.length; a++) {
                let databaseName = dbnames[a];
                let repContainer = 'repcont_' + databaseName;
                let repCNT = new ReportContainer(databaseName, repContainer);
                this.databaseApps.set(databaseName, repCNT);
            }



        } else {
            let app = "traceQueryApp";
            appContainer.innerHTML = this._getDBReportSegment("repcont___","",false, '');
            let repCNT = new ReportContainer("__", "repcont___");
            this.databaseApps.set("__",repCNT);
        }
        $('.menu .item')
            .tab()
        ;

    }
    _getDBReportSegment(container, databasename, intab, act) {
        //console.log("calling _getDBReportSegment with database name: " + databasename);
        let html = "";
        if (intab && intab == true) {
            html += '<div class="ui bottom attached ' + act + 'tab segment" data-tab="tdbrb__' + databasename + '">'+
                '<div id="' + container + '">db container for db ' + databasename + '</div></div>';
        } else {
            html += '</div><div id="' + container + '"></div>';
        }
        return html;
    }
    toggleDebug() {
        this.analyzewithdebug = !this.analyzewithdebug;
    }

    // function calls

    doReport(dbname) {
        //console.log("dbreportApp.doReport(" + dbname + ");");
        // get the ReportContainer for this db
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbco.doReport();
    }

    openModal(id) {
        //console.log("dbreportApp.openModal(" + id+ ");");

        let key = "#" + id;
        $(key).modal({
            inverted: true
        })
            .modal('show')
        ;
    }

    handleCountProps(dbname) {
        //console.log("dbreportApp.handleCountProps(" + dbname + ");");
        // get the ReportContainer for this db
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbco.handleCountProps();

    }

     openThreshold(dbname) {
         //console.log("dbreportApp.openThreshold(" + dbname + ");");

         $('#tresholdModal_'+ dbname).modal({
            inverted: true
        })
            .modal('show')
        ;
    }

    doResetFilter(dbname, type) {
        //console.log("dbreportApp.doResetFilter(" + dbname + "," + type + ");");
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbco._initFilter(type, true);
    }


    doDeselectAllFilter(dbname, elm) {
        //console.log("dbreportApp.doDeselectAllFilter(" + dbname + "," + elm + ");");
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbco._deselectAllFilter(elm);
    }


    handleFilterChange(dbname, elm) {
        //console.log("dbreportApp.doDeselectAllFilter(" + dbname + "," + elm + ");");
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbco.handleFilterChange(elm);

    }

    hasDBInfo(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        return repCNT.dbco.hasDBInfo();
    }

    getDBInfo(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        if (repCNT.dbco.hasDBInfo()) {
            return repCNT.dbco.dbinfo;
        }
    }


    // live functions
    doDeselectAllFilterLive(dbname,elm) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dblc._deselectAllFilterLive(elm);
    }

    doScaleChange(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dblc.doScaleChange();
    }

    doResetFilterLive(dbname,type, doall) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dblc._initFilterLive(type, doall);
    }

    doStartLiveCount(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dblc.liveCountAction("start");
    }
    doPauseLiveCount(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dblc.liveCountAction("pause");
    }
    doStopLiveCount(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dblc.liveCountAction("stop");
    }
    handleLiveChange(dbname,elm) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dblc.handleLiveChange(elm);
    }

    // model walker
    doSelectAllLabels(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo._selectAllLabels();
    }

    doDeselectAllLabels(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo._deselectAllFilter("label");
    }

    doSelectAllRelTypes(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo._selectAllRelTypes();
    }

    doDeselectAllRelTypes(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo._deselectAllFilter("rel");
    }

    showCompleteSchema(dbname) {
        //console.log("showCompleteSchema " + dbname);
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo.showCompleteSchema();
    }

    handleWalkerChange(dbname, elm) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo.handleWalkerChange(elm);
    }

    _removeWalkerRelationship(dbname, nid, type, bb) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo._removeWalkerRelationship( nid, type, bb);
    }

    _deleteWalkerNode(dbname, nodename) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo._deleteWalkerNode( nodename);
    }

    _addWalkerRelationship(dbname, nid, type, incoming) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo._addWalkerRelationship( nid, type, incoming);
    }

    walkerClear(dbname) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo.walkerClear();
    }

    changeLayout(dbname, layout) {
        let repCNT = this.databaseApps.get(dbname);
        repCNT.dbmo.changeLayout(layout);
    }
    // count properties


    openWalkerLabels(eventname) {
        let elmid = '#labelSelector_' + eventname;
        $(elmid).modal({
            inverted: true
        })
            .modal('show')
        ;
    }

    openWalkerRelations(dbname) {
        let elmid = '#labelSelector_' + dbname;
        $(elmid).modal({
            inverted: true
        })
            .modal('show')
        ;
    }
}

class ReportContainer {
    // This class will construct the HTML
    constructor(dbname, repcontainer) {
        this.dbname = dbname;
        this.container  = document.getElementById(repcontainer);
        //console.log("Constructor ReportContainer for database " + dbname);
        this._buildHTML();

    }

    async init() {
        //console.log("init ReportContainer " + this.dbname);
        this.dbco = new DBCounts(this.dbname);
        await this.dbco.init(); // now the labels and reltypes are already known
        this.lcm = this.dbco.getLabelColorMap(); // the color map is used to get consistent colors for the labels in the different tools
        this.dblc = new LiveCount(this.dbname, this.lcm);
        await this.dblc.init();
        this.dbmo = new DBModel(this.dbname, this.lcm);
        await this.dbmo.init();
    }

    _buildHTML() {
        //console.log(" ReportContainer._buildHTML " + this.dbname + " start");
        let dbnamedisplay = "";
        if (this.dbname !== "__") {
            dbnamedisplay = this.dbname;
        }
        // this will create the HTML structure for the application per database, basically what was the main part of index.html from the previouse version excluding the modal definitions.
        let html = '';
        html += '<div class="ui top attached tabular menu">\n' +
            '        <a id="analyzedb_' + this.dbname + '" class="active item" data-tab="countdb_' + this.dbname + '">Analyze Database</a>\n' +
            '        <a id="livecount_' + this.dbname + '" class="item" data-tab="livecount_' + this.dbname + '">Live Count</a>\n' +
            '        <a id="modelwalker_' + this.dbname + '" class="item disabled" data-tab="modelwalker_' + this.dbname + '">Model</a>\n' +
            '    </div>\n' +
            '\n' +
            '    <!-- Tab Analyze Database -->\n' +
            '    <div id="appCountDB_' + this.dbname + '" class="ui bottom attached active tab segment" data-tab="countdb_' + this.dbname + '" style="height: 1000px; overflow:auto;font-size: .9em; ">\n' +
            '        <form class="ui form" onsubmit="return false">\n' +
            '            <table>\n' +
            '                <tr align="left" valign="center">\n' +
            '                    <td>\n' +
            '                        <button class="ui positive compact basic icon button" onClick="dbreportApp.doReport(\'' + this.dbname + '\');"><i class="icon play"></i>Analyze Database</button>\n' +
            '                    </td>\n' +
            '                    <td>\n' +
            '                        <table >\n' +
            '                            <tr valign="center">\n' +
            '                                <td>\n' +
            '                                    <div class="ui checkbox"><input id="useLogScaleCnt_' + this.dbname + '" type="checkbox" checked="checked" title="Use Log Scale in the Bar Charts for Label and Relationship Type Counts" /><Label>Use Log Scale</Label></div>\n' +
            '                                </td>\n' +
            '                                <td>\n' +
            '                                    <button id="btCountFilterLabel_' + this.dbname + '" class="ui compact basic icon button" onClick="dbreportApp.openModal(\'filterModalLabel_' + this.dbname + '\')"><i class="icon filter"></i><label id="anp_' + this.dbname + '">Analyze Label Properties</label></button>\n' +
            '                                </td>\n' +
            '                                <td>\n' +
            '                                    <button id="btCountFilterRelationship_' + this.dbname + '" class="ui compact basic icon button" onClick="dbreportApp.openModal(\'filterModalRelationship_' + this.dbname + '\')"><i class="icon filter"></i><Label id="arp_' + this.dbname + '">Analyze Relationship Type Properties</Label></button>\n' +
            '                                </td>\n' +
            '                                <td>\n' +
            '                                    <div class="ui checkbox"><input id="analyzeLabelCombo_' + this.dbname + '" type="checkbox" onChange="dbreportApp.handleCountProps(\'' + this.dbname + '\')" /><Label>Check Label Combinations</Label></div>\n' +
            '                                </td>\n' +
            '                                <td>\n' +
            '                                    <button id="btCountTreshold_' + this.dbname + '" class="ui disabled compact basic icon button blue" onClick="dbreportApp.openThreshold(\'' + this.dbname + '\');"><i class="icon compress"></i>&nbsp;Sampling</button>\n' +
            '                                </td>\n' +
            '                            </tr>\n' +
            '                        </table>\n' +
            '                    </td>\n' +
            '                </tr>\n' +
            '            </table>\n' +
            '            <div id="helpDiv_' + this.dbname + '"></div>\n' +
            '            <br/>\n' +
            '            <div id="testmessage_' + this.dbname + '"></div>\n' +
            '        </form>\n' +
            '\n' +
            '        <div class="container" style="max-width: 100%;">\n' +
            '\n' +
            '            <div class="ui top attached tabular menu">\n' +
            '                <a id="first_' + this.dbname + '" class="item" data-tab="first_' + this.dbname + '">Summary</a>\n' +
            '                <a id="second_' + this.dbname + '" class="item" data-tab="second_' + this.dbname + '">Label Details</a>\n' +
            '                <a id="third_' + this.dbname + '" class="item" data-tab="third_' + this.dbname + '">Label Combinations</a>\n' +
            '                <a id="fourth_' + this.dbname + '" class="item" data-tab="fourth_' + this.dbname + '">Relationship Details</a>\n' +
            '                <a id="vijf_' + this.dbname + '" class="item" data-tab="vijf_' + this.dbname + '">Indexes</a>\n' +
            '                <a id="zes_' + this.dbname + '" class="item" data-tab="zes_' + this.dbname + '">Constraints</a>\n' +
            '                <a id="zeven_' + this.dbname + '" class="item" data-tab="zeven_' + this.dbname + '">Log</a>\n' +
            '            </div>\n' +
            '            <div id="tabSummary_' + this.dbname + '" class="ui bottom attached tab segment" data-tab="first_' + this.dbname + '" style="height: 800px; overflow:auto;font-size: .9em;  ">\n' +
            '                <div id="reportHeader_' + this.dbname + '"></div>\n' +
            '                <div id="appSummary_' + this.dbname + '"></div>\n' +
            '            </div>\n' +
            '            <div id="appLabelDetails_' + this.dbname + '" class="ui bottom attached tab segment" data-tab="second_' + this.dbname + '" style="height: 800px; overflow:auto;font-size: .9em; "></div>\n' +
            '            <div id="appLabelCombinations_' + this.dbname + '" class="ui bottom attached tab segment" data-tab="third_' + this.dbname + '" style="height: 800px; overflow:auto;font-size: .9em;"></div>\n' +
            '            <div id="appRelationshipDetails_' + this.dbname + '" class="ui bottom attached tab segment" data-tab="fourth_' + this.dbname + '" style="height: 800px; overflow:auto;font-size: .9em; "></div>\n' +
            '            <div id="appIndexes_' + this.dbname + '" class="ui bottom attached tab segment" data-tab="vijf_' + this.dbname + '" style="height: 800px; overflow:auto;font-size: .9em; "></div>\n' +
            '            <div id="appConstraints_' + this.dbname + '" class="ui bottom attached tab segment" data-tab="zes_' + this.dbname + '" style="height: 800px; overflow:auto;font-size: .9em; "></div>\n' +
            '            <div id="appLog_' + this.dbname + '" class="ui bottom attached tab segment" data-tab="zeven_' + this.dbname + '" style="height: 800px; overflow:auto;font-size: .9em; "></div>\n' +
            '        </div>\n' +
            '\n' +
            '    </div></div>\n' +
            '    <!-- Tab Live Count -->\n' +
            '    <div id="appLiveCountContainer_' + this.dbname + '" class="ui bottom attached tab segment" data-tab="livecount_' + this.dbname + '" style="height: 800px; overflow:auto;font-size: .9em;">\n' +
            '        <div id="msgElM_' + this.dbname + '"></div><form class="ui form" onsubmit="return false">\n' +
            '            <table>\n' +
            '                <tbody>\n' +
            '                <tr>\n' +
            '                    <td width="250px"><div style="width : 100px;" class="ui labeled small input"><div class="ui basic label">Refresh Counts (sec)</div><input id="liveViewRefreshRate_' + this.dbname + '" type="number" value=10 min=5 /></div></td>\n' +
            '                    <td width="250px"><div style="width : 100px;" class="ui labeled small input"><div class="ui basic label">Time Window (hours)</div><input id="timeWindow_' + this.dbname + '" type="number" value=1 min=1 /></div></td>\n' +
            '                    <td><button id="btStartLC_' + this.dbname + '" class="ui positive compact basic icon button" onClick="dbreportApp.doStartLiveCount(\'' + this.dbname + '\');"><i class="icon play"></i></button></td>\n' +
            '                    <td><button id="btPauseLC_' + this.dbname + '" class="ui positive disabled basic compact icon button" onClick="dbreportApp.doPauseLiveCount(\'' + this.dbname + '\');"><i class="icon pause"></i></button></td>\n' +
            '                    <td><button id="btStopLC_' + this.dbname + '" class="ui negative disabled basic compact icon button" onClick="dbreportApp.doStopLiveCount(\'' + this.dbname + '\');"><i class="icon stop"></i></button></td>\n' +
            '                    <td><button id="btLabelCountFilter_' + this.dbname + '" class="ui compact basic icon button" onClick="dbreportApp.openModal(\'filterLiveCountLabels_' + this.dbname + '\')"><i class="icon filter"></i><label id="lcl_' + this.dbname + '">Labels</label></button></td>\n' +
            '                    <td><button id="btRelCountFilter_' + this.dbname + '" class="ui compact basic icon button" onClick="dbreportApp.openModal(\'filterLiveCountRelations_' + this.dbname + '\')"><i class="icon filter"></i><label id="lcr_' + this.dbname + '">Relationship Types</label></button></td>\n' +
            '                    <td><div class="ui checkbox"><input id="useLogScale_' + this.dbname + '" type="checkbox" onChange="dbreportApp.doScaleChange(\'' + this.dbname + '\');"/><Label>Use Log Scale</Label></div></td>\n' +
            '                    <td><div class="ui basic yellow label"><p>Tip: Click on the chart to see the totals on a specific time</p></div></td>\n' +
            '                </tr>\n' +
            '                </tbody>\n' +
            '            </table>\n' +
            '        </form>\n' +
            '        Label Live Count<hr/>\n' +
            '        <div id="clabellivecount_' + this.dbname + '"></div>\n' +
            '        <br/>Relationship Live Count<hr/>\n' +
            '        <div id="crellivecount_' + this.dbname + '"></div>\n' +
            '    </div>\n' +
            '\n' +
            '    <!-- Tab Model Walker -->\n' +
            '\n' +
            '\n' +
            '    <div id="appWalker"  class="ui bottom attached tab segment" data-tab="modelwalker_' + this.dbname + '" style="height: 800px; overflow:auto;font-size: .9em; ">\n' +
            '        <table>\n' +
            '            <tr>\n' +
            '                <td width="43px" valign="top">\n' +
            '                    <div class="ui form">\n' +
            '                        <button id="btH_ChooseLabel_' + this.dbname + '" class="ui toggle compact basic icon button"  onClick="if (dbreportApp.hasDBInfo(\''+  this.dbname + '\')) dbreportApp.openWalkerLabels(\'' + this.dbname + '\');"><label style="font-size: 0.8em"><i class="icon big filter"></i>Labels</label></button>\n' +
            '                        <br/><br/>\n' +
            '                        <button id="btH_ChooseAll_' + this.dbname + '" class="ui toggle compact basic icon button"  onClick="if (dbreportApp.hasDBInfo(\''+  this.dbname + '\')) dbreportApp.showCompleteSchema(\'' + this.dbname + '\');"><label style="font-size: 0.8em; width : 100%;"><i class="icon big expand arrows alternate"></i><br/>Show All</label></button>\n' +
            '                        <br/><br/>\n' +
            '                        <button id="btH_ClearWalker_' + this.dbname + '" class="ui toggle compact basic icon button"  onClick="if (dbreportApp.hasDBInfo(\''+  this.dbname + '\'))  dbreportApp.walkerClear(\'' + this.dbname + '\');"><label style="font-size: 0.8em"><i class="icon big eraser"></i>Clear</label></button>\n' +
            '                        <br/><br/>\n' +
            '                        <button id="btH_UDViz_' + this.dbname + '" class="ui basic disabled compact icon button" onClick="if (dbreportApp.hasDBInfo(\''+  this.dbname + '\'))  dbreportApp.changeLayout(\'' + this.dbname + '\',\'UD\');"><image src="hierarchy-td.png" width="43px"></image></button>\n' +
            '                        <button id="btH_DUViz_' + this.dbname + '" class="ui basic compact icon button" onClick="if (dbreportApp.hasDBInfo(\''+  this.dbname + '\'))  dbreportApp.changeLayout(\'' + this.dbname + '\',\'DU\');"><image src="hierarchy-dt.png" width="43px"></image></button>\n' +
            '                        <button id="btH_LRViz_' + this.dbname + '" class="ui basic compact icon button" onClick="if (dbreportApp.hasDBInfo(\''+  this.dbname + '\'))  dbreportApp.changeLayout(\'' + this.dbname + '\',\'LR\');"><image src="hierarchy-lr.png" width="43px"></image></button>\n' +
            '                        <button id="btH_RLViz_' + this.dbname + '" class="ui basic compact icon button" onClick="if (dbreportApp.hasDBInfo(\''+  this.dbname + '\'))  dbreportApp.changeLayout(\'' + this.dbname + '\',\'RL\');"><image src="hierarchy-rl.png" width="43px"></image></button>\n' +
            '                        <br/><br/>\n' +
            '                        <button id="btH_DirViz_' + this.dbname + '" class="ui disabled toggle compact basic icon button"  onClick="if (dbreportApp.hasDBInfo(\''+  this.dbname + '\'))  dbreportApp.changeLayout(\'' + this.dbname + '\',\'directed\');"><label style="font-size: 0.8em">Directed</label></button>\n' +
            '                        <button id="btH_HubSizeViz_' + this.dbname + '" class="ui toggle compact basic icon button"  onClick="if (dbreportApp.hasDBInfo(\''+  this.dbname + '\'))  dbreportApp.changeLayout(\'' + this.dbname + '\',\'hubsize\');"><label style="font-size: 0.8em">Hub Size</label></button>\n' +
            '                        <br/>\n' +
            '                    </div>\n' +
            '                </td>\n' +
            '                <td valign="top" width="601px"><div id="walkerContext_' + this.dbname + '"></div><div id="graphIDwalker_' + this.dbname + '" style="width:1300px; height:735px; border-style: none; border: 0px"></div></td>\n' +
            '\n' +
            '                <td valign="top" width="300px"><div id="propsIDwalker_' + this.dbname + '" style="width: 300px; height: 100% ;" ></div></td>\n' +
            '            </tr>\n' +
            '        </table>\n' +
            '        <button class="ui compact basic button" onclick="if (dbreportApp.hasDBInfo("'+  this.dbname + '")) dbreportApp.showWalkerHelp(\'' + this.dbname + '\')"><label><i class="icon big blue question circle outline"></i></label></button>\n' +
            '    </div>\n';
        // adding modals for property selection dbcount section
        html += '<!--  Modal For Sampling Thresholds -->\n' +
            '<div class="ui modal" id="tresholdModal_' + this.dbname + '"><i class="close icon"></i>\n' +
            '    <div class="header">Sampling ' + dbnamedisplay + '</div>\n' +
            '    <div class="content">\n' +
            '        <p>Sampling is used to determine Label Combinations, Node Properties and Relationship Properties when the<br/> specific counts are higher than the Sample Treshold:</p>\n' +
            '        <div class="ui list">\n' +
            '            <div class="item">\n' +
            '                <div class="content">\n' +
            '                    <div class="header">Label Combinations</div>\n' +
            '                    <div class="description">When the Node Count is &gt; Sample Treshold then sampling is used</div>\n' +
            '                </div>\n' +
            '            </div>\n' +
            '            <div class="item">\n' +
            '                <div class="content">\n' +
            '                    <div class="header">Node Properties</div>\n' +
            '                    <div class="description">When the Label Node Count is &gt; Sample Treshold then sampling is used</div>\n' +
            '                </div>\n' +
            '            </div>\n' +
            '            <div class="item">\n' +
            '                <div class="content">\n' +
            '                    <div class="header">Relationship Properties</div>\n' +
            '                    <div class="description">When the Relationship Type Count is &gt; Sample Treshold then sampling is used</div>\n' +
            '                </div>\n' +
            '            </div>\n' +
            '        </div>\n' +
            '\n' +
            '        <br/>\n' +
            '        <hr/>\n' +
            '        <table>\n' +
            '            <tr>\n' +
            '                <td>\n' +
            '                    <div>Sample Treshold</div>\n' +
            '                    <div><input id="sampleTreshold_' + this.dbname + '" value="10000000"/></div>\n' +
            '                </td>\n' +
            '                <td>\n' +
            '                    <div>Max Sample Size</div>\n' +
            '                    <div><input id="sampleSize_' + this.dbname + '" value="1000000"/></div>\n' +
            '                </td>\n' +
            '                <td>\n' +
            '                    <div>Random Factor (between 0 and 1)</div>\n' +
            '                    <div><input id="randomFactor_' + this.dbname + '" value="0.3"/></div>\n' +
            '                </td>\n' +
            '            </tr>\n' +
            '        </table>\n' +
            '\n' +
            '    </div>\n' +
            '    <div class="actions">\n' +
            '        <div class="ui approve button">Close</div>\n' +
            '    </div>\n' +
            '</div>\n' +
            '\n' +
            '\n' +
            '\n' +
            '<!--  Modal For Property Filter Label-->\n' +
            '\n' +
            '<div class="ui fullscreen modal" id="filterModalLabel_' + this.dbname + '"><i class="close icon"></i>\n' +
            '  <div class="header">Label Filter ' + dbnamedisplay + '</div>\n' +
            '  <div class="content">\n' +
            '      <div class=\'sixteen wide column\'>When you select a label then the properties of the Nodes with that label are analyzed.</div>\n' +
            '      <div class=\'sixteen wide column\'><table><tr>\n' +
            '          <td><button class="compact ui basic button" onClick="dbreportApp.doResetFilter(\''+ this.dbname + '\',\'label\');"><i class="icon check circle outline"></i>All</button></td>\n' +
            '          <td><button class="compact ui basic button" onClick="dbreportApp.doDeselectAllFilter(\''+ this.dbname + '\',\'label\');"><i class="icon circle outline"></i>All</button></td>\n' +
            '      </tr></table></div>\n' +
            '      <div id="labelFilterReport_' + this.dbname + '" style="height: 400px; overflow:auto;font-size: .9em;  margin: 1em 0;"></div>\n' +
            '  </div>\n' +
            '</div>\n' +
            '\n' +
            '\n' +
            '<!--  Modal For Property Filter Relationship-->\n' +
            '\n' +
            '<div class="ui fullscreen modal" id="filterModalRelationship_' + this.dbname + '"><i class="close icon"></i>\n' +
            '    <div class="header">Relationship Type Filter ' + dbnamedisplay + '</div>\n' +
            '    <div class="content">\n' +
            '        <div class=\'sixteen wide column\'>When you select a Relationship Type then the properties of the relationships with that Relationship Type are analyzed.</div>\n' +
            '        <div class=\'sixteen wide column\'>\n' +
            '            <table><tr>\n' +
            '                <td><button class="compact ui basic button" onClick="dbreportApp.doResetFilter(\''+ this.dbname + '\',\'rel\');"><i class="icon check circle outline"></i>All</button></td>\n' +
            '                <td><button class="compact ui basic button" onClick="dbreportApp.doDeselectAllFilter(\''+ this.dbname + '\',\'rel\');"><i class="icon circle outline"></i>All</button></td>\n' +
            '            </tr></table>\n' +
            '        </div>\n' +
            '        <div id="reltypeFilter_' + this.dbname + '" style="height: 400px; overflow:auto;font-size: .9em;  margin: 1em 0;">\n' +
            '\n' +
            '        </div>\n' +
            '    </div>\n' +
            '</div>';

        // adding live count filter modals
        html += '<div class="ui fullscreen modal" id="filterLiveCountLabels_' + this.dbname + '"><i class="close icon"></i>\n' +
            '\n' +
            '    <div class="header">Live Count Label Filter</div>\n' +
            '    <div class="content">\n' +
            '        <div class=\'ui grid\'>\n' +
            '            <div class=\'sixteen wide column\'>Select the Labels to follow with the Live Count</div>\n' +
            '        </div>\n' +
            '        <table><tr>\n' +
            '            <td><button class="compact ui basic button" onClick="dbreportApp.doResetFilterLive(\'' + this.dbname + '\',\'label\', true);"><i class="icon check circle outline"></i>All</button></td>\n' +
            '            <td><button class="compact ui basic button" onClick="dbreportApp.doDeselectAllFilterLive(\'' + this.dbname + '\',\'label\');"><i class="icon circle outline"></i>All</button></td>\n' +
            '        </tr></table>\n' +
            '        <div id="labelFilterLive_'+ this.dbname + '" style="height: 400px; overflow:auto;font-size: .9em;  margin: 1em 0;">\n' +
            '\n' +
            '        </div>\n' +
            '    </div>\n' +
            '</div>\n' +
            '\n' +
            '\n' +
            '\n' +
            '<div class="ui fullscreen modal" id="filterLiveCountRelations_' + this.dbname + '"><i class="close icon"></i>\n' +
            '\n' +
            '    <div class="header">Live Count Relationship Type Filter</div>\n' +
            '    <div class="content">\n' +
            '        <div class=\'ui grid\'>\n' +
            '            <div class=\'sixteen wide column\'>Select the Relationship Types to follow with the Live Count</div>\n' +
            '        </div>\n' +
            '        <table><tr>\n' +
            '            <td><button class="compact ui basic button" onClick="dbreportApp.doResetFilterLive(\'' + this.dbname + '\',\'rel\', true);"><i class="icon check circle outline"></i>All</button></td>\n' +
            '            <td><button class="compact ui basic button" onClick="dbreportApp.doDeselectAllFilterLive(\'' + this.dbname + '\',\'rel\');"><i class="icon circle outline"></i>All</button></td>\n' +
            '        </tr></table>\n' +
            '        <div id="reltypeFilterLive_'+ this.dbname + '" style="height: 400px; overflow:auto;font-size: .9em;  margin: 1em 0;"></div>\n' +
            '    </div>\n' +
            '</div>';
        // addding model walker stuff
        html += '<!-- Modal for Walker Labels -->\n' +
            '\n' +
            '  <div class="ui fullscreen modal" id="labelSelector_' + this.dbname + '"><i class="close icon"></i>\n' +
            '\n' +
            '      <div class="header">Select Label(s)</div>\n' +
            '      <div class="content">\n' +
            '          <div class=\'ui grid\'>\n' +
            '              <div class=\'sixteen wide column\'>Select Label(s) to show in the Model Walker</div>\n' +
            '              <div class=\'sixteen wide column\'>\n' +
            '                  <table><tr>\n' +
            '                      <td><button class="compact ui basic button" onClick="dbreportApp.doSelectAllLabels(\'' + this.dbname + '\');"><i class="icon check circle outline"></i>All</button></td>\n' +
            '                      <td><button class="compact ui basic button" onClick="dbreportApp.doDeselectAllLabels(\'' + this.dbname + '\');"><i class="icon circle outline"></i>All</button></td>\n' +
            '                  </tr></table>\n' +
            '              </div>\n' +
            '          </div>\n' +
            '          <div id="walkerLabelSelector_' + this.dbname + '" style="height: 400px; overflow:auto;font-size: .9em;  margin: 1em 0;"></div>\n' +
            '      </div>\n' +
            '  </div>\n' +
            '\n' +
            '<!-- Modal for Walker Relations  relSelector -->\n' +
            '        <div class="ui fullscreen modal" id="relSelector_' + this.dbname + '"><i class="close icon"></i>\n' +
            '\n' +
            '            <div class="header">Select Relationship Type(s)</div>\n' +
            '            <div class="content">\n' +
            '                <div class=\'ui grid\'>\n' +
            '                    <div class=\'sixteen wide column\'>Select Relationship Types(s) to show in the Model Walker</div>\n' +
            '                    <div class=\'sixteen wide column\'>\n' +
            '                        <table><tr>\n' +
            '                            <td><button class="compact ui basic button" onClick="dbreportApp.doSelectAllRelTypes(\'' + this.dbname + '\');"><i class="icon check circle outline"></i>All</button></td>\n' +
            '                            <td><button class="compact ui basic button" onClick="dbreportApp.doDeselectAllRelTypes(\'' + this.dbname + '\');"><i class="icon circle outline"></i>All</button></td>\n' +
            '                        </tr></table>\n' +
            '                    </div>\n' +
            '                </div>\n' +
            '                <div id="walkerRelSelector_' + this.dbname + '" style="height: 400px; overflow:auto;font-size: .9em;  margin: 1em 0;"></div>\n' +
            '            </div>\n' +
            '        </div>\n';

        this.container.innerHTML = html;
        // now we have the tab's we have to register an eventhanlder on tab change:

        $('.top.menu .item')
            .tab({'onVisible':function(e){ alert('called'); }   })
        ;
        $('.ui.accordion')
            .accordion()
        ;



        //console.log(" ReportContainer._buildHTML " + this.dbname + " end");
    }

}