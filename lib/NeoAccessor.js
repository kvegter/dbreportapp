/****************************************************************************
 ** Neo4j Database Accessor using bolt
 **
 ***************************************************************************/
'use strict';


class NeoAccessor {


    constructor(bolturl, neousername, neopassword) {
        this.neoun = neousername;
        this.neopw = neopassword;
        this.neo4jApiUrl = bolturl;
        this.neo4jDriver;
    }

    getDriver() {

        if (!this.neo4jDriver){
            this.neo4jDriver = neo4j.v1.driver(this.neo4jApiUrl, neo4j.v1.auth.basic(this.neoun, this.neopw));
            this.neo4jDriver.onCompleted = function () {
                console.log("Driver instantiated " );
            }
            this.neo4jDriver.onError = function (error) {
                console.log("driver instantiation failed", error);
            }
        }
        return this.neo4jDriver;
    }
  
	getWriteSession() {
        return this.getDriver().session('WRITE');
    }

	getReadSession() {
        return this.getDriver().session('READ');
    }


    async getLabels(session) {
        let rs = await this.runQuery(session, "call db.labels() yield label return label");
        let labels = [];
        rs.forEach(function (rcd) {
            labels.push(rcd.get("label").toString());
        });
        return labels;
    }

    async getRelationshipTypes(session) {
        let rs = await this.runQuery(session, "call db.relationshipTypes() yield relationshipType return relationshipType");
        let relationshipTypes = [];
        rs.forEach(function (rcd) {
            let rst = rcd.get("relationshipType").toString();
            relationshipTypes.push(rst);
        });
        return relationshipTypes;
    }

    async runQuery(session, qry) {
        let current = this;
        let records = [];
        const prom = session.run(qry);
        await prom.then( function(result) {
            records = result.records;
        })
            .catch(function (error) {
                let msg = error.message;
                if (msg.startsWith("There is no procedure with the name `db.schema`")) {
                    msg = "The Neo4j Database Count report is dependend on db.schema() which is available on neo4j 3.1 and higher";
                }
                let cs = document.getElementById("appSummary").innerHTML;
                document.getElementById("appSummary").innerHTML = cs + '<br/>ERROR: ' + msg;
            });
        return records;
    }
}