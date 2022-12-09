/****************************************************************************
 ** Neo4j Database Accessor using bolt
 **
 ***************************************************************************/
'use strict';


class NeoAccessor {


    constructor(desktopAPI, dataDependentApp) {
        this.dapi = desktopAPI;
        this.useEnc = false;
        this.neoConnection = false;
        // the function init() will be called on this app
        // when there is a database connection
        this.dataDependentApp = dataDependentApp;
        this.queryDebug = false;
        this.instanceName = "";
        this.urlCreds =  this.checkCredentials();

    }

    toggleQueryDebug() {
        this.queryDebug = !this.queryDebug;
        return this.queryDebug;
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


    async init() {
        let prms;
        if (this.dapi) {
            let current = this;
            prms = this.dapi.getContext();
            prms.then(function (value) {
                current.desktopContext = value;
            });
            await prms;

            this.graphdb = this._getActiveDatabase();

            //
            // Connect to Neo4 only if the neoHost or the neoUser is changed
            //
            if (this.graphdb) {
                this.instanceName = "Desktop/" + this.graphdb.name;
                let nh = this.graphdb.connection.configuration.protocols.bolt.host;
                let nu = this.graphdb.connection.configuration.protocols.bolt.username;
                let initDriver = false;
                if (this.neoHost) {
                    if (this.neoHost != nh || this.neoUser != nu) {
                        initDriver = true;
                    }
                } else {
                    // first time
                    initDriver = true;
                }
                if (initDriver == true) {
                    this.neoHost = nh;
                    this.neoUser = nu;
                    // todo find out the the bolt scheme from the bolt context
                    this.neo4jApiUrl = "bolt" + "://" + this.neoHost + ":" + this.graphdb.connection.configuration.protocols.bolt.port;
                    // check if it is an aura connection a neo4j+s connection maybe used here
                    this.useEnc = (this.neoHost.indexOf("neo4j.io") > -1);
                    this.neo4jDriver = this.getDriver(this.graphdb.connection.configuration.protocols.bolt.password);
                    this.neoConnection = true;
                    // console.log("Connected to database server " + this.neoHost + " with user " + this.neoUser) ;
                    prms= this.getNeo4jVersion();
                    await prms;
                    await this.dataDependentApp.init();

                }
            } else {
//                console.log(" No active Database, start a database in the Neo4j Desktop first");
                // this.showModalWindow("Error"," No active Database, start a database in the Neo4j Desktop first and open this tool again.");
                await this.showConnectForm();
            }
        }  else {
            await this.showConnectForm();
            // console.log(" No active Database, start a database in the Neo4j Desktop first")
        }
        await prms;
        return prms;
    }
    checkCredentials() {
        // checking if there are credentials passed via an url parameter
        // the url parameters are: url (scheme://host[:port], user, database
        let maxSizeHost = 255;
        let maxSizeUsername = 255;
        let maxSizePort = 6;
        let maxSizeDbName = 50;
        let queryString = window.location.search;
        let urlParams = new URLSearchParams(queryString);

        let uport = "7687";
        let uhost = "";
        let uname = "";
        let uscheme = "";
        let udbname = "";

        if (urlParams.has('url') === true) {
            let parts = urlParams.get('url').split(":");
            uscheme = parts[0];
            uhost = parts[1].replaceAll('/','');
            if (parts.length == 3) {
                // port is used
                uport = "" + parts[2];
            }
        }
        if (urlParams.has('user') === true) {
            uname = urlParams.get('user');
        }
        if (urlParams.has('database')) {
            udbname = urlParams.get('database');
        }

        // console.log("uname: " + uname + " l:" + uname.length );
        // console.log("uhost: " + uhost + " l:" + uhost.length);
        // console.log("udbname: " + udbname + " l:" + udbname.length);
        // console.log("uport: " + uport + " l:" + uport.length);

        if (uname.length <= maxSizeUsername
            && udbname.length <= maxSizeDbName
            && uhost.length <= maxSizeHost
            && uport.length <= maxSizePort
        ) {
            // console.log("valid parameters");
            let useEnc = false;
            if (uscheme.indexOf("+s") > -1 ) {
                useEnc = true;
            }
            this.neoUser = uname;
            this.neoHost = uhost;
            this.neoDbName = udbname;
            this.neoPort = uport;
            return true;
        } else {
            console.log("invalid parameters");
            return false;
        }
    }


    async _initNeo(neoHost, neoPort, neoScheme,  neoUser, neoPassword, useEncrypted) {
        let prms;
        try {
            this.neoHost = neoHost;
            this.neoPort = neoPort;
            this.neoUser = neoUser;
            this.neoScheme = neoScheme;
            if (useEncrypted != null) {
                this.useEnc = useEncrypted;
            }
            if (this.neoScheme == "neo4j+s") {
                this.neoScheme = "neo4j";
                this.useEnc = true;
            } else if (this.neoScheme == "bolt+s") {
                this.neoScheme = "bolt";
                this.useEnc = true;
            }

            // let boltURL = this.neoScheme + "://" + this.neoHost + ":" + this.neoPort;
            this.neo4jApiUrl = this.neoScheme  + "://" + this.neoHost + ":" + this.neoPort;
            this.neo4jDriver = await this.initDriver(neoPassword, this.neo4jApiUrl);
            this.instanceName = neoHost;

            console.log("Driver object for server " + this.neoHost + " with user " + this.neoUser) ;
            this.neoConnection = true;
            // console.log(this.neo4jDriver);
            prms = this.getNeo4jVersion();
            await prms;


            prms = this.dataDependentApp.init();

            await prms;

        } catch (e) {
            let retryAction = '<button class="ui aprove button" onClick="nac.showConnectForm();" role="button" style="display: block; margin-left: auto; margin-right: auto;"><i class="icon refresh"></i> Try Again</button>'

            console.log(e);
            this._showErrorWarning(retryAction, "Connection Error", e, "");
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

    _showErrorWarning(aAction, aHeader, aError, aComment) {
        let defaultAction = '<div class="ui approve button">Close</div>';
        if (aAction != null) {
            defaultAction = aAction;
        }
        let errorHeader = document.getElementById("errorHeader");
        let errorContent = document.getElementById("errorContent");
        let errorActions = document.getElementById("errorActions");
        errorHeader.innerHTML = aHeader;
        let content = '';
        // ""
        console.log(aError);

        if (aError.message.indexOf("WebSocket connection failure.") > -1 ||
            aError.message.indexOf("Could not perform discovery") > -1 ) {
            let msg1 = "";
            //
            if (this.useEnc === true) {
                msg1+= `The connection error may be caused by the following problems:
                        <li/> Your Neo4j server maybe not running or the hostname is invalid.
                        <li/> No certificate is installed/configured on the Neo4j server.
                        <li/> An untrusted SSL certificate on the Neo4j server is used.
                        <li/> Opening this tool via a https url and want to connect to an unencrypted database
                        <br/> Either install a trusted certificates on the Neo4j server, or when opening this app with a https url try again with a http url.`;
            } else {
                msg1 += "Your Neo4j server maybe not running or the hostname is invalid.";
            }
            content +='<div class="ui orange segment">'+msg1+'</div>';
        } else if (aError.message.indexOf("Unknown Bolt protocol version") > -1) {
            content ='<div class="ui orange segment">Your Neo4j server is running a version below neo4j 3.4, the live connection functionality is not available.</div>';
            defaultAction = '<button class="ui positive aprove button" role="button" style="display: block; margin-left: auto; margin-right: auto;">Proceed without database connection</button>';
        } else {
            content += '<div class="ui red segment">' + aError + '</div>';
        }

        errorContent.innerHTML = content;
        errorActions.innerHTML = defaultAction;
        // now popup
        $('#errorModal').modal({ closable  : false }).modal('show');
//        console.log("after show")
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

    onFormChange() {
        let lhost = document.getElementById("f_host").value;
        let lport = document.getElementById("f_port").value;
        let lusername = document.getElementById( "f_username").value;
        let lpassword = document.getElementById("f_password").value;
        let lencrypted = document.getElementById("f_cbencrypted").checked;
        if (lhost.indexOf(".neo4j.io") > -1 || this.scheme === 'https' ) {
            // console.log("Connecting to an aura instance, so encrypted must be true");
            // when using this tool in a browser via https then the WebSocket connection
            // to neo4j must always be secure.
            document.getElementById("f_cbencrypted").checked = true;
        }

        if (lhost && lport && lusername && lpassword) {
            this._enableElement("connectButton");
        } else {
            this._disableElement("connectButton");
        }
    }

    async showConnectForm() {
        // $('#connectModal').modal('destroy');
        // clear the password always
        document.getElementById("f_password").value = "";
        if (this.neoHost) {
            document.getElementById("f_host").value = this.neoHost;
        }
        if (this.neoUser) {
            document.getElementById( "f_username").value = this.neoUser;
        }
        if (this.neoDbName) {
            document.getElementById("f_dbname").value = this.neoDbName;
        }

        $('#connectModal').modal('show');

    }

    processConnectForm() {
        //
        let lhost = document.getElementById("f_host").value;
        let lport = document.getElementById("f_port").value;
        // let lscheme = document.getElementById("f_scheme").value;
        let lscheme = "bolt"; // even with aura or other cluster configurations we need direct access only

        let lusername = document.getElementById( "f_username").value;
        let lpassword = document.getElementById("f_password").value;
        let lencrypted = document.getElementById("f_cbencrypted").checked;
        let ldbname = document.getElementById("f_dbname").value;
        this._initNeo(lhost, lport, lscheme, lusername, lpassword, lencrypted, ldbname);

    }

    initDriver(pw, driverUrl) {
        let drv = null;
        let conf = { disableLosslessIntegers: false}; // default
        if (this.useEnc) {
            conf.encrypted = "ENCRYPTION_ON";
        }
        drv = neo4j.driver(driverUrl, neo4j.auth.basic(this.neoUser, pw), conf);
        return drv;

        // if (!this.neo4jDriver || this.neo4jDriver == null ){
        //     let conf = {encrypted : "ENCRYPTION_ON", disableLosslessIntegers: false}; // default
        //     if (!this.useEnc) {
        //         conf.encrypted = "ENCRYPTION_OFF";
        //     }
        //
        //     // version 2 of the driver does not use v1 anymore
        //     console.log("api url " + this.neo4jApiUrl);
        //     drv = neo4j.driver(this.neo4jApiUrl, neo4j.auth.basic(this.neoUser, pw), conf);
        // } else {
        //     drv = this.neo4jDriver;
        // }
        // return drv;
    }

    getDriver(pw) {
        let drv = null;
        if (!this.neo4jDriver || this.neo4jDriver == null ){
            let conf = { disableLosslessIntegers: false}; // default
            // console.log(" this.useEnc " + this.useEnc);
            if (this.useEnc) {
                conf.encrypted = "ENCRYPTION_ON";
            }

            // version 2 of the driver does not use v1 anymore
            // console.log("connecting to " + this.neo4jApiUrl );
            drv = neo4j.driver(this.neo4jApiUrl, neo4j.auth.basic(this.neoUser, pw), conf);
        } else {
            drv = this.neo4jDriver;
        }
        return drv;
    }
    async getNeo4jVersion() {
        let session = this.getReadSession();
        if (!session) {
            return 0;
        }
        // console.log(session);
        let reco = await this.runQuery( session, "call dbms.components() yield name, versions, edition return name, versions, edition");
        let rec = reco.records[0];
        this.neodb = new NeoDb(rec.get("name"),rec.get( "versions"),rec.get( "edition") );
        if (this.neodb.majorVersion > 3 && this.neodb.majorVersion < 5 ) {
            reco = await this.runQuery(session, "call dbms.database.state('system') yield role " +
                " with count(*) as cnt return case when cnt < 2 then false else true end as isCluster");
        } else if (this.neodb.majorVersion > 4) {
            reco = await this.runQuery(session, "show database system yield role " +
                " return case when count(*) < 2 then false else true end as isCluster ");
        } else {
            reco = await this.runQuery(session, "call dbms.procedures() yield name where name = 'dbms.cluster.overview'\n" +
                "with count(*) as cnt return case when cnt = 0 then false else true end as isCluster");
        }
        this.neodb.isCluster = reco.records[0].get(0);
        this.neodb.isAura = (this.neoHost.indexOf("neo4j.io") > -1);


        if (this.neodb.majorVersion > 3) {
            // multidatabase !
            // get system session
            let showDatabasesQuery = "show databases";
            // if (this.neodb.isCluster == true) {
            //     showDatabasesQuery = "show databases yield name, currentStatus where currentStatus = 'online'\n" +
            //                          "return name, count(*) as instanceCount";
            // }
            let databases = [];
            let syssession = this.getReadSession("system");
            let sysrecs = await this.runQuery(syssession, showDatabasesQuery);
            sysrecs.records.forEach(function (rcd) {
                let lind = rcd.toObject();
                databases.push(lind);
            });
            this.neodb.setDatabases(databases);
        }
        return this.neodb;
    }

    getWriteSession(dbname) {
        let drv = this.getDriver();
        let sess;
        if (dbname && this.neodb.majorVersion > 3) {
            sess = drv.session({defaultAccessMode: neo4j.session.WRITE, db: dbname});
        } else {
            sess = drv.session(neo4j.session.WRITE);
        }
        return sess;
    }

    getReadSession(dbname) {
        let drv = this.getDriver();
        let sess;
        //console.log(this.neodb);
        if (dbname&& this.neodb.majorVersion > 3) {
            sess = drv.session({ defaultAccessMode: neo4j.session.READ, database: dbname});
        } else {
            sess = drv.session(neo4j.session.READ);
        }
        return sess;
    }


    async getLabels(session) {
        let rs = await this.runQuery(session, "call db.labels() yield label return label");
        let labels = [];
        rs.records.forEach(function (rcd) {
            labels.push(rcd.get("label").toString());
        });
        return labels;
    }

    async getRelationshipTypes(session) {
        let rs = await this.runQuery(session, "call db.relationshipTypes() yield relationshipType return relationshipType");
        let relationshipTypes = [];
        rs.records.forEach(function (rcd) {
            let rst = rcd.get("relationshipType").toString();
            relationshipTypes.push(rst);
        });
        return relationshipTypes;
    }


    async runQuery(session, qry, params, messageContainer) {
        let rs = await this._runQueryBase(session, qry, params);
        return rs;
    }
    async runQueryRecords(session, qry, params, messageContainer) {
        let rs = await this._runQueryBase(session, qry, params);
        return rs.records;
    }

    async _runQueryBase(session, qry, params, messageContainer) {
        if (this.queryDebug) {
            let prompt = "$ ";
            if (session._database) {
                prompt = session._database + '$ ';
            }
           // console.log(prompt + qry);
        }
        let results;
        let prom = session.run(qry, params, {metadata : { app : "DatabaseAnalyzer_v1.0.3", type: "user-direct"}});
        prom.catch(function (error) {
            let msg = error.message;
            if (msg.startsWith("There is no procedure with the name `db.schema`")) {
                msg = "The Neo4j Database Count report is dependend on db.schema() which is available on neo4j 3.1 and higher";
            }
            if (messageContainer) {
                let cs = messageContainer.innerHTML;
                messageContainer.innerHTML = cs + '<br/>ERROR: ' + msg;
            } else {
                console.log(msg);
            }
        });
        return prom;
    }


}

class NeoDb {

    constructor(aName, aVersion, aEdition) {
        // later on there mus be a space to have the db name?
        this.name = aName;
        this.version = aVersion;
        this.edition = aEdition;
        let vstring = "" + aVersion;
        let varray = vstring.split(".");
        this.majorVersion = parseInt(varray[0],10);
        this.minorVersion = parseInt(varray[1], 10);
        this.patchVersion = parseInt(varray[2], 10);

    }

    setDatabases(aDatabaseList) {
        this.databases = aDatabaseList;
    }

    isEnterprise() {
        return "enterprise" == this.edition;
    }

}