/*
Author by Cathy Xing
*/

package main

import (
	"bytes"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/hyperledger/fabric/common/util"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

type MyChaincode struct {
}

type DemoAsset struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Owner       string `json:"owner"`
	Flag        bool   `json:"flag"`
	UpdatedDate string `json:"updatedDate"`
	Timestamp   int    `json:"timeStamp"`
}

var AssetQueryMap = map[string]string{
	"AssetType":  "DemoAsset~Type",
	"AssetOwner": "DemoAsset~Owner",
}

func main() {
	err := shim.Start(new(MyChaincode))
	if err != nil {
		fmt.Printf("Error starting Parts Trace chaincode: %s", err)
	}
}

func (t *MyChaincode) Init(stub shim.ChaincodeStubInterface) peer.Response {
	return shim.Success(nil)
}

func (t *MyChaincode) Invoke(stub shim.ChaincodeStubInterface) peer.Response {
	function, args := stub.GetFunctionAndParameters()
	fmt.Println("invoke is running " + function)

	// Handle different functions
	if function == "creatAsset" { //create a new asset
		return t.createAsset(stub, args)
	} else if function == "updateAsset" { //update an existing asset
		return t.updateAsset(stub, args)
	} else if function == "deleteAsset" { //delete an asset
		return t.deleteAsset(stub, args)
	} else if function == "getAllAssets" { // get all assets from chaincode state
		return t.getAllAssets(stub, args)
	} else if function == "getAsset" { // get an asset from chaincode state by id
		return t.getAsset(stub, args)
	} else if function == "getAssetByType" { // Filter by type
		return t.getAssetByType(stub, args)
	} else if function == "getHistoryForRecord" { //get history of values for a record
		return t.getHistoryForRecord(stub, args)
	} else if function == "invokeOtherCC" { // invoke other chaincode, e.g. Example02.go, get A
		return t.invokeOtherCC(stub, args)
	} else if function == "getCertificate" { // getCertificate -  get certificate of the Signed Proposal
		return t.getCertificate(stub, args)
	} else if function == "testRESTCC" { // test REST
		return t.testRESTCC(stub, args)
	} else if function == "fireCCEvent" { // Fire Chaincode Event
		return t.fireCCEvent(stub, args)
	}

	fmt.Println("invoke did not find func: " + function) //error
	return shim.Error("Received unknown function invocation")
}

// ============================================================
// createAsset - create a new asset
//
// curl --request POST \
//   --url http://localhost:3100/bcsgw/rest/v1/transaction/invocation \
//   --header 'content-type: application/json' \
//   --data '{"channel":"samchannel","chaincode":"myChaincode","method":"creatAsset","args":["001", "test", "food", "cathy", "true", "2018-05-25", "1502688979"],"chaincodeVer":"v1"}'
// ============================================================
func (t *MyChaincode) createAsset(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var err error
	if len(args) != 7 {
		return shim.Error("Incorrect number of arguments. Expecting 7")
	}

	// ==== Input sanitation ====
	fmt.Println("- start create an asset")
	if len(args[0]) <= 0 {
		return shim.Error("1st argument must be a non-empty string")
	}
	if len(args[1]) <= 0 {
		return shim.Error("2nd argument must be a non-empty string")
	}
	if len(args[2]) <= 0 {
		return shim.Error("3rd argument must be a non-empty string")
	}
	if len(args[3]) <= 0 {
		return shim.Error("4th argument must be a non-empty string")
	}

	_id := args[0]
	// ==== Check if asset already exists ====
	assetBytes, err := stub.GetState(_id)
	if err != nil {
		return shim.Error("Failed to get asset: " + err.Error())
	} else if assetBytes != nil {
		fmt.Println("This asset already exists: " + _id)
		return shim.Error("This asset already exists: " + _id)
	}

	// ==== Create asset object and marshal to JSON ====
	_type := strings.ToUpper(args[2])
	_flag, err := strconv.ParseBool(args[4])
	if err != nil {
		return shim.Error("5th argument must be a boolean string")
	}
	_timestamp, err := strconv.Atoi(args[6])
	if err != nil {
		return shim.Error("7th argument must be a numeric string")
	}

	demoAsset := DemoAsset{_id, args[1], _type, args[3], _flag, args[5], _timestamp}
	assetJSONasBytes, err := json.Marshal(demoAsset)
	if err != nil {
		return shim.Error(err.Error())
	}

	// === Save asset to state ===
	fmt.Println("Create asset: " + string(assetJSONasBytes))
	err = stub.PutState(demoAsset.ID, assetJSONasBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	// create indexes
	err = createIndexHelper(stub, &demoAsset)
	if err != nil {
		return shim.Error(err.Error())
	}

	// ==== Asset saved Return success ====
	fmt.Println("- end create an asset")
	return shim.Success(nil)
}

// ============================================================
// getAllAssets - get an asset from chaincode state
// curl --request POST \
//   --url http://localhost:3100/bcsgw/rest/v1/transaction/query \
//   --header 'content-type: application/json' \
//   --data '{"channel":"samchannel","chaincode":"myChaincode","method":"getAllAssets","args":[],"chaincodeVer":"v1.8"}'
// ============================================================
func (t *MyChaincode) getAllAssets(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	startKey := ""
	endKey := ""

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	resultsIterator, err := stub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(bytes.Trim(queryResponse.Value, "\x00")))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}

	buffer.WriteString("]")

	fmt.Printf("- get all assets:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

// ===============================================
// getAsset - get an asset from chaincode state by id
// curl --request POST \
//   --url http://localhost:3100/bcsgw/rest/v1/transaction/query \
//   --header 'content-type: application/json' \
//   --data '{"channel":"samchannel","chaincode":"myChaincode","method":"getAsset","args":["006"],"chaincodeVer":"v1.8"}'
// ===============================================
func (t *MyChaincode) getAsset(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var _id, jsonResp string
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting id of the asset to query")
	}

	_id = args[0]
	valAsbytes, err := stub.GetState(_id) //get the asset from chaincode state
	if err != nil {
		jsonResp = "{\"Error\":\"Failed to get state for " + _id + "\"}"
		fmt.Println(jsonResp)
		return shim.Error(jsonResp)
	} else if valAsbytes == nil {
		jsonResp = "{\"Error\":\"Asset does not exist: " + _id + "\"}"
		fmt.Println(jsonResp)
		return shim.Error(jsonResp)
	}

	fmt.Printf("- get asset by id:\n%s\n", valAsbytes)

	return shim.Success(valAsbytes)
}

