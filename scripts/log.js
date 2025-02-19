//
//
//

//
//  create an empty new log entry
//
const createNewLogEntry = () => {
  return {
    timeStamp: time(),
    prompt: {
      timeSent: undefined,
      text: undefined,
    },
    response: {
      timeStreamingStarted: undefined,
      timeStreamingEnded: undefined,
      height: undefined,
    },
    interactionBehaviors: {
      scrollEvents: [],
      clickEvents: [],
      mousedownEvents: [],
      mousemoveEvents: [],
      mouseupEvents: [],
      mouseenterEvents: [],
      mouseleaveEvents: [],
      copyEvents: [],
      windowenterEvents: [],
      windowleaveEvents: [],
      keydownEvents: [],
    },
    agreementRating: {
      timeStamp: undefined, // the time of the last-hovered rating
      rating: undefined,
    },
  };
};

//
//  attach event listeners to log interaction behaviors
//
const logInteractionBehaviorOn = (elm) => {
  elm.addEventListener("click", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.clickEvents.push({ timeStamp: time() });
  });

  elm.addEventListener("mousewheel", (e) => {
    if (_sessionEntry == undefined) return;
    pushIfApart(
      _sessionEntry.interactionBehaviors.scrollEvents,
      { timeStamp: time(), offset: e.deltaY },
      DT_EVENTS,
      (array, entry) => {
        if (array.length > 0) {
          array[array.length - 1].offset += entry.offset;
        }
      }
    );
  });

  elm.addEventListener("mousedown", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.mousedownEvents.push({
      timeStamp: time(),
      coord: { x: e.clientX, y: e.clientY },
    });
  });

  elm.addEventListener("mousemove", (e) => {
    if (_sessionEntry == undefined) return;
    pushIfApart(
      _sessionEntry.interactionBehaviors.mousemoveEvents,
      { timeStamp: time(), coord: { x: e.clientX, y: e.clientY } },
      DT_EVENTS
    );
  });

  elm.addEventListener("mouseup", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.mouseupEvents.push({
      timeStamp: time(),
      coord: { x: e.clientX, y: e.clientY },
    });
  });

  elm.addEventListener("mouseenter", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.mouseenterEvents.push({
      timeStamp: time(),
    });
  });

  elm.addEventListener("mouseleave", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.mouseleaveEvents.push({
      timeStamp: time(),
    });
  });

  elm.addEventListener("copy", (e) => {
    if (_sessionEntry == undefined) return;
    _sessionEntry.interactionBehaviors.copyEvents.push({
      timeStamp: time(),
      length: window.getSelection().toString().length,
    });
  });
};


//
// for continuous data (e.g., mouse move, scrolling),
// push it to the queue if it's dt apart from previous data point
// (to avoid oversampling)
// aggrFunc is a custom function to aggregate "dense" data points' values into a single one
//
const pushIfApart = (array, entry, dt, aggrFunc) => {
    if (array.length === 0) {
      array.push(entry);
      return;
    }
  
    const timeStampPrev = array[array.length - 1].timeStamp;
  
    if (new Date().getTime() - new Date(timeStampPrev).getTime() > dt) {
      array.push(entry);
    } else if (aggrFunc != undefined) {
      aggrFunc(array, entry);
    }
  };