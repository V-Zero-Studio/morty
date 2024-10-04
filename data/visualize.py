import pandas as pd
import matplotlib.pyplot as plt
import json
from datetime import datetime
import math
import os
import matplotlib.dates as mdates
import statistics


DATA_FILE = "/data/morty_log_2024-10-01T03_13_15.865Z.json"

START_DATE = "08/21/2024"
END_DATE = "08/31/2024"

series_date = []

series_confidence = []
series_agreement = []

series_mouse_enter = []
series_mouse_footprint = []
series_prompt_length = []
series_window_leave = []

cnt_sessions = 0
cnt_mouse_enter = 0
# cnt_mouse_leave = 0
sum_mouse_move = 0
cnt_window_leave = 0
cnt_copy_events = 0
sum_length_copy = 0

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

    print("total # of session entries:", len(data))

    start_date = datetime.strptime(START_DATE, "%m/%d/%Y")
    end_date = datetime.strptime(END_DATE, "%m/%d/%Y")
    for entry in data:
        date_str = entry["timeStamp"]
        date_entry = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
        if start_date > date_entry and date_entry > end_date:
            continue

        cnt_sessions += 1

        str_date = entry["timeStamp"]
        series_date.append(datetime.strptime(str_date, "%Y-%m-%dT%H:%M:%S.%fZ"))

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
        
        # cnt_mouse_leave += len(int_bev["mouseleaveEvents"]) 

        footprint = calMouseFootprint(int_bev["mousemoveEvents"])
        series_mouse_footprint.append(footprint)
        sum_mouse_move += footprint

        cnt_window_leave += len(int_bev["windowleaveEvents"])
        series_window_leave.append(len(int_bev["windowleaveEvents"]))

        prompt_log = entry["prompt"]
        if "text" in prompt_log:
            series_prompt_length.append(len(prompt_log["text"]))
        
        cnt_copy_events += len(int_bev["copyEvents"])
        for event in int_bev["copyEvents"]:
            sum_length_copy += event["length"]
    # 
    # basic usage summary
    # 
    diff_dates = max(series_date) - min(series_date)
    print("total # of days", diff_dates.days)
    print("avg # of sessions per day", cnt_sessions / diff_dates.days)

    # 
    # summary stats of mouse related behaviors
    # 
    print("avg mouse enter events:", cnt_mouse_enter / cnt_sessions, "#:", len(series_mouse_enter))
    # print("avg mouse leave events:", cnt_mouse_leave / cnt_sessions)
    print("avg mouse movement:", sum_mouse_move / cnt_sessions, "#:", len(series_mouse_footprint))
    print("avg window leave events:", cnt_window_leave / cnt_sessions, "#:", len(series_window_leave))

    # 
    # prompt related stats
    # 
    print("prompt length:", statistics.mean(series_prompt_length), "(", statistics.stdev(series_prompt_length), ")")

    # 
    # copy events
    # 
    print("avg copy events per session:", cnt_copy_events / cnt_sessions)
    print("avg length per copy event", sum_length_copy / cnt_copy_events)
    
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
    df_agreement['date'] = pd.to_datetime(df_confidence["date"])
    df_agreement_aggregated = df_agreement.groupby(df_confidence['date'].dt.date).mean()
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