// ===============================================
// updateAsset - update an exsting asset
// curl --request POST \
//   --url http://localhost:3100/bcsgw/rest/v1/transaction/invocation \
//   --header 'content-type: application/json' \
//   --data '{"channel":"samchannel","chaincode":"myChaincode","method":"updateAsset","args":["004", "test004_new", "food", "cathy", "true", "2018-05-21", "1502688979"],"chaincodeVer":"v1.8"}'
// ===============================================
func (t *MyChaincode) updateAsset(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var err error
	if len(args) != 7 {
		return shim.Error("Incorrect number of arguments. Expecting 7")
	}

	// ==== Input sanitation ====
	fmt.Println("- start create an asset")
	if len(args[0]) <= 0 {
		return shim.Error("1st argument must be a non-empty string")
	}
	if len(args[1]) <= 0 {
		return shim.Error("2nd argument must be a non-empty string")
	}
	if len(args[2]) <= 0 {
		return shim.Error("3rd argument must be a non-empty string")
	}
	if len(args[3]) <= 0 {
		return shim.Error("4th argument must be a non-empty string")
	}

	_id := args[0]
	// ==== Check if asset already exists ====
	assetBytes, err := stub.GetState(_id)
	if err != nil {
		return shim.Error("Failed to get asset: " + err.Error())
	} else if assetBytes == nil {
		jsonResp := "{\"Error\":\"Update asset fail - Asset does not exist: " + _id + "\"}"
		fmt.Println(jsonResp)
		return shim.Error(jsonResp)
	} else if assetBytes != nil {
		// ==== Update asset object and marshal to JSON ====
		_type := strings.ToUpper(args[2])
		_flag, err := strconv.ParseBool(args[4])
		if err != nil {
			return shim.Error("5th argument must be a boolean string")
		}
		_timestamp, err := strconv.Atoi(args[6])
		if err != nil {
			return shim.Error("7th argument must be a numeric string")
		}

		demoAsset := DemoAsset{_id, args[1], _type, args[3], _flag, args[5], _timestamp}
		assetJSONasBytes, err := json.Marshal(demoAsset)
		if err != nil {
			return shim.Error(err.Error())
		}

		// === Save asset to state ===
		fmt.Println("Update asset: " + string(assetJSONasBytes))
		err = stub.PutState(demoAsset.ID, assetJSONasBytes)
		if err != nil {
			return shim.Error(err.Error())
		}

		// create indexes
		err = createIndexHelper(stub, &demoAsset)
		if err != nil {
			return shim.Error(err.Error())
		}
	}

	// ==== Asset saved Return success ====
	fmt.Println("- end update an asset")
	return shim.Success(nil)
}

