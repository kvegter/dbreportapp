/****************************************************************************
 ** Neo4j Database Accessor using bolt
 **
 ***************************************************************************/
'use strict';


function NeoAccessor(bolturl, neousername, neopassword) {
	this.neoun = neousername;
  this.neopw = neopassword;
	this.neo4jApiUrl = bolturl;
  this.neo4jDriver;
  
  this.getDriver = function() {
        
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
  
	this.getWriteSession = function () {
    	  return this.getDriver().session('WRITE');
    }

	this.getReadSession = function () {
    	  return this.getDriver().session('READ');
    }

}