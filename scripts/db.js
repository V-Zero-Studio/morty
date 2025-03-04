//
// MORTY: DATABASE ACCESS MODULE
//

//
// opening database
//
const openDB = (onSuccess) => {
  const request = indexedDB.open(ID_DB, 1);

  request.onupgradeneeded = function (event) {
    _db = event.target.result;
    if (!_db.objectStoreNames.contains(ID_STORE)) {
      const store = _db.createObjectStore(ID_STORE, {
        keyPath: "id",
        autoIncrement: true,
      });
      log("object store created");
    } else {
      log("object store already exists");
    }
  };

  request.onsuccess = function (event) {
    _db = event.target.result;
    log("database opened successfully in content script");
    onSuccess();
  };

  request.onerror = function (event) {
    log(event);
    log("error code: " + event.target.errorCode);
  };
};

//
// writing to indexedDB
//
const writeToDB = (data, onSuccess) => {
  const transaction = _db.transaction([ID_STORE], "readwrite");
  const store = transaction.objectStore(ID_STORE);

  const addRequest = store.add(data);

  addRequest.onsuccess = function (event) {
    log("data added successfully in content script");
    if (onSuccess != undefined) {
      onSuccess();
    }
  };

  addRequest.onerror = function (event) {
    log("error adding data in content script", event);
  };
};

//
//  reading from indexedDB
//
const readFromDB = (onSuccess) => {
  const transaction = _db.transaction([ID_STORE], "readonly");
  const store = transaction.objectStore(ID_STORE);

  const getRequest = store.getAll();

  getRequest.onsuccess = (event) => {
    if (onSuccess == undefined) {
      log("Data retrieved: ");
      log(getRequest.result);
    } else {
      onSuccess(getRequest.result);
    }
  };

  getRequest.onerror = (event) => {
    log("error retrieving data: ");
    log(event);
  };
};


//
//  trigger a dialog to download an object as a json file
//
const downloadObjectAsJson = (exportObj, exportName) => {
  // convert the object to a JSON string
  const dataStr =
    "data:text/jsoncharset=utf-8," +
    encodeURIComponent(JSON.stringify(exportObj));

  // create an invisible anchor element
  const downloadAnchorNode = document.createElement("a");

  // set the download attribute with a filename
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", exportName + ".json");

  // append the anchor to the document, trigger a click on it, and then remove it
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};