// ===============================================
// deleteAsset - delete an asset from chaincode state by id
// curl --request POST \
//   --url http://localhost:3100/bcsgw/rest/v1/transaction/invocation \
//   --header 'content-type: application/json' \
//   --data '{"channel":"samchannel","chaincode":"myChaincode","method":"deleteAsset","args":["013_"],"chaincodeVer":"v1.8"}'
// ===============================================
func (t *MyChaincode) deleteAsset(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var _id, jsonResp string
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting id of the asset to query")
	}

	_id = args[0]
	valAsbytes, err := stub.GetState(_id) //get the asset from chaincode state
	if err != nil {
		jsonResp = "{\"Error\":\"Failed to get state for " + _id + "\", \"message\": \"" + err.Error() + "\" }"
		fmt.Println(jsonResp)
		return shim.Error(jsonResp)
	} else if valAsbytes == nil {
		jsonResp = "{\"Error\":\"Asset does not exist: " + _id + "\"}"
		fmt.Println(jsonResp)
		return shim.Error(jsonResp)
	}

	demoAsset := &DemoAsset{}
	json.Unmarshal(valAsbytes, demoAsset)

	err = stub.DelState(_id)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to delete asset: %s", _id))
	}

	// delete indexes
	err = deleteIndexHelper(stub, demoAsset)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(valAsbytes)
}

// ===============================================
// getAssetByType - get asset by type
// curl --request POST \
//   --url http://localhost:3100/bcsgw/rest/v1/transaction/query \
//   --header 'content-type: application/json' \
//   --data '{"channel":"samchannel","chaincode":"myChaincode","method":"getAssetByType","args":["food"],"chaincodeVer":"v1.8"}'
// ===============================================
func (t *MyChaincode) getAssetByType(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var _type string
	var err error
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting type to query")
	}
	_type = strings.ToUpper(args[0])
	indexName := AssetQueryMap["AssetType"]
	partIterator, err := stub.GetStateByPartialCompositeKey(indexName, []string{_type})
	if err != nil {
		return shim.Error(err.Error())
	}
	defer partIterator.Close()

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for partIterator.HasNext() {
		queryResponse, err := partIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		_, components, err := stub.SplitCompositeKey(queryResponse.Key)
		if err != nil {
			return shim.Error(err.Error())
		}

		//Components should be type, id
		if len(components) < 2 {
			return shim.Error("Index is malformed for asset components!")
		}

		var _id = components[1]
		partAsBytes, err := stub.GetState(_id)
		if err != nil {
			return shim.Error(err.Error())
		}
		if partAsBytes == nil {
			//Just skip, presumably the index is broken, though we could fix by deleting the index?
			continue
		}
		//Gets an entry from the ledger, partAsBytes is nil if not found
		buffer.Write(partAsBytes)
		bArrayMemberAlreadyWritten = true
	}

	//Close the array and write the payload back to the caller
	buffer.WriteString("]")
	return shim.Success(buffer.Bytes())
}

// ===============================================
// getHistoryForRecord - returns the historical state transitions for a given key of a record
// curl --request POST \
//   --url http://localhost:3100/bcsgw/rest/v1/transaction/query \
//   --header 'content-type: application/json' \
//   --data '{"channel":"samchannel","chaincode":"myChaincode","method":"getHistoryForRecord","args":["004"],"chaincodeVer":"v1.8"}'
// ===============================================
func (t *MyChaincode) getHistoryForRecord(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	if len(args) < 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	recordKey := args[0]

	fmt.Printf("- start getHistoryForRecord: %s\n", recordKey)

	resultsIterator, err := stub.GetHistoryForKey(recordKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing historic values for the key/value pair
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		// if it was a delete operation on given key, then we need to set the
		//corresponding value null. Else, we will write the response.Value
		//as-is (as the Value itself a JSON vehiclePart)
		if response.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(response.Value))
		}

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"IsDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(response.IsDelete))
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- getHistoryForRecord returning:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

// ===============================================
// invokeOtherCC -  invoke other chaincode, e.g. Example02.go, get A
// curl --request POST \
//   --url http://localhost:3100/bcsgw/rest/v1/transaction/query \
//   --header 'content-type: application/json' \
//   --data '{"channel":"samchannel","chaincode":"myChaincode","method":"invokeOtherCC","args":["obcs-example02", "invoke","query", "a"],"chaincodeVer":"v1.8"}'
// ===============================================
func (t *MyChaincode) invokeOtherCC(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	if len(args) < 2 {
		return shim.Error("Incorrect number of arguments. Expecting >= 2")
	}

	otherCCName := args[0]
	_args := args[1:len(args)]
	respMsg := stub.InvokeChaincode(otherCCName, util.ToChaincodeArgs(_args...), "")
	if respMsg.Status != shim.OK {
		return shim.Error("Failed to invoke other chaincode.")
	}

	var buffer bytes.Buffer
	buffer.WriteString(string(respMsg.Payload))
	return shim.Success(buffer.Bytes())
}

