import pandas as pd
import matplotlib.pyplot as plt
import json
from datetime import datetime
import math
import os
import matplotlib.dates as mdates
import statistics

DATA_FILE = "/data/morty_log_2024-12-04T03_26_47.067Z.json"

START_DATE = "11/1/2024"
END_DATE = "2/28/2025"

series_date = []

# mitigation technique related
series_confidence = []
series_agreement = []

# user input
series_mouse_enter = []
series_mouse_footprint = []
series_prompt_length = []
series_window_leave = []

cnt_sessions = 0
cnt_mouse_enter = 0
sum_mouse_move = 0
cnt_window_leave = 0
cnt_copy_events = 0
sum_length_copy = 0

# user input - scroll
cnt_scroll_needed = 0
cnt_scroll_actions = 0
sum_scroll_offset = 0
cnt_scroll_events = 0
sum_scroll_intervals = 0

# timing related
series_time_to_action = []
series_interaction_length = []

# calculate the footprint (length) of a sequence of mouse movements
def calMouseFootprint(events):
    footprint = 0
    for i in range(1, len(events)):
        dx = events[i]["coord"]["x"] - events[i-1]["coord"]["x"]
        dy = events[i]["coord"]["y"] - events[i-1]["coord"]["y"]
        footprint += math.sqrt(dx * dx + dy * dy)
    return footprint

