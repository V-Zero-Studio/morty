//
//
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