// ===============================================
// getCertificate -  get certificate of the Signed Proposal
// curl --request POST \
//   --url http://localhost:3100/bcsgw/rest/v1/transaction/query \
//   --header 'content-type: application/json' \
//   --data '{"channel":"samchannel","chaincode":"myChaincode","method":"getCertificate","args":[],"chaincodeVer":"v1.8"}'
// ===============================================
func (t *MyChaincode) getCertificate(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	creatorByte, _ := stub.GetCreator()
	certStart := bytes.IndexAny(creatorByte, "-----BEGIN")
	if certStart == -1 {
		fmt.Errorf("No certificate found")
	}
	certText := creatorByte[certStart:]
	bl, _ := pem.Decode(certText)
	if bl == nil {
		fmt.Errorf("Could not decode the PEM structure")
	}

	cert, err := x509.ParseCertificate(bl.Bytes)
	if err != nil {
		fmt.Errorf("ParseCertificate failed")
	}
	uname := cert.Subject.CommonName
	// orgArr := cert.Issuer.Organization
	// mspname := strings.Join(orgArr,", ")
//	issuer := cert.Issuer.CommonName
//	fmt.Println("Name:" + uname)
	return shim.Success([]byte("Called testCertificate " + uname))
}

func (t *MyChaincode) testRESTCC(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	url := "https://apex.oracle.com/pls/apex/xh/hr/employees/"
	ret, err := http.Get(url)

	if err != nil {
		panic(err)
	}
	defer ret.Body.Close()

	body, err := ioutil.ReadAll(ret.Body)
	if err != nil {
		panic(err)
	}
	fmt.Println("testRESTCC response msg:", string(body))
	return shim.Success([]byte(body))
}


func (t *MyChaincode) fireCCEvent(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var value []byte
	if len(args) == 0 {
	    value = []byte("Defaulting")
	}else{
		value = []byte(args[0])
	}
	fmt.Println("fireCCEvent value:", string(value))
	//Write the value to our eventKey
	err := stub.PutState("eventKey", value);
	if err != nil {
		shim.Error("Error writing to the event key!")
	}

	stub.SetEvent("testEvent", value)
	return shim.Success(value)
}


func createIndexHelper(stub shim.ChaincodeStubInterface, demoAsset *DemoAsset) error {
	var err error = nil

	for queryKey, indexName := range AssetQueryMap {
		if queryKey == "AssetType" {
			err = createIndex(stub, indexName, []string{demoAsset.Type, demoAsset.ID})
		} else if queryKey == "AssetOwner" {
			err = createIndex(stub, indexName, []string{demoAsset.Owner, demoAsset.ID})
		}
	}

	return err
}

// ===============================================
// createIndex - create search index for ledger
// ===============================================
func createIndex(stub shim.ChaincodeStubInterface, indexName string, attributes []string) error {
	fmt.Println("- start create index")
	var err error
	//  ==== Index the object to enable range queries, e.g. return all parts made by supplier b ====
	//  An 'index' is a normal key/value entry in state.
	//  The key is a composite key, with the elements that you want to range query on listed first.
	//  This will enable very efficient state range queries based on composite keys matching indexName~color~*
	indexKey, err := stub.CreateCompositeKey(indexName, attributes)
	if err != nil {
		return err
	}
	//  Save index entry to state. Only the key name is needed, no need to store a duplicate copy of object.
	//  Note - passing a 'nil' value will effectively delete the key from state, therefore we pass null character as value
	value := []byte{0x00}

	stub.PutState(indexKey, value)

	fmt.Println("- end create index")
	return nil
}

func deleteIndexHelper(stub shim.ChaincodeStubInterface, demoAsset *DemoAsset) error {
	var err error = nil

	for queryKey, indexName := range AssetQueryMap {
		if queryKey == "AssetType" {
			err = deleteIndex(stub, indexName, []string{demoAsset.Type, demoAsset.ID})
		} else if queryKey == "AssetOwner" {
			err = deleteIndex(stub, indexName, []string{demoAsset.Owner, demoAsset.ID})
		}
	}

	return err
}

// ===============================================
// deleteIndex - remove search index for ledger
// ===============================================
func deleteIndex(stub shim.ChaincodeStubInterface, indexName string, attributes []string) error {
	fmt.Println("- start delete index")
	var err error
	//  ==== Index the object to enable range queries, e.g. return all parts made by supplier b ====
	//  An 'index' is a normal key/value entry in state.
	//  The key is a composite key, with the elements that you want to range query on listed first.
	//  This will enable very efficient state range queries based on composite keys matching indexName~color~*
	indexKey, err := stub.CreateCompositeKey(indexName, attributes)
	if err != nil {
		return err
	}
	//  Delete index by key
	stub.DelState(indexKey)

	fmt.Println("- end delete index")
	return nil
}