if __name__ == "__main__":
    with open(os.getcwd() + DATA_FILE, 'r') as file:
        data = json.load(file)

    start_date = datetime.strptime(START_DATE, "%m/%d/%Y")
    end_date = datetime.strptime(END_DATE, "%m/%d/%Y")

    for entry in data:
        # exclude data outside of specified range
        date_entry = datetime.fromisoformat(entry["timeStamp"].replace("Z", "+00:00")).replace(tzinfo=None)
        if start_date > date_entry or date_entry > end_date:
            continue

        if entry["prompt"] == {}:
            print("skipped empty entry")
            continue

        cnt_sessions += 1

        series_date.append(datetime.strptime(entry["timeStamp"], "%Y-%m-%dT%H:%M:%S.%fZ"))

        if "rating" in entry["confidenceRating"]:
            series_confidence.append(entry["confidenceRating"]["rating"])
        else:
            series_confidence.append(None)

        if "rating" in entry["agreementRating"]:
            series_agreement.append(entry["agreementRating"]["rating"])
        else:
            series_agreement.append(None)

        int_bev = entry["interactionBehaviors"]

        cnt_mouse_enter += len(int_bev["mouseenterEvents"])
        series_mouse_enter.append(len(int_bev["mouseenterEvents"]))
        
        footprint = calMouseFootprint(int_bev["mousemoveEvents"])
        series_mouse_footprint.append(footprint)
        sum_mouse_move += footprint

        cnt_window_leave += len(int_bev["windowleaveEvents"])
        series_window_leave.append(len(int_bev["windowleaveEvents"]))

        # if scrolling is needed
        if "height" in entry["response"] and "viewHeight" in entry and entry["response"]["height"] > entry["viewHeight"]:
            cnt_scroll_needed += 1
            cnt_scroll_actions += len(int_bev["scrollEvents"])
            sum_scroll_offset += sum(event["offset"] for event in int_bev["scrollEvents"])
            for i in range(len(int_bev["scrollEvents"]) - 1):
                ts = datetime.strptime(int_bev["scrollEvents"][i]['timeStamp'], "%Y-%m-%dT%H:%M:%S.%fZ")
                ts_next = datetime.strptime(int_bev["scrollEvents"][i+1]['timeStamp'], "%Y-%m-%dT%H:%M:%S.%fZ")
                sum_scroll_intervals += (ts_next - ts).seconds # todo: store the value in a series instead
                cnt_scroll_events += 1

        prompt_log = entry["prompt"]
        series_prompt_length.append(len(prompt_log["text"]))
        ts_prompt_sent = datetime.strptime(prompt_log["timeSent"], "%Y-%m-%dT%H:%M:%S.%fZ")
        
        cnt_copy_events += len(int_bev["copyEvents"])
        for event in int_bev["copyEvents"]:
            sum_length_copy += event["length"]

        ts_first_action = None
        ts_last_action = None
        for eventType in int_bev:
            for event in int_bev[eventType]:
                ts = datetime.strptime(event['timeStamp'], "%Y-%m-%dT%H:%M:%S.%fZ")
                ts_first_action = min(ts, ts_first_action) if ts_first_action != None else ts
                ts_last_action = max(ts, ts_last_action) if ts_last_action != None else ts

        if ts_first_action != None:
            dt_first_action = ts_first_action - ts_prompt_sent
            series_time_to_action.append(dt_first_action.seconds)
            dt_interaction_length = ts_last_action - ts_first_action
            series_interaction_length.append(dt_interaction_length.seconds)
        else:
            series_time_to_action.append(None)
            series_interaction_length.append(None)
    # ------------------------------------------------------------------------

    # 
    # basic usage summary
    # 
    print()
    print("total # of (non-empty) sessions:", cnt_sessions)
    diff_dates = max(series_date) - min(series_date)
    print("total # of days", diff_dates.days)
    print("avg # of sessions per day", cnt_sessions / (diff_dates.days + 1))

    # 
    # summary stats of mouse related behaviors
    # 
    print()
    print("avg mouse enter events per session:", cnt_mouse_enter / cnt_sessions, "#:", len(series_mouse_enter))
    print("avg mouse movement per session:", sum_mouse_move / cnt_sessions, "#:", len(series_mouse_footprint))
    print("avg window leave event per sessions:", cnt_window_leave / cnt_sessions, "#:", len(series_window_leave))
    print("avg # of scroll actions (when needed):", cnt_scroll_actions / cnt_scroll_needed, "#:", cnt_scroll_needed)
    print("avg # of pixels scrolled (when needed):", sum_scroll_offset / cnt_scroll_needed)
    print("avg interval between scroll:", sum_scroll_intervals / cnt_scroll_events)
    
    # 
    # prompt related stats
    # 
    print()
    print("avg prompt length:", statistics.mean(series_prompt_length), "(", statistics.stdev(series_prompt_length), ")")

    # 
    # copy events
    # 
    print()
    print("avg copy events per session:", cnt_copy_events / cnt_sessions)
    if cnt_copy_events > 0 :
        print("avg length per copy event", sum_length_copy / cnt_copy_events)
    
    # 
    # less direct stats
    # 
    print()
    print("time to action:", series_time_to_action)
    print("interaction lengths:", series_interaction_length)

    # 
    # plot confidence rating over time
    # 
    df_confidence = pd.DataFrame({
        'date': series_date,
        'value': series_confidence
    })
    df_confidence['date'] = pd.to_datetime(df_confidence["date"])
    df_confidence_aggregated = df_confidence.groupby(df_confidence['date'].dt.date).mean()
    df_confidence_aggregated.index.name = 'date_aggregated' 
    df_confidence_aggregated = df_confidence_aggregated.reset_index()

    plt.figure(figsize=(10, 6))
    plt.scatter(df_confidence_aggregated['date_aggregated'], df_confidence_aggregated['value'], color='blue', marker='o')

    #
    # confidence / agreement response rate
    # 
    print()
    cnt_confidence_response = sum(1 for element in series_confidence if element is not None)
    print("confidence response rate:", cnt_confidence_response / cnt_sessions)
    cnt_agreement_response = sum(1 for element in series_agreement if element is not None)
    print("agreement response rate:", cnt_agreement_response / cnt_sessions)

    # 
    # plot agreement rating over time
    # 
    df_agreement = pd.DataFrame({
        'date': series_date,
        'value': series_agreement
    })
    df_agreement['date'] = pd.to_datetime(df_agreement["date"])
    df_agreement_aggregated = df_agreement.groupby(df_agreement['date'].dt.date).mean()
    df_agreement_aggregated.index.name = 'date_aggregated' 
    df_agreement_aggregated = df_agreement_aggregated.reset_index()

    plt.scatter(df_agreement_aggregated['date_aggregated'], df_agreement_aggregated['value'], color='red', marker='o')

    plt.gca().xaxis.set_major_locator(mdates.DayLocator())
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.xticks(rotation=45)

    plt.xlabel('Date')
    plt.ylabel('Rating')
    plt.title('Confidence & Agreement Rating Over Time')
    plt.grid(True)
    plt.show()