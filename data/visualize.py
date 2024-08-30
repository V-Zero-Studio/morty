import pandas as pd
import matplotlib.pyplot as plt
import json
from datetime import datetime
import math
import os

DATA_FILE = "/data/morty_log_2024-08-24T03_31_04.319Z.json"

START_DATE = "08/21/2024"
END_DATE = "08/31/2024"

series_mouse_enter = []
series_mouse_footprint = []
series_prompt_length = []

cnt_sessions = 0
cnt_mouse_enter = 0
cnt_mouse_leave = 0
sum_mouse_move = 0

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
    for key in data:
        # print(str_entry)
        entry = data[key]
        date_str = entry["timeStamp"]
        date_entry = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
        if start_date > date_entry and date_entry > end_date:
            continue

        cnt_sessions += 1

        int_bev = data[key]["interactionBehaviors"]
        stats = {}

        cnt_mouse_enter += len(int_bev["mouseenterEvents"])
        series_mouse_enter.append(len(int_bev["mouseenterEvents"]))
        
        cnt_mouse_leave += len(int_bev["mouseleaveEvents"])

        footprint = calMouseFootprint(int_bev["mousemoveEvents"])
        series_mouse_footprint.append(footprint)
        sum_mouse_move += footprint

        prompt_log = data[key]["prompt"]
        if "text" in prompt_log:
            series_prompt_length.append(len(prompt_log["text"]))

    # print("avg mouse enter events:", cnt_mouse_enter / cnt_sessions)
    # print("avg mouse leave events:", cnt_mouse_leave / cnt_sessions)
    # print("avg mouse movement:", sum_mouse_move / cnt_sessions)

    print(series_prompt_length)