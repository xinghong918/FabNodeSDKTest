package main

import (
	// "bytes"
	"encoding/json"
	// "fmt"
	"strconv"

	"github.com/hyperledger/fabric/common/util"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	exampleCC "myChaincode/example02"
	"testing"
)

type ResultJSON []struct {
	Key    string `json:"Key"`
	Record string `json:"Record"`
}

func TestCreateAsset(t *testing.T) {
	stub := shim.NewMockStub("mockChaincodeStub", new(MyChaincode))
	if stub == nil {
		t.Fatalf("MockStub creation failed")
	}
	demoAsset := DemoAsset{"001", "test", "food", "cathy", true, "2018-05-25", 1502688979}

	createAsset(t, stub, demoAsset)

	// assetAsbytes, _ := stub.GetState(demoAsset.ID)
	// if assetAsbytes == nil {
	// 	t.Errorf("Asset not created!")
	// }
	// fmt.Println("Get state: " + string(assetAsbytes))

	// getAsset
	invokeFunc := "getAsset"
	args := [][]byte{[]byte(invokeFunc), []byte(demoAsset.ID)}
	invokeResult := stub.MockInvoke("12345", args)
	if invokeResult.Status != 200 {
		t.Errorf("Get asset returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	}
	// t.Log("invokeResult.Message: " + string(invokeResult.Message))
	t.Log("Get asset by id invokeResult.Payload: " + string(invokeResult.Payload))

	// Validate index was created
	// indexKey, _ := stub.CreateCompositeKey("vehiclePart~assembler", []string{"panamaparts","abg1234"})
	// indexEntry, _ := stub.GetState(indexKey)
	// if indexEntry == nil {
	// 	t.Errorf("Index on assembler not created!")
	// }
}

func TestDeleteAsset(t *testing.T) {
	stub := shim.NewMockStub("mockChaincodeStub", new(MyChaincode))
	if stub == nil {
		t.Fatalf("MockStub creation failed")
	}
	demoAsset := DemoAsset{"001", "test", "food", "cathy", true, "2018-05-25", 1502688979}
	createAsset(t, stub, demoAsset)

	// delete Asset
	invokeFunc := "deleteAsset"
	args := [][]byte{[]byte(invokeFunc), []byte(demoAsset.ID)}
	invokeResult := stub.MockInvoke("12345", args)
	if invokeResult.Status != 200 {
		t.Errorf("Delete asset returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	}
	t.Log("Delete asset invokeResult.Payload: " + string(invokeResult.Payload))
}

func TestGetAssetsByType(t *testing.T) {
	var err error
	stub := shim.NewMockStub("mockChaincodeStub", new(MyChaincode))
	if stub == nil {
		t.Fatalf("MockStub creation failed")
	}
	t.Log("************ TestGetAssetsByType ****************")
	demoAsset := DemoAsset{"001", "test1", "food", "cathy", true, "2018-05-25", 1502688979}
	createAsset(t, stub, demoAsset)
	demoAsset.ID = "002"
	demoAsset.Name = "test2"
	createAsset(t, stub, demoAsset)
	demoAsset.ID = "003"
	demoAsset.Name = "test3"
	demoAsset.Type = "drink"
	createAsset(t, stub, demoAsset)

	invokeFunc := "getAssetByType"
	args := [][]byte{[]byte(invokeFunc), []byte("food")}
	invokeResult := stub.MockInvoke("12345", args)
	if invokeResult.Status != 200 {
		t.Errorf("Create asset returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	}

	t.Logf("invokeResult.Payload: %s \n", invokeResult.GetPayload())

	var resultPayload []DemoAsset // []map[string]interface{}
	err = json.Unmarshal(invokeResult.GetPayload(), &resultPayload)
	if err != nil {
		t.Errorf("Unmarshal failed: %s", err)
	}
	t.Logf("Total %d of assets! \n", len(resultPayload))
	if len(resultPayload) != 2 {
		t.Errorf("get asset by type return wrong number, got: %d, want: %d", len(resultPayload), 2)
	}
	//	t.Logf("%s \n", resultPayload[0].Name)
}

// func TestGetHistoryForRecord(t *testing.T) {
// 	// var err error
// 	stub := shim.NewMockStub("mockChaincodeStub", new(MyChaincode))
// 	if stub == nil {
// 		t.Fatalf("MockStub creation failed")
// 	}
// 	t.Log("************ TestGetHistoryForRecord ****************")
// 	// create asset
// 	demoAsset := DemoAsset{"001", "test1", "food", "cathy", true, "2018-05-25", 1502688979}
// 	createAsset(t, stub, demoAsset)
// 	// delete Asset
// 	invokeFunc := "deleteAsset"
// 	args := [][]byte{[]byte(invokeFunc), []byte(demoAsset.ID)}
// 	invokeResult := stub.MockInvoke("12345", args)
// 	if invokeResult.Status != 200 {
// 		t.Errorf("Delete asset returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
// 	}

// 	// get history
// 	invokeFunc = "getHistoryForRecord"
// 	args = [][]byte{[]byte(invokeFunc), []byte(demoAsset.ID)}
// 	invokeResult = stub.MockInvoke("12345", args)
// 	if invokeResult.Status != 200 {
// 		t.Errorf("Get history for record returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
// 	}
// 	t.Logf("invokeResult.Payload: %s \n", invokeResult.GetPayload())
// }

func TestQueryAllAssets(t *testing.T) {
	// var err error
	stub := shim.NewMockStub("mockChaincodeStub", new(MyChaincode))
	if stub == nil {
		t.Fatalf("MockStub creation failed")
	}

	demoAsset := DemoAsset{"001", "test1", "food", "cathy", true, "2018-05-25", 1502688979}
	createAsset(t, stub, demoAsset)
	demoAsset.ID = "002"
	demoAsset.Name = "test2"
	createAsset(t, stub, demoAsset)

	invokeFunc := "getAllAssets"
	args := [][]byte{[]byte(invokeFunc)}
	invokeResult := stub.MockInvoke("12345", args)
	if invokeResult.Status != 200 {
		t.Errorf("Create asset returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	}

	//	t.Logf("invokeResult.Payload: %s \n", invokeResult.GetPayload())

	// var resultPayload []map[string]interface{}
	// err = json.Unmarshal(invokeResult.GetPayload(), &resultPayload)
	// if err != nil {
	// 	t.Errorf("Unmarshal failed: %s", err)
	// }
	// t.Logf("Total %d of assets! \n", len(resultPayload))
}

func TestUpdateAsset(t *testing.T) {
	// var err error
	stub := shim.NewMockStub("mockChaincodeStub", new(MyChaincode))
	if stub == nil {
		t.Fatalf("MockStub creation failed")
	}
	t.Log("************ TestUpdateAsset ****************")
	// create asset
	demoAsset := DemoAsset{"001", "test1", "food", "cathy", true, "2018-05-25", 1502688979}
	createAsset(t, stub, demoAsset)
	// update Asset
	demoAsset.Name = "test_new"
	demoAsset.UpdatedDate = "2018-05-28"
	updateAsset(t, stub, demoAsset)

	// getAsset
	invokeFunc := "getAsset"
	args := [][]byte{[]byte(invokeFunc), []byte(demoAsset.ID)}
	invokeResult := stub.MockInvoke("12345", args)
	if invokeResult.Status != 200 {
		t.Errorf("Get asset returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	}
	t.Log("Get asset by id invokeResult.Payload: " + string(invokeResult.Payload))
}

func TestInvokeOtherCC(t *testing.T) {
	stub := shim.NewMockStub("mockChaincodeStub", new(MyChaincode))
	if stub == nil {
		t.Fatalf("MockStub creation failed")
	}
	t.Log("************ TestInvokeOtherCC ****************")
	// invoke other chaincode
	invokeFunc, otherCCName := "invokeOtherCC", "obcs-example02"
	// Register a peer chaincode with this MockStub
	stub2 := shim.NewMockStub("mockChaincodeStub", new(exampleCC.SimpleChaincode))
	stub2.MockInit("123344", [][]byte{[]byte("Init"), []byte("a"), []byte("100"), []byte("b"), []byte("200")})
	stub.MockPeerChaincode(otherCCName, stub2)
	// args := [][]byte{[]byte(invokeFunc), []byte("obcs-example02"), []byte("invoke"), []byte("query"), []byte("a")}
	// invoke test
	args := util.ToChaincodeArgs(invokeFunc, otherCCName, "invoke", "query", "a")
	invokeResult := stub.MockInvoke("12345", args)
	if invokeResult.Status != 200 {
		t.Errorf("Invoke other chaincode returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	}
	t.Log("Invoke other chaincode invokeResult.Payload: " + string(invokeResult.Payload))

	// invoke chaincode directly
	// invokeResult := stub.InvokeChaincode("example02_cc", ccArgs, "mychan")
	// if invokeResult.Status != 200 {
	// 	t.Errorf("Invoke other chaincode returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	// }
	// t.Log("Get asset by id invokeResult.Message: " + string(invokeResult.Message))
	// t.Log("Get asset by id invokeResult.Payload: " + string(invokeResult.Payload))
}

// func TestCreator(t *testing.T) {
// 	// var err error
// 	stub := shim.NewMockStub("mockChaincodeStub", new(MyChaincode))
// 	if stub == nil {
// 		t.Fatalf("MockStub creation failed")
// 	}
// 	t.Log("************ TestCreator ****************")

// 	// getCertificate
// 	invokeFunc := "getCertificate"
// 	args := [][]byte{[]byte(invokeFunc), []byte("")}
// 	invokeResult := stub.MockInvoke("12345", args)
// 	if invokeResult.Status != 200 {
// 		t.Errorf("Get creator cert returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
// 	}
// 	t.Log("Get creator cert invokeResult.Payload: " + string(invokeResult.Payload))
// }

func TestGetTxTimestamp(t *testing.T) {
	stub := shim.NewMockStub("GetTxTimestamp", new(MyChaincode))
	// stub := NewMockStub("GetTxTimestamp", nil)
	stub.MockTransactionStart("init")

	timestamp, err := stub.GetTxTimestamp()
	if timestamp == nil || err != nil {
		t.FailNow()
	}
	t.Logf("GetTxTimestamp: %d", timestamp)
	stub.MockTransactionEnd("init")
}

func TestTestRESTCC(t *testing.T) {
	stub := shim.NewMockStub("mockChaincodeStub", new(MyChaincode))
	if stub == nil {
		t.Fatalf("MockStub creation failed")
	}
	t.Log("************ TestTestRESTCC ****************")

	// TestRESTCC
	invokeFunc := "testRESTCC"
	args := [][]byte{[]byte(invokeFunc)}
	invokeResult := stub.MockInvoke("12345", args)
	if invokeResult.Status != 200 {
		t.Errorf("testRESTCC returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	}
	t.Log("testRESTCC invokeResult.Payload: " + string(invokeResult.Payload))
}

func createAsset(t *testing.T, stub *shim.MockStub, demoAsset DemoAsset) {
	// args := [][]byte{[]byte("creatAsset"), []byte("001"), []byte("test"), []byte("type"), []byte("cathy"), []byte("true"), []byte("2018-05-25"), []byte("1502688979")}
	invokeFunc := "creatAsset"

	_flag := "false"
	if demoAsset.Flag {
		_flag = "true"
	}

	args := [][]byte{[]byte(invokeFunc), []byte(demoAsset.ID), []byte(demoAsset.Name), []byte(demoAsset.Type),
		[]byte(demoAsset.Owner), []byte(_flag), []byte(demoAsset.UpdatedDate), []byte(string(strconv.Itoa(demoAsset.Timestamp)))}
	invokeResult := stub.MockInvoke("12345", args)
	if invokeResult.Status != 200 {
		t.Errorf("Create asset returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	}
}

func updateAsset(t *testing.T, stub *shim.MockStub, demoAsset DemoAsset) {
	// args := [][]byte{[]byte("creatAsset"), []byte("001"), []byte("test"), []byte("type"), []byte("cathy"), []byte("true"), []byte("2018-05-25"), []byte("1502688979")}
	invokeFunc := "updateAsset"

	_flag := "false"
	if demoAsset.Flag {
		_flag = "true"
	}

	args := [][]byte{[]byte(invokeFunc), []byte(demoAsset.ID), []byte(demoAsset.Name), []byte(demoAsset.Type),
		[]byte(demoAsset.Owner), []byte(_flag), []byte(demoAsset.UpdatedDate), []byte(string(strconv.Itoa(demoAsset.Timestamp)))}
	invokeResult := stub.MockInvoke("12345", args)
	if invokeResult.Status != 200 {
		t.Errorf("Update asset returned non-OK status, got: %d, want: %d.", invokeResult.Status, 200)
	}
}
