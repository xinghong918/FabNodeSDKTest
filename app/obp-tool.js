'use strict';
/*
 * toolkit for obp
 */
var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var Fabric_CA_Client = require('fabric-ca-client');

var path = require('path');
var util = require('util');
var os = require('os');
var fs = require('fs-extra');
const {execSync} = require('child_process');
var logger = log4js.getLogger('OBPTool');
logger.level = 'DEBUG';

var genNewOrgJSONFile = function(mspID, admincertsPem, cacertsPem, tlscacertsPem){
    var store_path = Fabric_Client.getConfigSetting('keyValueStore')+"/"+mspID+".json";
    logger.info(' Store path:' + store_path);
    let adminCerts = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), admincertsPem));
    let adminPemStr = Buffer.from(adminCerts).toString();

    let caCerts = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), cacertsPem));
    let caPemStr = Buffer.from(caCerts).toString();

    let tlscaCerts = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), tlscacertsPem));
    let tlscaPemStr = Buffer.from(tlscaCerts).toString();

    var jsonObj = {
        "mspID": mspID,
        "type": "Participant",
        "certs": {
            "admincert": adminPemStr,
            "cacert": caPemStr,
            "tlscacert": tlscaPemStr
        }
    };
    fs.writeFileSync(store_path, JSON.stringify(jsonObj));
};

exports.genNewOrgJSONFile = genNewOrgJSONFile;