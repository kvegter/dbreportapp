'use strict';
class DBTools {
    constructor() {
        this.toolContent = document.getElementById("toolcontent");
        this.maxDensity = 50;
    }

    appendMessage(sStringLine) {
        let ht = this.toolContent.innerHTML;
        ht = ht + "<br/>" + sStringLine;
        this.toolContent.innerHTML = ht;
    }

    // Model Tools Section
    startJavaBeanGenerator(apackagename) {
        if (!dbreport.dbinfo) {
            this.appendMessage(" No database schema info is available! Run analyze db with all the properties first!");
            return;
        }
        this.toolContent.innerHTML = "";

        // apackagename = "org.neoj4.change.this.name"; // testing
        // walk through the labels and the properties.
        console.log("startJavaBeanGenerator package name = " + apackagename);
        let current = this;
        let processedRelTypes = []; // reltype definition: StartLabel:RELTYPE:EndLabel

        dbreport.dbinfo.labelCounts.forEach( function (item) {
            current.appendMessage("/** ");
            current.appendMessage("* ##" + item.label + ".java## generated on " + new Date());
            current.appendMessage("**/")
            current.appendMessage("package " + apackagename + ";");
            current.appendMessage(" ");
            current.appendMessage("import org.neo4j.ogm.annotation.*;");
            current.appendMessage("import java.util.HashSet;");
            current.appendMessage("import java.util.Set;");
            current.appendMessage(" ");
            current.appendMessage("@NodeEntity")
            current.appendMessage("public class " + item.label + " {");
            current.appendMessage("  private " + item.label + "() {}"); // private empty constructor

            current.appendMessage("  @Id @GeneratedValue @Version");
            current.appendMessage("  private Long _id;");
            current.appendMessage("  public Long get_Id() {  return _id; }");
            current.appendMessage("  public void set_Id(Long _id) { this._id = id; } ");
            current.appendMessage(" ");
            // property:
            item.allProperties.forEach( function (pip) {
                let propname = pip.split("-")[0].trim();
                let proptype = pip.split("-")[1].trim();
                current.appendMessage("  private " + current._getJavaPropType(proptype) + " " + propname + ";");
                // getter
                current.appendMessage("  public " + current._getJavaPropType(proptype) + " " + current._getJavaGetter(propname, proptype) + "() { return this." + propname + "; }");
                // setter
                current.appendMessage("  public void " + current._getJavaSetter(propname) + "(" + current._getJavaPropType(proptype) + " " + propname + ") { this." + propname + " = " + propname + "; }" );
                current.appendMessage(" ");
            });
            //
            // analyzing relationships
            // we start here with the definitions
            //
//            console.log("Start Processing relationships for " + item.label);
            dbreport.dbinfo.schemaRels.forEach( function (srel) {
                // start label
                if (srel.startNode.labels.includes(item.label)) {
                   // get now the end label
                   srel.endNode.labels.forEach( function(endlabel) {
                      // relkey
                      let relkey = item.label + ":" + srel.type + ":" + endlabel;
  //                    console.log("processing relkey " + relkey);
                      if (!processedRelTypes.includes(relkey)) {
                          // out
                          let relcount = current._getRelCount(item.outgoingRelations, srel.type);
                          // determine density relcount/nodecount
                          let density = relcount/item.count;
                          if (density <= 1) {
                              // the end node becomes a member
                              current.appendMessage(" ");
                              let prop = endlabel.slice(0,1).toLowerCase() + endlabel.slice(1);
                              current.appendMessage("  @Relationship(type=\"" + srel.type + "\", direction = Relationship.OUTGOING)");
                              current.appendMessage("  private " + endlabel + " " + prop + "; ");
                              current.appendMessage("  public " + endlabel + " " + current._getJavaGetter(prop, endlabel) + "() { return this." + prop + "; }");
                              // setter
                              current.appendMessage("  public void " + current._getJavaSetter(endlabel) + "(" + endlabel + " " + prop + ") { this." + prop + " = " + prop + "; }" );
                              current.appendMessage(" ");

                          } else  {
                              // the end node becomes a List<Member>
                              let prec= "  ";
                              if (density > current.maxDensity) {
                                  prec = "  //";
                                  current.appendMessage("// Based on the db analyzis each node has an average of more than " + current.maxDensity + " relationships of this type, the code will be commented, handle with care");
                              }
                              let prop = endlabel.slice(0,1).toLowerCase() + endlabel.slice(1) ;
                              current.appendMessage( prec + "@Relationship(type=\"" + srel.type + "\", direction = Relationship.OUTGOING)");
                              current.appendMessage(prec + "private Set<" + endlabel + "> " + prop + "s;");
                              current.appendMessage(prec + "public Set<" + endlabel + "> " + current._getJavaGetter(prop + "s", endlabel) + "() { return this." + prop + "s; }");
                              // convenience add method
                              current.appendMessage( prec + "public void add" + endlabel + "(" + endlabel + " " + prop  + ") {");
                              current.appendMessage(prec + "  if (this." + prop + "s == null) {" );
                              current.appendMessage(prec + "    " + prop + "s = new HashSet<>();");
                              current.appendMessage(prec + "  }");
                              current.appendMessage(prec + "  " + prop + "s.add(" + prop + ");");
                              current.appendMessage(prec + "}");


                          }
                          processedRelTypes.push(relkey);
                      }
                   }) ;
                }
                // end label
                if (srel.endNode.labels.includes(item.label)) {
                    // get now the start label
                    srel.startNode.labels.forEach( function(startlabel) {
                        // relkey
                        let relkey = startlabel +  ":" + srel.type + ":" + item.label ;
                        if (!processedRelTypes.includes(relkey)) {
                            // in
                            let relcount = current._getRelCount(item.incomingRelations, srel.type);
                            // determine density relcount/nodecount
                            let density = relcount/item.count;
                            if (density <= 1) {
                                // the end node becomes a member
                                current.appendMessage(" ");
                                let prop = startlabel.slice(0,1).toLowerCase() + startlabel.slice(1);
                                current.appendMessage("  @Relationship(type=\"" + srel.type + "\", direction = Relationship.INCOMING)");
                                current.appendMessage("  private " + startlabel + " " + prop + "; ");
                                current.appendMessage("  public " + startlabel + " " + current._getJavaGetter(prop, startlabel) + "() { return this." + prop + "; }");
                                // setter
                                current.appendMessage("  public void " + current._getJavaSetter(startlabel) + "(" + startlabel + " " + prop + ") { this." + prop + " = " + prop + "; }" );
                                current.appendMessage(" ");

                            } else  {
                                // the end node becomes a List<Member>
                                let prec= "  ";
                                if (density > current.maxDensity) {
                                    prec = "  //";
                                    current.appendMessage("// Based on the db analyzis each node has an average of more than " + current.maxDensity + " relationships of this type, the code will be commented, handle with care");
                                }
                                let prop = startlabel.slice(0,1).toLowerCase() + startlabel.slice(1) ;
                                current.appendMessage( prec + "@Relationship(type=\"" + srel.type + "\", direction = Relationship.OUTGOING)");
                                current.appendMessage(prec + "private Set<" + startlabel + "> " + prop + "s;");
                                current.appendMessage(prec + "public Set<" + startlabel + "> " + current._getJavaGetter(prop + "s", startlabel) + "() { return this." + prop + "s; }");
                                // convenience add method
                                current.appendMessage( prec + "public void add" + startlabel + "(" + startlabel + " " + prop  + ") {");
                                current.appendMessage(prec + "  if (this." + prop + "s == null) {" );
                                current.appendMessage(prec + "    " + prop + "s = new HashSet<>();");
                                current.appendMessage(prec + "  }");
                                current.appendMessage(prec + "  " + prop + "s.add(" + prop + ");");
                                current.appendMessage(prec + "}");


                            }
                            processedRelTypes.push(relkey);
                        }
                    }) ;
                }
            });

            //

            current.appendMessage("}");
            current.appendMessage(";;");
            current.appendMessage(" ");

        });


    }

    _hasRelProperties(atype) {
        let hasit = false;
        dbreport.dbinfo.forEach( function(elm) {
           if (elm.type == atype) {
               if (elm.allProperties.length > 0 ) {
                   hasit = true;
               }
           }
        });
        return hasit;
    }

    _getRelCount(arellist, atype) {
        let cnt = 0;
        arellist.forEach( function (elm) {
           if (elm.type == atype) {
               cnt = elm.count;
           }
        });
        return cnt;
    }

    _getJavaPropType(aType) {
        let lType = aType.toLowerCase();
        if (lType == "string") {
            return "String"
        } else if (lType == "boolean") {
            return "Boolean";
        } else if (lType == "integer") {
            return "Integer";
        } else if (lType == "Float") {
            return "Double";
        } else {
            return aType;
        }
    }
    _getJavaGetter(aProp, aType) {
        let prefix = "get";
        if (aType.toLowerCase() == "boolean") {
            prefix = "is";
        }
        return prefix + aProp.slice(0,1).toUpperCase() + aProp.slice(1);


    }
    _getJavaSetter(aProp) {
        let prefix = "set";
        return prefix + aProp.slice(0,1).toUpperCase() + aProp.slice(1);
    }

    getZip() {

    }
}