//
// MORTY: DATABASE ACCESS MODULE
//

//
// opening database
//
const openDB = (dbID, storeID, onSuccess) => {
  const request = indexedDB.open(dbID, 1);

  request.onupgradeneeded = function (event) {
    const db = event.target.result;
    if (!db.objectstoreIDs.contains(storeID)) {
      const store = db.createObjectStore(storeID, {
        keyPath: "id",
        autoIncrement: true,
      });
      log("object store created");
    } else {
      log("object store already exists");
    }
  };

  request.onsuccess = function (event) {
    log("database opened successfully in content script");
    onSuccess(event);
  };

  request.onerror = function (event) {
    log(event);
    log("error code: " + event.target.errorCode);
  };
};

//
// writing to indexedDB
//
const writeToDB = (db, storeID, data, onSuccess) => {
  const transaction = db.transaction([storeID], "readwrite");
  const store = transaction.objectStore(storeID);

  const addRequest = store.put(data);

  addRequest.onsuccess = function (event) {
    log("data added successfully in content script");
    if (onSuccess != undefined) {
      onSuccess();
    }
  };

  addRequest.onerror = function (event) {
    console.error("error adding data in content script", event);
  };
};

//
//  reading from indexedDB
//
const readFromDB = (db, storeID, onSuccess) => {
  const transaction = db.transaction([storeID], "readonly");
  const store = transaction.objectStore(storeID);

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
//
//
function deleteEntry(db, storeID, key) {
  // return new Promise((resolve, reject) => {
  //   const request = indexedDB.open(dbID);

  //   request.onsuccess = function (event) {
  const transaction = db.transaction(storeID, "readwrite");
  const store = transaction.objectStore(storeID);
  const deleteRequest = store.delete(key);

  deleteRequest.onsuccess = function () {
    console.log(`Entry with key ${key} deleted successfully.`);
    resolve();
  };

  deleteRequest.onerror = function (event) {
    console.error("Error deleting entry:", event.target.error);
    reject(event.target.error);
  };

  // transaction.oncomplete = function () {
  //   db.close(); // Close the database connection after the operation
  // };
  // };

  //   request.onerror = function (event) {
  //     console.error("Error opening database:", event.target.error);
  //     reject(event.target.error);
  //   };
  // });
}

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

//
//  detect if a log entry is out of the window
//  (i.e., older than n days ago)
//
const isOutOfWindow = (timeStamp, window) => {
  const givenDate = new Date(timeStamp);
  const earliestDate = new Date();
  earliestDate.setDate(earliestDate.getDate() - window);
  return givenDate < earliestDate;
};

//
//  automatically deleting old entries
//
const autoDeleteOldLog = (dbID, storeID, daysToKeep) => {
  openDB(dbID, storeID, (event) => {
    const db = event.target.result;
    const transaction = db.transaction([storeID], "readonly");
    const store = transaction.objectStore(storeID);

    const keysRequest = store.getAllKeys();

    keysRequest.onsuccess = function (event) {
      // console.log("Keys:", event.target.result);
      const keys = event.target.result;
      for (const key of keys) {
        const getRequest = store.get(key);

        getRequest.onsuccess = function (event) {
          const entry = event.target.result;
          if (entry !== undefined) {
            if (isOutOfWindow(entry.timeStamp, daysToKeep)) {
              deleteEntry(db, storeID, key);
              console.log("entry deleted", entry);
            }
          } else {
            console.log("no entry found for key:", yourKey);
          }
        };

        getRequest.onerror = function (event) {
          console.error("error retrieving entry:", event.target.error);
        };
      }
    };

    keysRequest.onerror = function (event) {
      console.error("error retrieving keys:", event.target.error);
    };
  });
};
